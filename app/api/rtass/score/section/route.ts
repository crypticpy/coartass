import { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse, successResponse } from "@/lib/api-utils";
import { createLogger } from "@/lib/logger";
import { getOpenAIClient, OpenAIConfigError, isAzureOpenAI } from "@/lib/openai";
import { estimateTokens, selectDeploymentByTokens } from "@/lib/token-utils";
import { formatTranscriptWithTimestamps } from "@/lib/analysis-strategies";
import type { TranscriptSegment } from "@/types/transcript";
import type {
  RtassRubricTemplate,
  RtassScorecardCriterion,
  RtassScorecardSection,
  RtassVerdict,
} from "@/types/rtass";

const log = createLogger("RTASS.Score.Section");

const verdictSchema = z.enum([
  "met",
  "missed",
  "partial",
  "not_observed",
  "not_applicable",
]);

const evidenceSchema = z.object({
  quote: z.string().min(1),
  start: z.number().nonnegative(),
  end: z.number().nonnegative().optional(),
  speaker: z.string().min(1).optional(),
});

const observedEventSchema = z.object({
  name: z.string().min(1),
  at: z.number().nonnegative(),
});

const sectionResponseSchema = z.object({
  sectionId: z.string().min(1),
  criteria: z.array(
    z.object({
      criterionId: z.string().min(1),
      verdict: verdictSchema,
      score: z.number().min(0).max(1).optional(),
      confidence: z.number().min(0).max(1),
      rationale: z.string().min(1),
      evidence: z.array(evidenceSchema),
      observedEvents: z.array(observedEventSchema).optional(),
    })
  ),
  sectionNotes: z.string().optional(),
  warnings: z.array(z.string()).optional(),
});

const transcriptSchema = z.object({
  text: z.string().min(1),
  segments: z.array(
    z.object({
      index: z.number().optional(),
      start: z.number(),
      end: z.number(),
      text: z.string(),
      speaker: z.string().optional(),
    })
  ),
});

const rubricSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  version: z.string().min(1),
  jurisdiction: z.string().min(1).optional(),
  tags: z.array(z.string().min(1)).optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date().optional(),
  sections: z
    .array(
      z.object({
        id: z.string().min(1),
        title: z.string().min(1),
        description: z.string().min(1),
        weight: z.number().min(0).max(1),
        criteria: z.array(
          z.object({
            id: z.string().min(1),
            title: z.string().min(1),
            description: z.string().min(1),
            required: z.boolean(),
            weight: z.number().min(0).max(1).optional(),
            type: z.enum(["boolean", "graded", "enum", "timing"]),
            grading: z
              .object({
                minScore: z.number().optional(),
                maxScore: z.number().optional(),
              })
              .optional(),
            enumOptions: z.array(z.string().min(1)).optional(),
            timing: z
              .object({
                startEvent: z.string().min(1),
                endEvent: z.string().min(1),
                targetSeconds: z.number().nonnegative().optional(),
                maxSeconds: z.number().nonnegative().optional(),
              })
              .optional(),
            evidenceRules: z
              .object({
                minEvidence: z.number().int().min(0).max(10),
                requireVerbatimQuote: z.boolean().optional(),
              })
              .optional(),
            notes: z.string().optional(),
          })
        ),
      })
    )
    .min(1),
  scoring: z.object({
    method: z.literal("weighted_average"),
    thresholds: z.object({
      pass: z.number().min(0).max(1),
      needsImprovement: z.number().min(0).max(1),
    }),
    requiredNotObservedBehavior: z.enum(["treat_as_missed", "exclude_with_warning"]),
  }),
  llm: z.object({
    concurrency: z.number().int().min(1).max(10),
    maxRetries: z.number().int().min(0).max(5),
    evidenceQuoteMaxChars: z.number().int().min(40).max(600),
  }),
}) satisfies z.ZodType<RtassRubricTemplate>;

const requestSchema = z.object({
  transcriptId: z.string().min(1),
  transcript: transcriptSchema,
  rubric: rubricSchema,
  sectionId: z.string().min(1),
  supplementalMaterial: z.string().optional(),
});

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function verdictToScore(verdict: RtassVerdict, scoreFromModel?: number): number | undefined {
  switch (verdict) {
    case "met":
      return 1;
    case "missed":
      return 0;
    case "partial":
      return typeof scoreFromModel === "number" ? clamp01(scoreFromModel) : 0.5;
    case "not_observed":
    case "not_applicable":
      return undefined;
  }
}

function statusFromScore(score: number, rubric: RtassRubricTemplate): "pass" | "needs_improvement" | "fail" {
  if (score >= rubric.scoring.thresholds.pass) return "pass";
  if (score >= rubric.scoring.thresholds.needsImprovement) return "needs_improvement";
  return "fail";
}

function computeSectionScore(params: {
  rubric: RtassRubricTemplate;
  section: RtassRubricTemplate["sections"][number];
  criteriaResults: RtassScorecardCriterion[];
}): { score: number; warnings: string[] } {
  const { rubric, section, criteriaResults } = params;

  const criterionById = new Map(section.criteria.map((c) => [c.id, c]));
  const warnings: string[] = [];

  let numerator = 0;
  let denominator = 0;

  for (const result of criteriaResults) {
    const criterion = criterionById.get(result.criterionId);
    if (!criterion) continue;

    const weight = typeof criterion.weight === "number"
      ? criterion.weight
      : 1 / Math.max(1, section.criteria.length);

    if (result.verdict === "not_applicable") {
      continue;
    }

    if (result.verdict === "not_observed") {
      if (criterion.required && rubric.scoring.requiredNotObservedBehavior === "treat_as_missed") {
        numerator += weight * 0;
        denominator += weight;
        warnings.push(`Required criterion not observed: ${section.id}/${criterion.id}`);
      } else {
        warnings.push(`Criterion not observed: ${section.id}/${criterion.id}`);
      }
      continue;
    }

    const score = typeof result.score === "number" ? result.score : undefined;
    if (typeof score !== "number") continue;

    numerator += weight * score;
    denominator += weight;
  }

  if (denominator === 0) {
    return { score: 0, warnings: [...warnings, `No scorable criteria in section: ${section.id}`] };
  }

  return { score: clamp01(numerator / denominator), warnings };
}

function buildSectionPrompt(params: {
  rubric: RtassRubricTemplate;
  section: RtassRubricTemplate["sections"][number];
  transcript: string;
  supplementalMaterial?: string;
}): string {
  const { rubric, section, transcript, supplementalMaterial } = params;

  const criteriaJson = section.criteria.map((c) => ({
    id: c.id,
    title: c.title,
    description: c.description,
    required: c.required,
    type: c.type,
    enumOptions: c.enumOptions,
    timing: c.timing,
    notes: c.notes,
  }));

  return `You are an expert fireground radio traffic evaluator for Austin Fire Department (AFD) Training Division.

Your job is to score radio communications against a rubric section.

Hard rules:
- Do NOT speculate. If a criterion cannot be supported by radio traffic, return verdict "not_observed".
- If a criterion is conditional and does not apply, return verdict "not_applicable".
- Provide short verbatim evidence quotes with timestamps whenever possible.
- The transcript uses [MM:SS] markers at the start of each line. Convert them to total seconds for evidence.start.
- Respond with JSON only.

Rubric: ${rubric.name} (v${rubric.version})
Section: ${section.title} (${section.id})

Criteria (evaluate each one):
${JSON.stringify(criteriaJson, null, 2)}

Output JSON schema (respond exactly in this shape):
\`\`\`json
{
  "sectionId": "${section.id}",
  "criteria": [
    {
      "criterionId": "criterion-id",
      "verdict": "met|missed|partial|not_observed|not_applicable",
      "score": 0,
      "confidence": 0.0,
      "rationale": "1-3 sentences.",
      "evidence": [
        { "quote": "short verbatim quote", "start": 123, "end": 130, "speaker": "optional" }
      ],
      "observedEvents": [
        { "name": "optional_event_name", "at": 123 }
      ]
    }
  ],
  "sectionNotes": "optional",
  "warnings": ["optional"]
}
\`\`\`

${supplementalMaterial ? `Supplemental material (policy excerpts / notes). Use as background only; do not cite it as evidence:\n\n${supplementalMaterial}\n\n` : ""}Transcript:

${transcript}
`;
}

function parseSectionResponse(raw: string): z.infer<typeof sectionResponseSchema> {
  const parsed = JSON.parse(raw) as unknown;
  return sectionResponseSchema.parse(parsed);
}

export async function POST(request: NextRequest) {
  try {
    const body = requestSchema.parse(await request.json());
    const { transcriptId, transcript, rubric, sectionId, supplementalMaterial } = body;

    if (rubric.sections.length === 0) {
      return errorResponse("Rubric has no sections", 400, { type: "invalid_rubric", rubricId: rubric.id });
    }

    const section = rubric.sections.find((s) => s.id === sectionId);
    if (!section) {
      return errorResponse("Rubric section not found", 404, { type: "section_not_found", sectionId });
    }

    if (!transcript.segments || transcript.segments.length === 0) {
      return errorResponse("Transcript has no segments", 400, { type: "invalid_transcript", transcriptId });
    }

    const openaiClient = getOpenAIClient();
    const timestampedTranscript = formatTranscriptWithTimestamps(transcript.segments as TranscriptSegment[]);
    const estimatedTokens = estimateTokens(transcript.text);
    const deployment = selectDeploymentByTokens(estimatedTokens);
    const maxRetries = Math.max(0, Math.min(5, rubric.llm.maxRetries));

    log.info("Scoring rubric section", {
      transcriptId,
      rubricId: rubric.id,
      rubricVersion: rubric.version,
      sectionId,
      deployment,
      maxRetries,
    });

    const prompt = buildSectionPrompt({
      rubric,
      section,
      transcript: timestampedTranscript,
      supplementalMaterial,
    });

    let lastError: Error | undefined;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const res = await openaiClient.chat.completions.create({
          model: deployment,
          messages: [
            {
              role: "system",
              content:
                "You are an expert fireground radio traffic evaluator for Austin Fire Department (AFD) Training Division. " +
                "Do not speculate. Always respond with valid JSON only.",
            },
            { role: "user", content: prompt },
          ],
          response_format: { type: "json_object" },
          max_completion_tokens: 8000,
        });

        const content = res.choices[0].message.content;
        if (!content) {
          throw new Error("Empty response from model");
        }

        const response = parseSectionResponse(content);

        const criteriaById = new Map(section.criteria.map((c) => [c.id, c]));
        const criteriaResults: RtassScorecardCriterion[] = response.criteria.map((c) => {
          const rubricCriterion = criteriaById.get(c.criterionId);
          const verdict = c.verdict as RtassVerdict;

          const score = verdictToScore(verdict, c.score);

          return {
            criterionId: c.criterionId,
            title: rubricCriterion?.title ?? c.criterionId,
            verdict,
            score,
            confidence: c.confidence,
            rationale: c.rationale,
            evidence: c.evidence,
            observedEvents: c.observedEvents,
          };
        });

        const { score, warnings: sectionWarnings } = computeSectionScore({
          rubric,
          section,
          criteriaResults,
        });

        const resultSection: RtassScorecardSection = {
          sectionId: section.id,
          title: section.title,
          weight: section.weight,
          score,
          status: statusFromScore(score, rubric),
          criteria: criteriaResults,
        };

        const warnings = [
          ...(response.warnings ?? []),
          ...sectionWarnings,
        ];

        return successResponse({
          section: resultSection,
          warnings: warnings.length > 0 ? warnings : undefined,
          modelInfo: {
            provider: isAzureOpenAI() ? "azure-openai" : "openai",
            model: deployment,
            deployment,
          },
        });
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (attempt < maxRetries) continue;
      }
    }

    throw lastError ?? new Error("Unknown scoring error");
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse("Invalid request body", 400, {
        type: "validation_error",
        errors: error.issues,
      });
    }

    if (error instanceof OpenAIConfigError) {
      return errorResponse("Server configuration error. GPT API is not properly configured.", 500, {
        type: "configuration_error",
        message: error.message,
      });
    }

    return errorResponse("Failed to score RTASS rubric section", 500, {
      message: error instanceof Error ? error.message : String(error),
    });
  }
}


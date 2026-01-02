/**
 * Evidence Citations API Route Handler
 *
 * POST endpoint that selects higher-quality supporting evidence for analysis sections.
 *
 * Strategy:
 * - Use a small model (e.g. Azure gpt-4.1-mini) to propose grounded segment ranges (chunked)
 * - Build excerpts from those ranges and select the best citations per section
 *
 * This endpoint is intentionally separate from `/api/analyze` to avoid increasing
 * end-to-end analysis latency and risking gateway timeouts for long analyses.
 *
 * @route POST /api/citations
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { errorResponse, successResponse } from '@/lib/api-utils';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';
import {
  getCitationsClient,
  getCitationsDeployment,
  OpenAIConfigError,
} from '@/lib/openai';
import { generateEvidenceCitationsWithLLM } from '@/lib/citations';
import type { Evidence, TemplateSection, TranscriptSegment } from '@/types';

/**
 * Request validation schema with size limits to prevent DoS attacks.
 *
 * Limits rationale:
 * - segments: 10,000 max (typical 1hr meeting ~3,600 segments at 1/sec)
 * - segment text: 5,000 chars max (longest reasonable utterance)
 * - section content: 50,000 chars max (detailed analysis section)
 * - templateSections: 50 max (no template should exceed this)
 */
const citationsRequestSchema = z.object({
  transcript: z.object({
    segments: z.array(
      z.object({
        start: z.number(),
        end: z.number(),
        text: z.string().max(5000, 'Segment text exceeds 5000 character limit'),
        speaker: z.string().max(200).optional(),
        index: z.number().optional(),
      })
    ).min(1).max(10000, 'Too many segments (max 10,000)'),
  }),
  templateSections: z.array(
    z.object({
      id: z.string().max(100).optional(),
      name: z.string().max(200),
      prompt: z.string().max(2000).optional().default(''),
      extractEvidence: z.boolean().optional().default(true),
      outputFormat: z.enum(['bullet_points', 'paragraph', 'table']).optional().default('paragraph'),
      dependencies: z.array(z.string().max(100)).max(20).optional(),
    })
  ).min(1).max(50, 'Too many template sections (max 50)'),
  sections: z.array(
    z.object({
      name: z.string().max(200),
      content: z.string().max(50000, 'Section content exceeds 50,000 character limit'),
    })
  ).min(1).max(50, 'Too many sections (max 50)'),
  maxEvidencePerSection: z.number().int().min(1).max(5).optional(),
});

type CitationsRequest = z.infer<typeof citationsRequestSchema>;

export async function POST(request: NextRequest) {
  try {
    if (process.env.NODE_ENV === 'production') {
      const decision = checkRateLimit(request, {
        key: 'citations',
        windowMs: 10 * 60 * 1000,
        max: 30,
      });
      if (!decision.allowed) {
        return rateLimitResponse(decision);
      }
    }

    let body: CitationsRequest;
    try {
      body = citationsRequestSchema.parse(await request.json());
    } catch (error) {
      if (error instanceof z.ZodError) {
        return errorResponse('Invalid request body', 400, {
          type: 'validation_error',
          errors: error.issues,
        });
      }
      return errorResponse('Failed to parse request body', 400);
    }

    const citationsEnabled = process.env.CITATIONS_ENABLED !== 'false';
    if (!citationsEnabled) {
      return successResponse({
        disabled: true,
        sections: body.sections.map((s) => ({ name: s.name, evidence: [] as Evidence[] })),
      });
    }

    const MAX_SECTIONS = 24;
    if (body.sections.length > MAX_SECTIONS) {
      return errorResponse('Too many sections for citations generation', 400, {
        type: 'too_many_sections',
        limit: MAX_SECTIONS,
        count: body.sections.length,
      });
    }

    const openaiClient = (() => {
      try {
        return getCitationsClient();
      } catch (error) {
        if (error instanceof OpenAIConfigError) {
          throw error;
        }
        throw new OpenAIConfigError('Failed to initialize citations client');
      }
    })();

    const deployment = getCitationsDeployment();

    const templateSections: TemplateSection[] = body.templateSections.map((s, idx) => ({
      id: s.id ?? `section-${idx + 1}`,
      name: s.name,
      prompt: s.prompt ?? '',
      extractEvidence: s.extractEvidence ?? true,
      outputFormat: s.outputFormat ?? 'paragraph',
      dependencies: s.dependencies,
    }));

    const transcriptSegments: TranscriptSegment[] = body.transcript.segments.map((s, idx) => ({
      index: s.index ?? idx,
      start: s.start,
      end: s.end,
      text: s.text,
      speaker: s.speaker,
    }));

    const evidenceBySection = await generateEvidenceCitationsWithLLM({
      openaiClient,
      deployment,
      templateSections,
      transcriptSegments,
      sections: body.sections,
      maxEvidencePerSection: body.maxEvidencePerSection,
    });

    const responseSections: Array<{ name: string; evidence: Evidence[] }> = evidenceBySection.map(
      (s) => ({
        name: s.name,
        evidence: s.evidence,
      })
    );

    return successResponse({ sections: responseSections });
  } catch (error) {
    if (error instanceof OpenAIConfigError) {
      return errorResponse(
        'Server configuration error. Citations model is not properly configured.',
        500,
        { type: 'configuration_error', message: error.message }
      );
    }

    return errorResponse(
      error instanceof Error ? error.message : 'Failed to generate citations',
      500,
      { type: 'citations_error' }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    success: true,
    data: {
      endpoint: '/api/citations',
      method: 'POST',
      description: 'Selects supporting evidence excerpts for analysis sections using a small LLM.',
      requiredConfig: {
        azure: {
          deploymentEnv: 'AZURE_OPENAI_CITATIONS_DEPLOYMENT (defaults to "gpt-4.1-mini")',
          apiVersionEnv: 'AZURE_OPENAI_CITATIONS_API_VERSION (defaults to "2024-12-01-preview")',
        },
      },
    },
  });
}

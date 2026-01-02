/**
 * Basic Analysis Strategy - Monolithic Single-Pass
 *
 * Fast analysis that processes all sections in a single API call.
 * Best for: Short meetings (<15k tokens), quick overviews, straightforward discussions.
 *
 * Processing Time: 2-4 minutes (GPT-5.2)
 * API Calls: 1 call (all sections at once)
 * Quality: Good - captures key information but minimal cross-referencing
 *
 * Features:
 * - Single comprehensive prompt with all section requirements
 * - Structured JSON output with relationship IDs
 * - Explicit instructions for linking decisions/actions to agenda items
 * - Identification of orphaned items
 */

import type {
  Template,
  AnalysisResults,
  AnalysisSection,
  AgendaItem,
  ActionItem,
  Decision,
  Quote,
  EvaluationResults,
  TranscriptSegment,
  EnrichmentMetadata,
} from '@/types';
import type OpenAI from 'openai';
import {
  formatOutputType,
  postProcessResults,
  validateTokenLimits,
  ANALYSIS_CONSTANTS,
  retryWithBackoff,
  TIMESTAMP_INSTRUCTION,
} from './shared';
import { executeEvaluationPass } from './evaluator';
import { getCitationsClient, getCitationsDeployment } from '../openai';
import {
  createMiningEngine,
  isEnrichmentEnabled,
  shouldEnrich,
  actionMiningPattern,
  decisionMiningPattern,
  quoteMiningPattern,
} from './enrichment';

/**
 * Result from basic analysis (raw JSON response)
 */
interface BasicAnalysisResponse {
  sections: {
    name: string;
    content: string;
  }[];
  agendaItems?: Array<{
    id: string;
    topic: string;
    timestamp?: number;
    context?: string;
  }>;
  actionItems?: Array<{
    id: string;
    task: string;
    owner?: string;
    deadline?: string;
    timestamp: number; // Required - extracted from transcript timestamp markers
    agendaItemIds?: string[];
    decisionIds?: string[];
  }>;
  decisions?: Array<{
    id: string;
    decision: string;
    timestamp: number;
    context?: string;
    agendaItemIds?: string[];
  }>;
  quotes?: Array<{
    text: string;
    speaker?: string;
    timestamp: number;
  }>;
  summary?: string;
}

/**
 * Generate monolithic prompt for basic analysis
 *
 * Creates a single comprehensive prompt that requests all sections,
 * structured outputs, and relationship mapping in one API call.
 *
 * @param template - Analysis template with sections
 * @param transcript - Full transcript text
 * @param supplementalMaterial - Optional supplemental source material text
 * @returns Comprehensive prompt string
 */
export function generateBasicAnalysisPrompt(
  template: Template,
  transcript: string,
  supplementalMaterial?: string
): string {
  const sectionInstructions = template.sections
    .map((section, idx) => {
      return `
### Section ${idx + 1}: ${section.name}

**Task**: ${section.prompt}

**Output Format**: ${formatOutputType(section.outputFormat)}

**Requirements**:
- Provide clear, concise content
- For bullet_points: MUST use "-" character ONLY (NOT numbered lists 1,2,3), max ${ANALYSIS_CONSTANTS.MAX_BULLET_POINTS} items, capitalize first letter
- For paragraphs: Continuous prose, ${ANALYSIS_CONSTANTS.MAX_PARAGRAPH_WORDS} words max
- Start with action verbs or key concepts
- Be specific and actionable
`;
    })
    .join('\n');

  const hasAgenda = template.sections.some((s) =>
    s.name.toLowerCase().includes('agenda')
  );
  const hasDecisions = template.outputs.includes('decisions');
  const hasActionItems = template.outputs.includes('action_items');

  const relationshipInstructions = hasAgenda
    ? `
## CRITICAL: Relationship Mapping

Since this meeting has an agenda, you MUST establish relationships between items:

1. **Agenda Items**: Extract and assign unique IDs (e.g., "agenda-1", "agenda-2")
2. **Decisions**: Link each decision to relevant agenda item IDs using agendaItemIds array
3. **Action Items**: Link each action to:
   - Agenda items (agendaItemIds) - which topic does this relate to?
   - Decisions (decisionIds) - which decision spawned this action?

**Orphaned Items**: Note any items that don't map to the agenda:
- Decisions made outside the main agenda topics
- Action items not tied to any decision
- Agenda items with no decisions or actions

This relationship mapping is ESSENTIAL for coherent reporting when agenda-style sections are present.
`
    : '';

  return `You are an expert fireground radio traffic evaluator for Austin Fire Department (AFD) Training Division. Your task is to analyze this transcript and extract ALL requested information in a SINGLE structured JSON response.

## Analysis Guidelines

- **Audience**: AFD training staff and company officers
- **Style**: Clear, concise, scannable for training documentation
- **Focus**: Extract only what was explicitly stated on the radio; do NOT speculate
- **Evidence**: Base analysis strictly on transcript content; if not stated, mark as not stated
- **Completeness**: Address ALL sections and outputs requested

${TIMESTAMP_INSTRUCTION}

${sectionInstructions}

${relationshipInstructions}

## Structured Outputs

${
  template.outputs.includes('summary')
    ? `
**Summary**: Provide a concise 3-5 sentence overview of the entire meeting. Capture:
- Main topics discussed
- Key outcomes
- Overall tone/sentiment
- Next steps (if any)
`
    : ''
}

${
  hasActionItems
    ? `
**Action Items**: Extract ALL tasks, assignments, and follow-up items as structured objects:
- Assign unique IDs (e.g., "action-1", "action-2")
- Include: task description, owner (if mentioned), deadline (if mentioned)
- TIMESTAMP IS REQUIRED: Use the [MM:SS] markers in the transcript to determine when the action was mentioned (convert to seconds)
- Link to agenda items and decisions using IDs${hasAgenda ? ' (REQUIRED)' : ' (if applicable)'}
`
    : ''
}

${
  hasDecisions
    ? `
**Decisions**: Extract ALL decisions, resolutions, and conclusions as structured objects:
- Assign unique IDs (e.g., "decision-1", "decision-2")
- Include: decision text, context/rationale, timestamp
- Link to agenda items using IDs${hasAgenda ? ' (REQUIRED)' : ' (if applicable)'}
`
    : ''
}

${
  template.outputs.includes('quotes')
    ? `
**Quotes**: Extract 3-5 notable or impactful quotes:
- Include: exact quote text, speaker (if identifiable), timestamp
- Focus on memorable, insightful, or decision-driving statements
`
    : ''
}

## Timestamp Extraction Example

Given this transcript line:
"[2:45] Sarah: Action item - John will prepare the revised budget by Friday"

You would extract:
{
  "id": "action-1",
  "task": "John will prepare the revised budget by Friday",
  "owner": "John",
  "deadline": "Friday",
  "timestamp": 165
}

The timestamp [2:45] converts to 165 seconds: (2 × 60) + 45 = 165

Given this transcript line:
"[5:30] Manager: We've decided to move forward with Option B"

You would extract:
{
  "id": "decision-1",
  "decision": "Move forward with Option B",
  "timestamp": 330,
  "context": "Selection decision"
}

The timestamp [5:30] converts to 330 seconds: (5 × 60) + 30 = 330

## Output Format

You MUST respond with valid JSON in this EXACT structure:

\`\`\`json
{
  "sections": [
    {
      "name": "Section Name",
      "content": "Extracted content formatted per requirements"
    }
  ],
  ${
    hasAgenda
      ? `"agendaItems": [
    {
      "id": "agenda-1",
      "topic": "Agenda topic",
      "timestamp": 120,
      "context": "Optional context"
    }
  ],`
      : ''
  }
  ${
    hasActionItems
      ? `"actionItems": [
    {
      "id": "action-1",
      "task": "Task description",
      "owner": "Person name",
      "deadline": "Due date",
      "timestamp": 300,
      "agendaItemIds": ["agenda-1"],
      "decisionIds": ["decision-2"]
    }
  ],`
      : ''
  }
  ${
    hasDecisions
      ? `"decisions": [
    {
      "id": "decision-1",
      "decision": "Decision text",
      "timestamp": 240,
      "context": "Rationale",
      "agendaItemIds": ["agenda-1"]
    }
  ],`
      : ''
  }
  ${
    template.outputs.includes('quotes')
      ? `"quotes": [
    {
      "text": "Exact quote",
      "speaker": "Speaker name",
      "timestamp": 180
    }
  ],`
      : ''
  }
  ${template.outputs.includes('summary') ? `"summary": "Overall meeting summary"` : ''}
}
\`\`\`

${supplementalMaterial ? `## Supplemental Source Material

The following supplemental documents and notes have been provided as additional context.
Use this information to inform your analysis, but note that:
- Timestamps and citations should ONLY reference the transcript (not supplemental material)
- Supplemental material provides background context and should be used to understand terminology, prior discussions, or meeting preparation notes
- Do NOT fabricate timestamps for information found only in supplemental material

${supplementalMaterial}

---

` : ''}## Transcript

${transcript}

## Response

Provide your complete analysis as valid JSON following the structure above. Ensure all relationship IDs are correctly assigned and linked.`;
}


/**
 * Parse basic analysis response and convert to AnalysisResults
 *
 * @param response - Raw JSON response from GPT
 * @param template - Template used for analysis
 * @returns Structured AnalysisResults object
 */
export function parseBasicAnalysisResponse(
  response: BasicAnalysisResponse
): AnalysisResults {
  // Convert sections (no evidence in basic mode for speed)
  const sections: AnalysisSection[] = response.sections.map((s) => ({
    name: s.name,
    content: s.content,
    evidence: [], // Basic mode doesn't extract evidence for speed
  }));

  // Convert agenda items
  const agendaItems: AgendaItem[] | undefined = response.agendaItems?.map((item) => ({
    id: item.id,
    topic: item.topic,
    timestamp: item.timestamp,
    context: item.context,
  }));

  // Convert action items
  const actionItems: ActionItem[] | undefined = response.actionItems?.map((item) => ({
    id: item.id,
    task: item.task,
    owner: item.owner,
    deadline: item.deadline,
    timestamp: item.timestamp,
    agendaItemIds: item.agendaItemIds,
    decisionIds: item.decisionIds,
  }));

  // Convert decisions
  const decisions: Decision[] | undefined = response.decisions?.map((item) => ({
    id: item.id,
    decision: item.decision,
    timestamp: item.timestamp,
    context: item.context,
    agendaItemIds: item.agendaItemIds,
  }));

  // Convert quotes
  const quotes: Quote[] | undefined = response.quotes;

  return {
    summary: response.summary,
    sections,
    agendaItems,
    actionItems,
    decisions,
    quotes,
  };
}

/**
 * Validate basic analysis response structure
 *
 * @param data - Parsed JSON data
 * @returns true if valid structure
 */
export function isValidBasicAnalysisResponse(data: unknown): data is BasicAnalysisResponse {
  if (!data || typeof data !== 'object') return false;

  const obj = data as Record<string, unknown>;

  // Must have sections array
  if (!Array.isArray(obj.sections)) return false;

  // Validate each section
  for (const section of obj.sections) {
    if (
      !section ||
      typeof section !== 'object' ||
      typeof section.name !== 'string' ||
      typeof section.content !== 'string'
    ) {
      return false;
    }
  }

  // Optional arrays must be valid if present
  if (obj.agendaItems !== undefined && !Array.isArray(obj.agendaItems)) return false;
  if (obj.actionItems !== undefined && !Array.isArray(obj.actionItems)) return false;
  if (obj.decisions !== undefined && !Array.isArray(obj.decisions)) return false;
  if (obj.quotes !== undefined && !Array.isArray(obj.quotes)) return false;

  // Summary must be string if present
  if (obj.summary !== undefined && typeof obj.summary !== 'string') return false;

  return true;
}

/**
 * Configuration options for basic analysis execution
 */
export interface BasicAnalysisConfig {
  /** Whether to run self-evaluation pass after analysis */
  runEvaluation?: boolean;
  /** Whether to run enrichment pass (requires segments) */
  runEnrichment?: boolean;
  /**
   * Supplemental source material text.
   * Extracted from uploaded Word docs, PDFs, PowerPoints, or pasted text.
   * Included in the prompt as additional context but kept separate from
   * the transcript to preserve timestamp citation logic.
   */
  supplementalMaterial?: string;
}

/**
 * Extended result type that includes evaluation and enrichment metadata
 */
export interface BasicAnalysisResult {
  /** Final analysis results (post-evaluation if runEvaluation=true) */
  results: AnalysisResults;
  /** Draft results before evaluation (only if runEvaluation=true) */
  draftResults?: AnalysisResults;
  /** Evaluation metadata (only if runEvaluation=true) */
  evaluation?: EvaluationResults;
  /** Enrichment metadata (only if runEnrichment=true and segments provided) */
  enrichment?: EnrichmentMetadata;
  /** The prompt used for analysis */
  promptUsed: string;
}

/**
 * Execute basic analysis strategy
 *
 * Main entry point for basic analysis mode. Makes a single API call
 * with comprehensive prompt and returns structured results.
 *
 * @param template - Analysis template
 * @param transcript - Full transcript text
 * @param openaiClient - Azure OpenAI client instance
 * @param deployment - GPT deployment name
 * @param config - Optional configuration (evaluation, enrichment, etc.)
 * @param segments - Optional transcript segments for enrichment
 * @returns Promise<BasicAnalysisResult>
 */
export async function executeBasicAnalysis(
  template: Template,
  transcript: string,
  openaiClient: OpenAI,
  deployment: string,
  config?: BasicAnalysisConfig,
  segments?: TranscriptSegment[]
): Promise<BasicAnalysisResult> {
  const supplementalMaterial = config?.supplementalMaterial;
  console.log('[Basic Analysis] Generating monolithic prompt', {
    hasSupplementalMaterial: !!supplementalMaterial,
    supplementalLength: supplementalMaterial?.length || 0,
  });
  const prompt = generateBasicAnalysisPrompt(template, transcript, supplementalMaterial);

  // Validate token limits before API call
  const validation = validateTokenLimits(transcript, prompt, 'Basic Analysis');
  if (validation.warnings.length > 0) {
    validation.warnings.forEach(w => console.warn(w));
  }
  if (!validation.valid) {
    throw new Error(validation.errors.join('; '));
  }

  console.log('[Basic Analysis] Making single API call', {
    deployment,
    templateSections: template.sections.length,
    outputs: template.outputs,
  });

  const response = await retryWithBackoff(
    async () => {
      const res = await openaiClient.chat.completions.create({
        model: deployment,
        messages: [
          {
            role: 'system',
            content:
              'You are an expert fireground radio traffic evaluator for Austin Fire Department (AFD) Training Division. ' +
              'You provide structured, accurate analysis of radio traffic transcripts. ' +
              'Do not speculate. If information is not in the transcript, state that it is not stated. ' +
              'Always respond with valid JSON only.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_completion_tokens: ANALYSIS_CONSTANTS.MAX_COMPLETION_TOKENS, // GPT-5 requires max_completion_tokens
        response_format: { type: 'json_object' }, // Enforce JSON response
      });

      // Validate response before returning
      const finishReason = res.choices[0].finish_reason;
      const content = res.choices[0].message.content;

      console.log('[Basic Analysis] Received response', {
        tokensUsed: res.usage?.total_tokens,
        finishReason: finishReason,
        contentLength: content?.length ?? 0,
      });

      // Handle content filter - retry as it's likely a false positive
      if (finishReason === 'content_filter') {
        console.warn('[Basic Analysis] Content filter triggered - retrying');
        throw new Error('RETRY'); // Will be caught by retry logic
      }

      // Handle token limit exceeded - fail fast with actionable error
      if (finishReason === 'length') {
        throw new Error(
          'Response truncated due to token limit. ' +
          'The transcript may be too long for Basic strategy. Consider using shorter content.'
        );
      }

      // Handle empty response
      if (!content || content.trim() === '') {
        console.error('[Basic Analysis] Empty response received', {
          finishReason,
          hasContent: !!content,
          contentLength: content?.length ?? 0,
        });
        throw new Error('RETRY'); // Retry for empty responses
      }

      return res;
    },
    3, // Max 3 retry attempts
    2000 // 2 second initial delay
  );

  const content = response.choices[0].message.content;
  if (!content) {
    throw new Error(
      `Empty response from OpenAI (finish_reason: ${response.choices[0].finish_reason})`
    );
  }

  // Parse JSON response
  let parsedResponse: unknown;
  try {
    parsedResponse = JSON.parse(content);
  } catch (error) {
    console.error('[Basic Analysis] Failed to parse JSON response:', error);
    console.error('[Basic Analysis] Response content:', content.substring(0, 500));
    throw new Error('Invalid JSON response from OpenAI');
  }

  // Validate structure
  if (!isValidBasicAnalysisResponse(parsedResponse)) {
    console.error('[Basic Analysis] Invalid response structure');
    throw new Error('Response does not match expected structure');
  }

  // Convert to AnalysisResults
  const rawResults = parseBasicAnalysisResponse(parsedResponse);

  // Post-process: ensure unique IDs and validate relationships
  let draftResults = postProcessResults(rawResults, 'Basic Analysis');

  console.log('[Basic Analysis] Analysis complete', {
    sectionCount: draftResults.sections.length,
    agendaItemCount: draftResults.agendaItems?.length || 0,
    actionItemCount: draftResults.actionItems?.length || 0,
    decisionCount: draftResults.decisions?.length || 0,
    quoteCount: draftResults.quotes?.length || 0,
    hasSummary: !!draftResults.summary,
  });

  // Run enrichment pass if enabled and we have segments
  let enrichmentMetadata: EnrichmentMetadata | undefined;
  const shouldRunEnrichment =
    config?.runEnrichment !== false && // Default to true unless explicitly disabled
    isEnrichmentEnabled() &&
    segments &&
    segments.length > 0 &&
    shouldEnrich(draftResults);

  if (shouldRunEnrichment) {
    console.log('[Basic Analysis] Running enrichment pass');
    try {
      const miniClient = getCitationsClient();
      const miniDeployment = getCitationsDeployment();
      const engine = createMiningEngine(miniClient, miniDeployment);

      // Register default patterns
      engine.registerPattern(actionMiningPattern);
      engine.registerPattern(decisionMiningPattern);
      engine.registerPattern(quoteMiningPattern);

      // Execute enrichment with combined mode for speed
      const enrichmentResult = await engine.executePatterns(
        transcript,
        segments,
        draftResults,
        { mode: 'combined', maxQuotes: 5, minConfidence: 0.6, enabled: true, maxEvidencePerItem: 3 }
      );

      // Merge enriched results back into draft
      draftResults = {
        ...draftResults,
        actionItems: enrichmentResult.results.actionItems?.length
          ? enrichmentResult.results.actionItems
          : draftResults.actionItems,
        decisions: enrichmentResult.results.decisions?.length
          ? enrichmentResult.results.decisions
          : draftResults.decisions,
        quotes: enrichmentResult.results.quotes?.length
          ? enrichmentResult.results.quotes
          : draftResults.quotes,
      };

      enrichmentMetadata = enrichmentResult.metadata;

      console.log('[Basic Analysis] Enrichment complete', {
        enrichmentRun: enrichmentMetadata.enrichmentRun,
        totalDurationMs: enrichmentMetadata.totalDurationMs,
        patternResults: Object.keys(enrichmentMetadata.patternResults || {}),
      });
    } catch (error) {
      // Enrichment failure is non-fatal - log and continue
      console.warn('[Basic Analysis] Enrichment failed, continuing without enrichment:', error);
    }
  }

  // Evaluation disabled for basic mode to reduce latency
  // Basic strategy prioritizes speed over quality refinement
  if (false && config?.runEvaluation) {
    console.log('[Basic Analysis] Running self-evaluation pass');
    const { evaluation, finalResults } = await executeEvaluationPass(
      template,
      transcript,
      draftResults,
      'basic',
      openaiClient,
      deployment,
      [prompt]
    );

    return {
      results: finalResults,
      draftResults,
      evaluation,
      enrichment: enrichmentMetadata,
      promptUsed: prompt,
    };
  }

  // Return draft results without evaluation
  return {
    results: draftResults,
    enrichment: enrichmentMetadata,
    promptUsed: prompt,
  };
}

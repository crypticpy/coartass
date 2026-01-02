/**
 * Self-Evaluation Strategy - Review & Polish Pass
 *
 * Performs a final review pass on draft analysis results to identify
 * improvements, verify completeness, and produce polished final output.
 *
 * Processing Time: 30-45 seconds (single API call)
 * Quality Impact: +10-20% improvement in accuracy and clarity
 *
 * Features:
 * - Comprehensive review across six quality dimensions
 * - Relationship validation and orphaned item detection
 * - Structured improvement tracking
 * - Quality scoring (0-10)
 * - Warning flags for human review
 */

import type {
  Template,
  AnalysisResults,
  EvaluationResults,
} from '@/types';
import type OpenAI from 'openai';
import { generateEvaluatorPrompt } from '@/lib/evaluator-prompt';
import { buildChatCompletionParams } from '@/lib/openai';
import {
  ANALYSIS_CONSTANTS,
  postProcessResults,
  logger,
  validateTokenLimits,
  retryWithBackoff,
  repairTimestamps,
  repairEvidence,
} from './shared';

/**
 * Raw JSON response from evaluation API call
 */
interface EvaluationResponse {
  improvements: string[];
  additions: string[];
  qualityScore: number;
  reasoning: string;
  warnings?: string[];
  orphanedItems?: {
    decisionsWithoutAgenda?: string[];
    actionItemsWithoutDecisions?: string[];
    agendaItemsWithoutDecisions?: string[];
  };
  finalResults: AnalysisResults;
}

/**
 * Check if a value is a valid timestamp (number, not NaN, >= 0)
 */
function isValidTimestamp(value: unknown): boolean {
  return typeof value === 'number' && !isNaN(value) && value >= 0;
}

/**
 * Validate evaluation response structure
 *
 * @param data - Parsed JSON data
 * @returns true if valid structure
 */
export function isValidEvaluationResponse(data: unknown): data is EvaluationResponse {
  if (!data || typeof data !== 'object') return false;

  const obj = data as Record<string, unknown>;

  // Required fields
  if (!Array.isArray(obj.improvements)) return false;
  if (!Array.isArray(obj.additions)) return false;

  // Quality score validation (must be 0-10)
  if (
    typeof obj.qualityScore !== 'number' ||
    obj.qualityScore < 0 ||
    obj.qualityScore > 10
  ) {
    return false;
  }

  if (typeof obj.reasoning !== 'string' || obj.reasoning.length === 0) return false;
  if (!obj.finalResults || typeof obj.finalResults !== 'object') return false;

  // Validate finalResults structure more thoroughly
  const finalResults = obj.finalResults as Record<string, unknown>;
  if (!Array.isArray(finalResults.sections)) return false;

  // Validate each section has required fields
  for (const section of finalResults.sections) {
    if (!section || typeof section !== 'object') return false;
    const s = section as Record<string, unknown>;
    if (typeof s.name !== 'string' || typeof s.content !== 'string') {
      return false;
    }
  }

  // Validate agendaItems structure (timestamp optional)
  if (finalResults.agendaItems !== undefined) {
    if (!Array.isArray(finalResults.agendaItems)) return false;
    for (const item of finalResults.agendaItems) {
      if (!item || typeof item !== 'object') return false;
      const a = item as Record<string, unknown>;
      if (typeof a.id !== 'string' || typeof a.topic !== 'string') return false;
      // Timestamp is optional for agenda items, but if present must be valid
      if (a.timestamp !== undefined && !isValidTimestamp(a.timestamp)) return false;
    }
  }

  // Validate actionItems structure (timestamp REQUIRED)
  if (finalResults.actionItems !== undefined) {
    if (!Array.isArray(finalResults.actionItems)) return false;
    for (const item of finalResults.actionItems) {
      if (!item || typeof item !== 'object') return false;
      const a = item as Record<string, unknown>;
      if (typeof a.id !== 'string' || typeof a.task !== 'string') return false;
      // Timestamp is REQUIRED for action items
      if (!isValidTimestamp(a.timestamp)) {
        logger.warn('Evaluation Pass', `Action item "${a.id}" has invalid timestamp: ${a.timestamp}`);
        return false;
      }
    }
  }

  // Validate decisions structure (timestamp REQUIRED)
  if (finalResults.decisions !== undefined) {
    if (!Array.isArray(finalResults.decisions)) return false;
    for (const item of finalResults.decisions) {
      if (!item || typeof item !== 'object') return false;
      const d = item as Record<string, unknown>;
      if (typeof d.id !== 'string' || typeof d.decision !== 'string') return false;
      // Timestamp is REQUIRED for decisions
      if (!isValidTimestamp(d.timestamp)) {
        logger.warn('Evaluation Pass', `Decision "${d.id}" has invalid timestamp: ${d.timestamp}`);
        return false;
      }
    }
  }

  // Validate quotes structure (timestamp REQUIRED)
  if (finalResults.quotes !== undefined) {
    if (!Array.isArray(finalResults.quotes)) return false;
    for (const item of finalResults.quotes) {
      if (!item || typeof item !== 'object') return false;
      const q = item as Record<string, unknown>;
      if (typeof q.text !== 'string') return false;
      // Timestamp is REQUIRED for quotes
      if (!isValidTimestamp(q.timestamp)) {
        logger.warn('Evaluation Pass', `Quote has invalid timestamp: ${q.timestamp}`);
        return false;
      }
    }
  }

  // Optional arrays must be valid if present
  if (obj.warnings !== undefined && !Array.isArray(obj.warnings)) return false;
  if (obj.orphanedItems !== undefined) {
    if (typeof obj.orphanedItems !== 'object') return false;
    const orphaned = obj.orphanedItems as Record<string, unknown>;
    if (
      orphaned.decisionsWithoutAgenda !== undefined &&
      !Array.isArray(orphaned.decisionsWithoutAgenda)
    ) {
      return false;
    }
    if (
      orphaned.actionItemsWithoutDecisions !== undefined &&
      !Array.isArray(orphaned.actionItemsWithoutDecisions)
    ) {
      return false;
    }
    if (
      orphaned.agendaItemsWithoutDecisions !== undefined &&
      !Array.isArray(orphaned.agendaItemsWithoutDecisions)
    ) {
      return false;
    }
  }

  return true;
}

/**
 * Execute self-evaluation pass on draft analysis results
 *
 * Takes draft results from any analysis strategy and performs a comprehensive
 * review to identify improvements, verify accuracy, and produce final polished output.
 *
 * @param template - Analysis template used for draft
 * @param transcript - Full transcript text
 * @param draftResults - Draft analysis results to review
 * @param analysisStrategy - Strategy used for draft ('basic', 'hybrid', or 'advanced')
 * @param openaiClient - Azure OpenAI client instance
 * @param deployment - GPT deployment name
 * @param promptsUsed - Optional array of prompts used during analysis
 * @returns Promise<{ evaluation: EvaluationResults, finalResults: AnalysisResults }>
 */
export async function executeEvaluationPass(
  template: Template,
  transcript: string,
  draftResults: AnalysisResults,
  analysisStrategy: string,
  openaiClient: OpenAI,
  deployment: string,
  promptsUsed?: string[]
): Promise<{ evaluation: EvaluationResults; finalResults: AnalysisResults }> {
  try {
    logger.info('Evaluation Pass', 'Starting self-evaluation review', {
      strategy: analysisStrategy,
      draftSections: draftResults.sections.length,
      draftAgendaItems: draftResults.agendaItems?.length || 0,
      draftDecisions: draftResults.decisions?.length || 0,
      draftActionItems: draftResults.actionItems?.length || 0,
    });

    // Generate evaluation prompt
    let prompt = generateEvaluatorPrompt(
      template,
      transcript,
      draftResults,
      analysisStrategy,
      promptsUsed
    );

    // Validate token limits with adaptive handling
    const validation = validateTokenLimits(transcript, prompt, 'Evaluation Pass');
    if (validation.warnings.length > 0) {
      validation.warnings.forEach((w) => logger.warn('Evaluation Pass', w));
    }

    if (!validation.valid) {
      // Try truncated version without prompts
      logger.warn(
        'Evaluation Pass',
        'Token limit exceeded, retrying with truncated prompt'
      );

      prompt = generateEvaluatorPrompt(
        template,
        transcript,
        draftResults,
        analysisStrategy,
        undefined // Skip prompts used
      );

      const revalidation = validateTokenLimits(transcript, prompt, 'Evaluation Pass');
      if (!revalidation.valid) {
        // Still too large - return draft results with warning
        logger.error(
          'Evaluation Pass',
          'Cannot fit within token limits even with truncation, skipping evaluation'
        );
        return {
          evaluation: {
            improvements: [],
            additions: [],
            qualityScore: 0,
            reasoning: 'Evaluation skipped due to token limit constraints',
            warnings: ['Transcript too long for evaluation pass - returning draft as-is'],
          },
          finalResults: draftResults,
        };
      }
    }

  logger.info('Evaluation Pass', 'Making API call for review', {
    deployment,
    templateName: template.name,
  });

  // Make API call with retry logic
  // Use buildChatCompletionParams for consistent model params with medium reasoning effort
  const modelParams = buildChatCompletionParams(
    deployment,
    ANALYSIS_CONSTANTS.MAX_COMPLETION_TOKENS,
    undefined, // temperature not used for GPT-5
    'medium'   // reasoning_effort for gpt-5.2
  );

  const response = await retryWithBackoff(
    async () => {
      const res = await openaiClient.chat.completions.create({
        model: deployment,
        messages: [
          {
            role: 'system',
            content:
              'You are a senior analyst reviewing meeting analysis for accuracy, completeness, ' +
              'and clarity. You identify improvements and produce polished final results. ' +
              'Always respond with valid JSON.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        ...modelParams,
        response_format: { type: 'json_object' }, // Enforce JSON response
      });

      // Validate response before returning
      const finishReason = res.choices[0].finish_reason;
      const content = res.choices[0].message.content;

      logger.info('Evaluation Pass', 'Received evaluation response', {
        tokensUsed: res.usage?.total_tokens,
        finishReason: finishReason,
        contentLength: content?.length ?? 0,
      });

      // Handle content filter - retry as it's likely a false positive
      if (finishReason === 'content_filter') {
        logger.warn('Evaluation Pass', 'Content filter triggered - retrying');
        throw new Error('RETRY'); // Will be caught by retry logic
      }

      // Handle token limit exceeded - fail fast with actionable error
      if (finishReason === 'length') {
        throw new Error(
          'Evaluation response truncated due to token limit. ' +
          'The draft results may be too large for evaluation.'
        );
      }

      // Handle empty response
      if (!content || content.trim() === '') {
        logger.error('Evaluation Pass', 'Empty response received', {
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
    logger.error('Evaluation Pass', 'Failed to parse JSON response', {
      error,
      contentPreview: content.substring(0, 500),
    });
    throw new Error('Invalid JSON response from OpenAI');
  }

  // Validate structure
  if (!isValidEvaluationResponse(parsedResponse)) {
    logger.error('Evaluation Pass', 'Invalid response structure');
    throw new Error('Response does not match expected evaluation structure');
  }

  // Extract evaluation metadata
  const evaluation: EvaluationResults = {
    improvements: parsedResponse.improvements,
    additions: parsedResponse.additions,
    qualityScore: parsedResponse.qualityScore,
    reasoning: parsedResponse.reasoning,
    warnings: parsedResponse.warnings,
    orphanedItems: parsedResponse.orphanedItems,
  };

  // Post-process final results (ensure unique IDs and validate relationships)
  const processedResults = postProcessResults(
    parsedResponse.finalResults,
    'Evaluation Pass'
  );

  // Repair any timestamps that are suspiciously 0 (LLM may have "preserved" wrong value)
  // Also catches any edge cases where validation passed but timestamp is still problematic
  const timestampRepaired = repairTimestamps(processedResults, draftResults);

  // Repair malformed evidence arrays (LLM may return null, undefined, or incomplete evidence)
  const finalResults = repairEvidence(timestampRepaired);

  logger.info('Evaluation Pass', 'Evaluation complete', {
    qualityScore: evaluation.qualityScore,
    improvementsCount: evaluation.improvements.length,
    additionsCount: evaluation.additions.length,
    warningsCount: evaluation.warnings?.length || 0,
    finalSections: finalResults.sections.length,
    finalAgendaItems: finalResults.agendaItems?.length || 0,
    finalDecisions: finalResults.decisions?.length || 0,
    finalActionItems: finalResults.actionItems?.length || 0,
  });

  // Log quality assessment
  if (evaluation.qualityScore >= 9) {
    logger.info('Evaluation Pass', 'Quality: EXCELLENT - Minor polish only');
  } else if (evaluation.qualityScore >= 7) {
    logger.info('Evaluation Pass', 'Quality: GOOD - Some improvements made');
  } else if (evaluation.qualityScore >= 5) {
    logger.info('Evaluation Pass', 'Quality: FAIR - Moderate revisions needed');
  } else {
    logger.warn('Evaluation Pass', 'Quality: POOR - Significant issues identified');
  }

  // Log orphaned items if any
  if (evaluation.orphanedItems) {
    const orphaned = evaluation.orphanedItems;
    if (orphaned.decisionsWithoutAgenda && orphaned.decisionsWithoutAgenda.length > 0) {
      logger.warn(
        'Evaluation Pass',
        `Found ${orphaned.decisionsWithoutAgenda.length} decisions without agenda items`
      );
    }
    if (
      orphaned.actionItemsWithoutDecisions &&
      orphaned.actionItemsWithoutDecisions.length > 0
    ) {
      logger.warn(
        'Evaluation Pass',
        `Found ${orphaned.actionItemsWithoutDecisions.length} action items without decisions`
      );
    }
    if (
      orphaned.agendaItemsWithoutDecisions &&
      orphaned.agendaItemsWithoutDecisions.length > 0
    ) {
      logger.info(
        'Evaluation Pass',
        `Found ${orphaned.agendaItemsWithoutDecisions.length} agenda items without decisions (may be discussion-only)`
      );
    }
  }

    return {
      evaluation,
      finalResults,
    };
  } catch (error) {
    // Fallback: Return draft results if evaluation fails
    logger.error('Evaluation Pass', 'Evaluation failed, returning draft results', error);

    return {
      evaluation: {
        improvements: [],
        additions: [],
        qualityScore: 0,
        reasoning: `Evaluation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        warnings: ['Evaluation pass failed - returning draft results as-is'],
      },
      finalResults: draftResults,
    };
  }
}

/**
 * Compare draft and final results to generate improvement summary
 *
 * Useful for UI display showing what changed during evaluation.
 *
 * @param draft - Draft results before evaluation
 * @param final - Final results after evaluation
 * @returns Object with comparison statistics
 */
export function compareResults(
  draft: AnalysisResults,
  final: AnalysisResults
): {
  sectionsChanged: number;
  agendaItemsAdded: number;
  decisionsAdded: number;
  actionItemsAdded: number;
  relationshipsAdded: number;
} {
  const draftAgendaCount = draft.agendaItems?.length || 0;
  const finalAgendaCount = final.agendaItems?.length || 0;

  const draftDecisionCount = draft.decisions?.length || 0;
  const finalDecisionCount = final.decisions?.length || 0;

  const draftActionCount = draft.actionItems?.length || 0;
  const finalActionCount = final.actionItems?.length || 0;

  // Count relationship links in draft
  const draftRelationships =
    (draft.decisions?.reduce(
      (sum, d) => sum + (d.agendaItemIds?.length || 0),
      0
    ) || 0) +
    (draft.actionItems?.reduce(
      (sum, a) =>
        sum + (a.agendaItemIds?.length || 0) + (a.decisionIds?.length || 0),
      0
    ) || 0);

  // Count relationship links in final
  const finalRelationships =
    (final.decisions?.reduce(
      (sum, d) => sum + (d.agendaItemIds?.length || 0),
      0
    ) || 0) +
    (final.actionItems?.reduce(
      (sum, a) =>
        sum + (a.agendaItemIds?.length || 0) + (a.decisionIds?.length || 0),
      0
    ) || 0);

  // Count sections with changed content
  let sectionsChanged = 0;
  final.sections.forEach((finalSection) => {
    const draftSection = draft.sections.find((s) => s.name === finalSection.name);
    if (draftSection && draftSection.content !== finalSection.content) {
      sectionsChanged++;
    }
  });

  return {
    sectionsChanged,
    agendaItemsAdded: finalAgendaCount - draftAgendaCount,
    decisionsAdded: finalDecisionCount - draftDecisionCount,
    actionItemsAdded: finalActionCount - draftActionCount,
    relationshipsAdded: finalRelationships - draftRelationships,
  };
}

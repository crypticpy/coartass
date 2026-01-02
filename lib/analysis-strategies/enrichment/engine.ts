/**
 * Mining Engine Core
 *
 * Orchestrates enrichment patterns for post-extraction enhancement.
 * Provides a pluggable architecture for adding new mining patterns.
 *
 * Design:
 * - Patterns are registered and executed against analysis results
 * - Combined mode runs all patterns in one API call (faster)
 * - Separate mode runs each pattern individually (cleaner)
 * - Results are merged back into the original analysis
 */

import type OpenAI from 'openai';
import type {
  MiningPattern,
  MiningContext,
  MiningSegment,
  MiningResult,
  EnrichmentConfig,
  EnrichedResults,
  EnrichmentMetadata,
} from '@/types/enrichment';
import type { AnalysisResults, TranscriptSegment } from '@/types';
import { DEFAULT_ENRICHMENT_CONFIG } from '@/types/enrichment';

import { buildCombinedEnrichmentPrompt, buildPatternPrompt } from './prompts';
import {
  mergeEnrichmentPartial,
  shouldEnrich,
  retryWithBackoff,
  type PartialEnrichmentResult,
} from './utils';

// ============================================================================
// Segment Conversion Helper
// ============================================================================

/**
 * Convert TranscriptSegments to MiningSegments by adding unique IDs.
 * IDs are formatted as "seg-{index}" for stable reference in prompts.
 */
function toMiningSegments(segments: TranscriptSegment[]): MiningSegment[] {
  return segments.map((segment, index) => ({
    ...segment,
    id: `seg-${index}`,
  }));
}

// ============================================================================
// Mining Engine Interface
// ============================================================================

export interface MiningEngine {
  /**
   * Register a mining pattern with the engine.
   * @param pattern - The pattern to register
   */
  registerPattern<T>(pattern: MiningPattern<T>): void;

  /**
   * Unregister a pattern by name.
   * @param patternName - Name of the pattern to remove
   */
  unregisterPattern(patternName: string): void;

  /**
   * Get a registered pattern by name.
   * @param patternName - Name of the pattern
   */
  getPattern<T>(patternName: string): MiningPattern<T> | undefined;

  /**
   * List all registered pattern names.
   */
  listPatterns(): string[];

  /**
   * Execute all registered patterns on the given analysis results.
   * @param transcript - Full transcript text
   * @param segments - Parsed transcript segments
   * @param results - Current analysis results to enrich
   * @param config - Optional configuration override
   * @returns Enriched results with metadata
   */
  executePatterns(
    transcript: string,
    segments: TranscriptSegment[],
    results: AnalysisResults,
    config?: Partial<EnrichmentConfig>
  ): Promise<{ results: EnrichedResults; metadata: EnrichmentMetadata }>;

  /**
   * Execute a specific pattern by name.
   * @param patternName - Name of the pattern to execute
   * @param context - Mining context
   * @returns Mining result from the pattern
   */
  executePattern<T>(
    patternName: string,
    context: MiningContext
  ): Promise<MiningResult<T>>;
}

// ============================================================================
// Engine Implementation
// ============================================================================

/**
 * Create a new mining engine instance.
 *
 * @param openaiClient - OpenAI client for API calls
 * @param deployment - Model deployment name (e.g., 'gpt-4.1-mini')
 * @returns Configured mining engine
 */
export function createMiningEngine(
  openaiClient: OpenAI,
  deployment: string
): MiningEngine {
  // Pattern registry
  const patterns = new Map<string, MiningPattern<unknown>>();

  /**
   * Execute combined enrichment (all patterns in one call).
   * Used by Basic strategy for speed.
   */
  async function executeCombined(
    context: MiningContext
  ): Promise<{ partialResult: PartialEnrichmentResult; patternResults: Record<string, PatternResultSummary> }> {
    const startTime = Date.now();
    const patternResults: Record<string, PatternResultSummary> = {};

    // Build combined prompt for all registered patterns
    const prompt = buildCombinedEnrichmentPrompt(context, Array.from(patterns.keys()));

    try {
      const response = await retryWithBackoff(
        async () => {
          const res = await openaiClient.chat.completions.create({
            model: deployment,
            messages: [
              {
                role: 'system',
                content:
                  'You are an expert at enriching meeting analysis with additional context. ' +
                  'You only reference provided transcript segments. You never invent quotes or timestamps. ' +
                  'You always return valid JSON matching the requested schema.',
              },
              { role: 'user', content: prompt },
            ],
            temperature: 0.2,
            max_completion_tokens: 4000,
            response_format: { type: 'json_object' },
          });

          const finishReason = res.choices[0].finish_reason;
          const content = res.choices[0].message.content;
          if (finishReason === 'content_filter') throw new Error('RETRY');
          if (!content || content.trim() === '') throw new Error('RETRY');
          return res;
        },
        3,
        500
      );

      const content = response.choices[0].message.content;
      if (!content) {
        throw new Error('Empty response from model');
      }

      const parsed = JSON.parse(content) as CombinedEnrichmentResponse;
      const durationMs = Date.now() - startTime;

      // Build partial enrichment result for merging
      // Map response types to PartialEnrichmentResult format
      const partialResult: PartialEnrichmentResult = {
        actionEnrichments: (parsed.actionItems ?? []).map((a) => ({
          id: a.id,
          assignedBy: a.assignedBy,
          assignmentTimestamp: a.assignmentTimestamp,
          priority: a.priority,
          isExplicit: a.isExplicit,
          confidence: a.confidence,
        })),
        decisionEnrichments: (parsed.decisions ?? []).map((d) => ({
          id: d.id,
          madeBy: d.madeBy,
          participants: d.participants,
          isExplicit: d.isExplicit,
          voteTally: d.voteTally,
          confidence: d.confidence,
        })),
        newQuotes: (parsed.quotes ?? []).map((q) => ({
          text: q.text,
          speaker: q.speaker,
          timestamp: q.timestamp,
          context: q.context,
          category: q.category,
          sentiment: q.sentiment,
          confidence: q.confidence,
        })),
      };

      // Record pattern results
      for (const patternName of patterns.keys()) {
        let itemsEnriched = 0;
        if (patternName === 'action-mining') {
          itemsEnriched = partialResult.actionEnrichments.length;
        } else if (patternName === 'decision-mining') {
          itemsEnriched = partialResult.decisionEnrichments.length;
        } else if (patternName === 'quote-mining') {
          itemsEnriched = partialResult.newQuotes.length;
        }

        patternResults[patternName] = {
          success: true,
          itemsEnriched,
          durationMs: Math.round(durationMs / patterns.size),
        };
      }

      return { partialResult, patternResults };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Mark all patterns as failed
      for (const patternName of patterns.keys()) {
        patternResults[patternName] = {
          success: false,
          itemsEnriched: 0,
          durationMs,
          error: errorMessage,
        };
      }

      return {
        partialResult: {
          actionEnrichments: [],
          decisionEnrichments: [],
          newQuotes: [],
        },
        patternResults,
      };
    }
  }

  /**
   * Execute patterns separately (individual API calls per pattern).
   * Used by Hybrid/Advanced strategies for quality.
   */
  async function executeSeparate(
    context: MiningContext
  ): Promise<{ partialResult: PartialEnrichmentResult; patternResults: Record<string, PatternResultSummary> }> {
    const patternResults: Record<string, PatternResultSummary> = {};
    const partialResult: PartialEnrichmentResult = {
      actionEnrichments: [],
      decisionEnrichments: [],
      newQuotes: [],
    };

    // Execute each pattern sequentially to avoid rate limits
    for (const [patternName, pattern] of patterns.entries()) {
      const startTime = Date.now();

      try {
        const prompt = buildPatternPrompt(patternName, context);

        const response = await retryWithBackoff(
          async () => {
            const res = await openaiClient.chat.completions.create({
              model: deployment,
              messages: [
                {
                  role: 'system',
                  content:
                    `You are an expert at ${pattern.description}. ` +
                    'You only reference provided transcript segments. You never invent quotes or timestamps. ' +
                    'You always return valid JSON matching the requested schema.',
                },
                { role: 'user', content: prompt },
              ],
              temperature: 0.2,
              max_completion_tokens: 2500,
              response_format: { type: 'json_object' },
            });

            const finishReason = res.choices[0].finish_reason;
            const content = res.choices[0].message.content;
            if (finishReason === 'content_filter') throw new Error('RETRY');
            if (!content || content.trim() === '') throw new Error('RETRY');
            return res;
          },
          3,
          500
        );

        const content = response.choices[0].message.content;
        if (!content) {
          throw new Error('Empty response from model');
        }

        const parsed = JSON.parse(content);
        const durationMs = Date.now() - startTime;

        // Merge pattern-specific results
        let itemsEnriched = 0;
        if (patternName === 'action-mining' && parsed.actionItems) {
          partialResult.actionEnrichments = parsed.actionItems.map((a: ActionEnrichmentResponse) => ({
            id: a.id,
            assignedBy: a.assignedBy,
            assignmentTimestamp: a.assignmentTimestamp,
            priority: a.priority,
            isExplicit: a.isExplicit,
            confidence: a.confidence,
          }));
          itemsEnriched = parsed.actionItems.length;
        } else if (patternName === 'decision-mining' && parsed.decisions) {
          partialResult.decisionEnrichments = parsed.decisions.map((d: DecisionEnrichmentResponse) => ({
            id: d.id,
            madeBy: d.madeBy,
            participants: d.participants,
            isExplicit: d.isExplicit,
            voteTally: d.voteTally,
            confidence: d.confidence,
          }));
          itemsEnriched = parsed.decisions.length;
        } else if (patternName === 'quote-mining' && parsed.quotes) {
          partialResult.newQuotes = parsed.quotes.map((q: QuoteExtractionResponse) => ({
            text: q.text,
            speaker: q.speaker,
            timestamp: q.timestamp,
            context: q.context,
            category: q.category,
            sentiment: q.sentiment,
            confidence: q.confidence,
          }));
          itemsEnriched = parsed.quotes.length;
        }

        patternResults[patternName] = {
          success: true,
          itemsEnriched,
          durationMs,
        };

        // Validate if pattern has validator
        if (pattern.validate && parsed.items) {
          const isValid = pattern.validate(parsed.items);
          if (!isValid) {
            console.warn(`[MiningEngine] Pattern ${patternName} validation failed`);
          }
        }
      } catch (error) {
        const durationMs = Date.now() - startTime;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        patternResults[patternName] = {
          success: false,
          itemsEnriched: 0,
          durationMs,
          error: errorMessage,
        };
      }
    }

    return { partialResult, patternResults };
  }

  // Return the engine interface
  return {
    registerPattern<T>(pattern: MiningPattern<T>): void {
      patterns.set(pattern.name, pattern as MiningPattern<unknown>);
    },

    unregisterPattern(patternName: string): void {
      patterns.delete(patternName);
    },

    getPattern<T>(patternName: string): MiningPattern<T> | undefined {
      return patterns.get(patternName) as MiningPattern<T> | undefined;
    },

    listPatterns(): string[] {
      return Array.from(patterns.keys());
    },

    async executePatterns(
      transcript: string,
      segments: TranscriptSegment[],
      results: AnalysisResults,
      config?: Partial<EnrichmentConfig>
    ): Promise<{ results: EnrichedResults; metadata: EnrichmentMetadata }> {
      const startTime = Date.now();
      const fullConfig: EnrichmentConfig = { ...DEFAULT_ENRICHMENT_CONFIG, ...config };

      // Check if enrichment should run
      if (!fullConfig.enabled || !shouldEnrich(results)) {
        return {
          results: { actionItems: [], decisions: [], quotes: [] },
          metadata: {
            enrichmentRun: false,
            mode: fullConfig.mode,
            enrichedAt: new Date(),
            totalDurationMs: 0,
            model: deployment,
            patternResults: {},
          },
        };
      }

      // Build mining context
      const context: MiningContext = {
        transcript,
        segments: toMiningSegments(segments),
        existingResults: results,
        config: fullConfig,
      };

      // Execute based on mode
      let partialResult: PartialEnrichmentResult;
      let patternResults: Record<string, PatternResultSummary>;

      if (fullConfig.mode === 'combined') {
        const combined = await executeCombined(context);
        partialResult = combined.partialResult;
        patternResults = combined.patternResults;
      } else {
        const separate = await executeSeparate(context);
        partialResult = separate.partialResult;
        patternResults = separate.patternResults;
      }

      const totalDurationMs = Date.now() - startTime;

      // Build metadata
      const metadata: EnrichmentMetadata = {
        enrichmentRun: true,
        mode: fullConfig.mode,
        enrichedAt: new Date(),
        totalDurationMs,
        model: deployment,
        patternResults,
      };

      // Merge enrichment back into original results
      const mergedResults = mergeEnrichmentPartial(results, partialResult);

      return {
        results: mergedResults,
        metadata,
      };
    },

    async executePattern<T>(
      patternName: string,
      context: MiningContext
    ): Promise<MiningResult<T>> {
      const pattern = patterns.get(patternName) as MiningPattern<T> | undefined;
      const emptyMetadata = {
        itemsProcessed: 0,
        itemsEnriched: 0,
        confidence: 0,
        processingTimeMs: 0,
      };

      if (!pattern) {
        return {
          data: [] as unknown as T,
          error: `Pattern '${patternName}' not found`,
          metadata: emptyMetadata,
        };
      }

      // Check if pattern should run
      if (!pattern.shouldRun(context)) {
        return {
          data: [] as unknown as T,
          metadata: emptyMetadata,
        };
      }

      const startTime = Date.now();

      try {
        // Build prompt and call API
        const prompt = pattern.buildPrompt(context);

        const response = await retryWithBackoff(
          async () => {
            const res = await openaiClient.chat.completions.create({
              model: deployment,
              messages: [
                {
                  role: 'system',
                  content:
                    'You are an expert at enriching meeting analysis with additional context. ' +
                    'You only reference provided transcript segments. You never invent quotes or timestamps. ' +
                    'You always return valid JSON matching the requested schema.',
                },
                { role: 'user', content: prompt },
              ],
              temperature: 0.2,
              max_completion_tokens: 4000,
              response_format: { type: 'json_object' },
            });

            const finishReason = res.choices[0].finish_reason;
            const content = res.choices[0].message.content;
            if (finishReason === 'content_filter') throw new Error('RETRY');
            if (!content || content.trim() === '') throw new Error('RETRY');
            return res;
          },
          3,
          500
        );

        const content = response.choices[0].message.content!;
        const result = pattern.parseResponse(content);
        const processingTimeMs = Date.now() - startTime;

        return {
          data: result.data,
          metadata: {
            ...result.metadata,
            processingTimeMs,
          },
          error: result.error,
        };
      } catch (error) {
        const processingTimeMs = Date.now() - startTime;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        return {
          data: [] as unknown as T,
          error: errorMessage,
          metadata: {
            ...emptyMetadata,
            processingTimeMs,
          },
        };
      }
    },
  };
}

// ============================================================================
// Internal Types
// ============================================================================

interface PatternResultSummary {
  success: boolean;
  itemsEnriched: number;
  durationMs: number;
  error?: string;
}

/**
 * Partial enrichment fields for action items from API response.
 * These get merged with original ActionItem objects.
 */
interface ActionEnrichmentResponse {
  id: string;
  assignedBy?: string;
  assignmentTimestamp?: number;
  priority?: 'high' | 'medium' | 'low';
  isExplicit?: boolean;
  confidence?: number;
}

/**
 * Partial enrichment fields for decisions from API response.
 * These get merged with original Decision objects.
 */
interface DecisionEnrichmentResponse {
  id: string;
  madeBy?: string;
  participants?: string[];
  isExplicit?: boolean;
  voteTally?: { for: number; against: number; abstain: number };
  confidence?: number;
}

/**
 * New quotes extracted by the mining engine.
 * These are complete Quote objects with enrichment fields.
 */
interface QuoteExtractionResponse {
  text: string;
  speaker?: string;
  timestamp: number;
  context?: string;
  category?: 'decision' | 'commitment' | 'concern' | 'insight' | 'humor';
  sentiment?: 'positive' | 'negative' | 'neutral';
  confidence?: number;
}

/**
 * Combined response from the enrichment API.
 * Contains partial enrichment data, not full objects.
 */
interface CombinedEnrichmentResponse {
  actionItems?: ActionEnrichmentResponse[];
  decisions?: DecisionEnrichmentResponse[];
  quotes?: QuoteExtractionResponse[];
}

// ============================================================================
// Utility: Check if enrichment is enabled via environment
// ============================================================================

/**
 * Check if enrichment is enabled via environment variable.
 */
export function isEnrichmentEnabled(): boolean {
  const envValue = process.env.ENRICHMENT_ENABLED;
  if (envValue === undefined) return true; // Default to enabled
  return envValue.toLowerCase() !== 'false' && envValue !== '0';
}

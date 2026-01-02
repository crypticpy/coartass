/**
 * Analysis Strategies - Unified Entry Point
 *
 * Provides a single interface for executing transcript analysis using
 * any of the three available strategies (basic, hybrid, advanced).
 *
 * Features:
 * - Automatic strategy selection based on transcript length
 * - Strategy fallback: advanced -> hybrid -> basic
 * - Circuit breaker pattern for repeated failures
 * - Partial results recovery when analysis partially completes
 * - Graceful degradation ensuring analysis always returns a result
 */

import type { Template, AnalysisResults, EvaluationResults, TranscriptSegment } from '@/types';
import type { AnalysisStrategy } from '@/lib/analysis-strategy';
import type OpenAI from 'openai';
import { recommendStrategy, getStrategyMetadata } from '@/lib/analysis-strategy';
import { estimateTokens } from '@/lib/token-utils';

// Import all strategy executors
import {
  executeBasicAnalysis,
  type BasicAnalysisConfig,
  type BasicAnalysisResult,
} from './basic';
import {
  executeHybridAnalysis,
  type HybridAnalysisConfig,
  type HybridAnalysisResult,
} from './hybrid';
import {
  executeAdvancedAnalysis,
  type AdvancedAnalysisConfig,
  type AdvancedAnalysisResult,
} from './advanced';

// Import error handling
import {
  AnalysisErrorCode,
  StrategyError,
  PartialResultsError,
  AllStrategiesFailedError,
  hasPartialResults,
  wrapError,
} from './errors';

// Import shared utilities
import { logger, classifyError } from './shared';

// Re-export shared utilities
export * from './shared';

// Re-export evaluator
export * from './evaluator';

// Re-export errors
export * from './errors';

/**
 * Configuration for analysis execution
 */
export interface AnalysisConfig {
  /**
   * Strategy to use for analysis.
   * If 'auto', strategy is selected based on transcript length.
   * Defaults to 'auto'.
   */
  strategy?: AnalysisStrategy | 'auto';

  /**
   * Whether to run self-evaluation pass after main analysis.
   * Adds 30-45 seconds but improves quality by 10-20%.
   * Defaults to true.
   */
  runEvaluation?: boolean;

  /**
   * Optional callback for progress updates.
   * Called at various stages during analysis.
   */
  progressCallback?: (current: number, total: number, message: string) => void;

  /**
   * Whether to enable strategy fallback on failure.
   * If true, will try simpler strategies (advanced -> hybrid -> basic) on failure.
   * Defaults to true.
   */
  enableFallback?: boolean;

  /**
   * Whether to return partial results if analysis fails partway through.
   * Defaults to true.
   */
  returnPartialResults?: boolean;

  /**
   * Maximum number of strategy fallback attempts.
   * Defaults to 3 (all strategies).
   */
  maxFallbackAttempts?: number;

  /**
   * Transcript segments for enrichment.
   * If provided, enrichment will run after extraction.
   */
  segments?: TranscriptSegment[];

  /**
   * Supplemental source material text.
   * Extracted text from uploaded Word docs, PDFs, PowerPoints, or pasted text.
   * This is injected into prompts separately from transcript to preserve
   * timestamp citation logic.
   */
  supplementalMaterial?: string;
}

/**
 * Unified result type for all strategies
 */
export interface AnalysisExecutionResult {
  /** The strategy that was used */
  strategy: AnalysisStrategy;

  /** Final analysis results (post-evaluation if runEvaluation=true) */
  results: AnalysisResults;

  /** Draft results before evaluation (only if runEvaluation=true) */
  draftResults?: AnalysisResults;

  /** Evaluation metadata (only if runEvaluation=true) */
  evaluation?: EvaluationResults;

  /** Array of prompts used during analysis */
  promptsUsed: string[];

  /** Metadata about the strategy used */
  metadata: {
    estimatedDuration: string;
    apiCalls: string;
    quality: string;
    actualTokens: number;
    wasAutoSelected: boolean;
    /** Whether a fallback strategy was used */
    usedFallback?: boolean;
    /** Original strategy that failed (if fallback was used) */
    originalStrategy?: AnalysisStrategy;
    /** Whether results are partial due to errors */
    isPartial?: boolean;
    /** Sections that failed (if partial) */
    failedSections?: string[];
    /** Circuit breaker state */
    circuitBreakerTripped?: boolean;
  };

  /** Warnings about the analysis process */
  warnings?: string[];
}

/**
 * Strategy fallback order: more complex -> simpler
 */
const STRATEGY_FALLBACK_ORDER: AnalysisStrategy[] = ['advanced', 'hybrid', 'basic'];

/**
 * Get the next fallback strategy.
 *
 * @param currentStrategy - Strategy that failed
 * @returns Next simpler strategy or null if none available
 */
function getNextFallbackStrategy(currentStrategy: AnalysisStrategy): AnalysisStrategy | null {
  const currentIndex = STRATEGY_FALLBACK_ORDER.indexOf(currentStrategy);

  if (currentIndex === -1 || currentIndex >= STRATEGY_FALLBACK_ORDER.length - 1) {
    return null; // No simpler strategy available
  }

  return STRATEGY_FALLBACK_ORDER[currentIndex + 1];
}

/**
 * Circuit breaker state for tracking failures per session.
 * Prevents repeated attempts with failing strategies.
 */
interface CircuitBreakerState {
  /** Count of consecutive failures */
  failureCount: number;

  /** Timestamp of last failure */
  lastFailure: number;

  /** Whether the circuit is open (blocking requests) */
  isOpen: boolean;

  /** Strategy that triggered the breaker */
  failedStrategy?: AnalysisStrategy;
}

/**
 * Simple in-memory circuit breaker.
 * Resets after successful execution or timeout.
 */
class AnalysisCircuitBreaker {
  private state: CircuitBreakerState = {
    failureCount: 0,
    lastFailure: 0,
    isOpen: false,
  };

  /** Number of failures before tripping the circuit */
  private readonly failureThreshold = 3;

  /** Time in ms before attempting to reset (5 minutes) */
  private readonly resetTimeoutMs = 5 * 60 * 1000;

  /**
   * Record a failure for the given strategy.
   */
  recordFailure(strategy: AnalysisStrategy): void {
    this.state.failureCount++;
    this.state.lastFailure = Date.now();
    this.state.failedStrategy = strategy;

    if (this.state.failureCount >= this.failureThreshold) {
      this.state.isOpen = true;
      logger.warn('Circuit Breaker', `Circuit opened after ${this.failureThreshold} failures`, {
        failedStrategy: strategy,
      });
    }
  }

  /**
   * Record a successful execution, resetting the breaker.
   */
  recordSuccess(): void {
    if (this.state.failureCount > 0) {
      logger.info('Circuit Breaker', 'Circuit reset after successful execution', {
        previousFailures: this.state.failureCount,
      });
    }

    this.state = {
      failureCount: 0,
      lastFailure: 0,
      isOpen: false,
    };
  }

  /**
   * Check if the circuit breaker allows the given strategy.
   *
   * @param _strategy - Strategy to check (reserved for future per-strategy tracking)
   * @returns Whether the strategy should be attempted
   */
   
  shouldAttempt(_strategy: AnalysisStrategy): boolean {
    // Check if enough time has passed to try again
    if (this.state.isOpen) {
      const timeSinceFailure = Date.now() - this.state.lastFailure;

      if (timeSinceFailure >= this.resetTimeoutMs) {
        // Half-open: allow one attempt
        logger.info('Circuit Breaker', 'Attempting circuit reset after timeout');
        return true;
      }

      // Circuit is still open
      return false;
    }

    return true;
  }

  /**
   * Get the recommended strategy based on circuit state.
   * Returns a simpler strategy if the preferred one has been failing.
   */
  getRecommendedStrategy(preferredStrategy: AnalysisStrategy): AnalysisStrategy {
    if (!this.state.isOpen) {
      return preferredStrategy;
    }

    // If circuit is open, recommend a simpler strategy
    if (this.state.failedStrategy === 'advanced') {
      logger.info('Circuit Breaker', 'Recommending hybrid due to advanced failures');
      return 'hybrid';
    }

    if (this.state.failedStrategy === 'hybrid') {
      logger.info('Circuit Breaker', 'Recommending basic due to hybrid failures');
      return 'basic';
    }

    // If basic is failing, still try it but with low expectations
    return 'basic';
  }

  /**
   * Get current state for logging/debugging.
   */
  getState(): Readonly<CircuitBreakerState> {
    return { ...this.state };
  }

  /**
   * Check if the circuit is currently tripped.
   */
  isTripped(): boolean {
    return this.state.isOpen;
  }
}

// Global circuit breaker instance (per process)
const circuitBreaker = new AnalysisCircuitBreaker();

/**
 * Create empty/minimal analysis results for error fallback.
 */
function createEmptyResults(template: Template): AnalysisResults {
  return {
    sections: template.sections.map(section => ({
      name: section.name,
      content: '[Analysis failed - no content extracted]',
      evidence: [],
    })),
    agendaItems: [],
    actionItems: [],
    decisions: [],
    quotes: [],
    summary: 'Analysis could not be completed due to errors.',
  };
}

/**
 * Merge partial results from multiple strategy attempts.
 * Takes the best available content from each attempt.
 */
function mergePartialResults(
  attempts: Array<{ strategy: AnalysisStrategy; results?: Partial<AnalysisResults> }>
): Partial<AnalysisResults> {
  const merged: Partial<AnalysisResults> = {
    sections: [],
    agendaItems: [],
    actionItems: [],
    decisions: [],
    quotes: [],
  };

  for (const attempt of attempts) {
    if (!attempt.results) continue;

    // Merge sections (avoid duplicates by name)
    if (attempt.results.sections) {
      for (const section of attempt.results.sections) {
        const existing = merged.sections?.find(s => s.name === section.name);
        if (!existing || (existing.content.length < section.content.length)) {
          // Replace with longer/better content
          merged.sections = merged.sections?.filter(s => s.name !== section.name) || [];
          merged.sections.push(section);
        }
      }
    }

    // Merge other arrays (simple concatenation, dedup by id where applicable)
    if (attempt.results.agendaItems) {
      const existingIds = new Set(merged.agendaItems?.map(a => a.id) || []);
      for (const item of attempt.results.agendaItems) {
        if (!existingIds.has(item.id)) {
          merged.agendaItems = merged.agendaItems || [];
          merged.agendaItems.push(item);
          existingIds.add(item.id);
        }
      }
    }

    if (attempt.results.decisions) {
      const existingIds = new Set(merged.decisions?.map(d => d.id) || []);
      for (const item of attempt.results.decisions) {
        if (!existingIds.has(item.id)) {
          merged.decisions = merged.decisions || [];
          merged.decisions.push(item);
          existingIds.add(item.id);
        }
      }
    }

    if (attempt.results.actionItems) {
      const existingIds = new Set(merged.actionItems?.map(a => a.id) || []);
      for (const item of attempt.results.actionItems) {
        if (!existingIds.has(item.id)) {
          merged.actionItems = merged.actionItems || [];
          merged.actionItems.push(item);
          existingIds.add(item.id);
        }
      }
    }

    if (attempt.results.quotes) {
      // Quotes don't have IDs, dedup by text
      const existingTexts = new Set(merged.quotes?.map(q => q.text) || []);
      for (const quote of attempt.results.quotes) {
        if (!existingTexts.has(quote.text)) {
          merged.quotes = merged.quotes || [];
          merged.quotes.push(quote);
          existingTexts.add(quote.text);
        }
      }
    }

    // Take first available summary
    if (attempt.results.summary && !merged.summary) {
      merged.summary = attempt.results.summary;
    }
  }

  return merged;
}

/**
 * Execute a single strategy with error handling.
 *
 * @returns Strategy result or throws with partial results attached
 */
async function executeStrategyWithRecovery(
  strategy: AnalysisStrategy,
  template: Template,
  transcript: string,
  openaiClient: OpenAI,
  deployment: string,
  runEvaluation: boolean,
  progressCallback?: (current: number, total: number, message: string) => void,
  segments?: TranscriptSegment[],
  supplementalMaterial?: string
): Promise<BasicAnalysisResult | HybridAnalysisResult | AdvancedAnalysisResult> {
  logger.info('Strategy Execution', `Executing ${strategy} strategy`, {
    templateName: template.name,
    sectionCount: template.sections.length,
    runEvaluation,
    hasSupplementalMaterial: !!supplementalMaterial,
  });

  try {
    switch (strategy) {
      case 'basic':
        return await executeBasicAnalysis(template, transcript, openaiClient, deployment, {
          runEvaluation,
          runEnrichment: segments && segments.length > 0,
          supplementalMaterial,
        } as BasicAnalysisConfig, segments);

      case 'hybrid':
        return await executeHybridAnalysis(
          template,
          transcript,
          openaiClient,
          deployment,
          progressCallback,
          { runEvaluation, supplementalMaterial } as HybridAnalysisConfig
        );

      case 'advanced':
        return await executeAdvancedAnalysis(
          template,
          transcript,
          openaiClient,
          deployment,
          progressCallback,
          { runEvaluation, supplementalMaterial } as AdvancedAnalysisConfig
        );

      default:
        throw new StrategyError(
          strategy,
          `Unknown strategy: ${strategy}`,
          AnalysisErrorCode.STRATEGY_FAILED
        );
    }
  } catch (error) {
    // Wrap error with strategy context
    const wrappedError = wrapError(error, { strategy });

    // Check if there are partial results we can extract
    if (hasPartialResults(error)) {
      throw error; // Preserve partial results error type
    }

    // Wrap in strategy error for fallback handling
    throw new StrategyError(
      strategy,
      wrappedError.message,
      wrappedError.code,
      wrappedError.metadata
    );
  }
}

/**
 * Execute transcript analysis using the specified or auto-selected strategy
 *
 * This is the main entry point for all transcript analysis. It handles:
 * - Automatic strategy selection based on transcript length
 * - Execution of the appropriate strategy
 * - Strategy fallback on failure (advanced -> hybrid -> basic)
 * - Partial results recovery
 * - Circuit breaker for repeated failures
 * - Optional self-evaluation pass
 * - Progress tracking
 * - Metadata collection
 *
 * @param template - Analysis template defining sections to extract
 * @param transcript - Full transcript text to analyze
 * @param openaiClient - Azure OpenAI client instance
 * @param deployment - GPT deployment name to use
 * @param config - Optional configuration (strategy selection, evaluation, etc.)
 * @returns Promise<AnalysisExecutionResult> with results and metadata
 *
 * @example
 * ```typescript
 * const result = await executeAnalysis(
 *   template,
 *   transcript,
 *   openaiClient,
 *   'gpt-5',
 *   { strategy: 'auto', runEvaluation: true }
 * );
 *
 * console.log(`Used ${result.strategy} strategy`);
 * console.log(`Quality score: ${result.evaluation?.qualityScore}`);
 * if (result.metadata.usedFallback) {
 *   console.log(`Fell back from ${result.metadata.originalStrategy}`);
 * }
 * ```
 */
export async function executeAnalysis(
  template: Template,
  transcript: string,
  openaiClient: OpenAI,
  deployment: string,
  config: AnalysisConfig = {}
): Promise<AnalysisExecutionResult> {
  const startTime = Date.now();

  // Default configuration
  const {
    strategy: strategyOption = 'auto',
    runEvaluation = true,
    progressCallback,
    enableFallback = true,
    returnPartialResults = true,
    maxFallbackAttempts = 3,
    segments,
    supplementalMaterial,
  } = config;

  // Determine initial strategy to use
  let strategy: AnalysisStrategy;
  let wasAutoSelected = false;

  if (strategyOption === 'auto') {
    const recommendation = recommendStrategy(transcript);
    strategy = recommendation.strategy;
    wasAutoSelected = true;

    // Apply circuit breaker recommendation
    strategy = circuitBreaker.getRecommendedStrategy(strategy);

    logger.info('Analysis', `Auto-selected strategy: ${strategy}`, {
      originalRecommendation: recommendation.strategy,
      reasoning: recommendation.reasoning,
      circuitBreakerTripped: circuitBreaker.isTripped(),
    });
  } else {
    strategy = strategyOption;

    // Still check circuit breaker for explicit strategy
    if (!circuitBreaker.shouldAttempt(strategy)) {
      const fallback = circuitBreaker.getRecommendedStrategy(strategy);
      if (fallback !== strategy) {
        logger.warn('Analysis', `Circuit breaker active, using ${fallback} instead of ${strategy}`);
        strategy = fallback;
      }
    }

    logger.info('Analysis', `Using specified strategy: ${strategy}`);
  }

  // Get strategy metadata
  const strategyMetadata = getStrategyMetadata(strategy);
  const actualTokens = estimateTokens(transcript);

  logger.info('Analysis', 'Starting analysis', {
    strategy,
    wasAutoSelected,
    templateName: template.name,
    templateSections: template.sections.length,
    transcriptTokens: actualTokens,
    runEvaluation,
    enableFallback,
    estimatedDuration: strategyMetadata.speed,
    estimatedApiCalls: strategyMetadata.apiCalls,
    hasSupplementalMaterial: !!supplementalMaterial,
    supplementalLength: supplementalMaterial?.length || 0,
  });

  // Track attempts for potential partial results recovery
  const strategyAttempts: Array<{
    strategy: AnalysisStrategy;
    error: Error;
    results?: Partial<AnalysisResults>;
  }> = [];

  const warnings: string[] = [];
  let originalStrategy: AnalysisStrategy | undefined;
  let usedFallback = false;
  let currentStrategy = strategy;
  let attemptCount = 0;

  // Try strategies with fallback
  while (attemptCount < maxFallbackAttempts) {
    attemptCount++;

    try {
      const result = await executeStrategyWithRecovery(
        currentStrategy,
        template,
        transcript,
        openaiClient,
        deployment,
        runEvaluation,
        progressCallback,
        segments,
        supplementalMaterial
      );

      // Success! Record it and reset circuit breaker
      circuitBreaker.recordSuccess();

      const endTime = Date.now();
      const durationMs = endTime - startTime;
      const durationSec = (durationMs / 1000).toFixed(1);

      logger.info('Analysis', 'Analysis complete', {
        strategy: currentStrategy,
        durationMs,
        durationSec: `${durationSec}s`,
        usedFallback,
        originalStrategy,
        attemptsMade: attemptCount,
        hadEvaluation: !!result.evaluation,
        qualityScore: result.evaluation?.qualityScore || 0,
        sectionsAnalyzed: result.results.sections.length,
        agendaItems: result.results.agendaItems?.length || 0,
        decisions: result.results.decisions?.length || 0,
        actionItems: result.results.actionItems?.length || 0,
      });

      // Handle different property names: basic uses `promptUsed` (string), others use `promptsUsed` (string[])
      const promptsUsed = 'promptsUsed' in result
        ? result.promptsUsed
        : 'promptUsed' in result
          ? [result.promptUsed]
          : [];

      return {
        strategy: currentStrategy,
        results: result.results,
        draftResults: result.draftResults,
        evaluation: result.evaluation,
        promptsUsed,
        metadata: {
          estimatedDuration: strategyMetadata.speed,
          apiCalls: strategyMetadata.apiCalls,
          quality: strategyMetadata.quality,
          actualTokens,
          wasAutoSelected,
          usedFallback,
          originalStrategy,
          circuitBreakerTripped: circuitBreaker.isTripped(),
        },
        warnings: warnings.length > 0 ? warnings : undefined,
      };

    } catch (error) {
      // Record the failure
      circuitBreaker.recordFailure(currentStrategy);

      // Extract any partial results from the error
      let partialResults: Partial<AnalysisResults> | undefined;

      if (hasPartialResults(error)) {
        if (error instanceof PartialResultsError) {
          partialResults = error.partialResults;
        } else if (error instanceof AllStrategiesFailedError) {
          partialResults = error.metadata.partialResults;
        }
      }

      strategyAttempts.push({
        strategy: currentStrategy,
        error: error instanceof Error ? error : new Error(String(error)),
        results: partialResults,
      });

      const classification = classifyError(error);
      logger.warn('Analysis', `Strategy ${currentStrategy} failed`, {
        errorCode: classification.code,
        isRetryable: classification.isRetryable,
        suggestedAction: classification.suggestedAction,
        hasPartialResults: !!partialResults,
        partialSections: partialResults?.sections?.length || 0,
      });

      // Determine if we should try fallback
      if (!enableFallback) {
        throw wrapError(error, { strategy: currentStrategy });
      }

      // Get next fallback strategy
      const nextStrategy = getNextFallbackStrategy(currentStrategy);

      if (!nextStrategy) {
        // No more fallbacks available
        logger.error('Analysis', 'All strategies exhausted', {
          attemptsMade: attemptCount,
          strategies: strategyAttempts.map(a => a.strategy),
        });

        // Try to return partial results if available
        if (returnPartialResults && strategyAttempts.some(a => a.results)) {
          const merged = mergePartialResults(strategyAttempts);
          const sectionCount = merged.sections?.length || 0;

          if (sectionCount > 0) {
            logger.info('Analysis', 'Returning merged partial results', {
              sectionCount,
              agendaItems: merged.agendaItems?.length || 0,
              decisions: merged.decisions?.length || 0,
              actionItems: merged.actionItems?.length || 0,
            });

            warnings.push('Analysis partially completed due to errors');
            warnings.push(`Successfully extracted ${sectionCount} of ${template.sections.length} sections`);

            // Create complete result from partial data
            const results: AnalysisResults = {
              sections: merged.sections || [],
              summary: merged.summary,
              agendaItems: merged.agendaItems,
              decisions: merged.decisions,
              actionItems: merged.actionItems,
              quotes: merged.quotes,
            };

            return {
              strategy: strategyAttempts[0].strategy, // Original strategy
              results,
              promptsUsed: [],
              metadata: {
                estimatedDuration: strategyMetadata.speed,
                apiCalls: strategyMetadata.apiCalls,
                quality: 'partial',
                actualTokens,
                wasAutoSelected,
                usedFallback: true,
                originalStrategy: strategy,
                isPartial: true,
                failedSections: template.sections
                  .filter(s => !merged.sections?.some(ms => ms.name === s.name))
                  .map(s => s.name),
                circuitBreakerTripped: circuitBreaker.isTripped(),
              },
              warnings,
            };
          }
        }

        // No usable partial results - throw comprehensive error
        throw new AllStrategiesFailedError(
          strategyAttempts.map(a => ({ strategy: a.strategy, error: a.error })),
          mergePartialResults(strategyAttempts)
        );
      }

      // Record fallback
      if (!usedFallback) {
        originalStrategy = currentStrategy;
        usedFallback = true;
      }

      warnings.push(`Strategy ${currentStrategy} failed, falling back to ${nextStrategy}`);
      currentStrategy = nextStrategy;

      logger.info('Analysis', `Falling back to ${nextStrategy} strategy`, {
        previousStrategy: originalStrategy,
        attemptNumber: attemptCount + 1,
      });
    }
  }

  // Should not reach here, but provide graceful fallback
  logger.error('Analysis', 'Unexpected: exceeded max fallback attempts without result');

  // Return empty results as last resort
  warnings.push('Analysis failed after all retry attempts');

  return {
    strategy: 'basic',
    results: createEmptyResults(template),
    promptsUsed: [],
    metadata: {
      estimatedDuration: 'N/A',
      apiCalls: 'N/A',
      quality: 'failed',
      actualTokens,
      wasAutoSelected,
      usedFallback: true,
      originalStrategy: strategy,
      isPartial: true,
      circuitBreakerTripped: circuitBreaker.isTripped(),
    },
    warnings,
  };
}

/**
 * Get a recommendation for which strategy to use
 *
 * @param transcript - Full transcript text
 * @returns Recommended strategy and reason
 */
export function getStrategyRecommendation(transcript: string): {
  strategy: AnalysisStrategy;
  reason: string;
  metadata: ReturnType<typeof getStrategyMetadata>;
  circuitBreakerActive: boolean;
} {
  const recommendation = recommendStrategy(transcript);
  const adjustedStrategy = circuitBreaker.getRecommendedStrategy(recommendation.strategy);
  const metadata = getStrategyMetadata(adjustedStrategy);
  const tokens = estimateTokens(transcript);

  const reasons = {
    basic:
      `Short meeting (${tokens.toLocaleString()} tokens). ` +
      'Basic strategy provides quick analysis in 2-4 minutes.',
    hybrid:
      `Medium meeting (${tokens.toLocaleString()} tokens). ` +
      'Hybrid strategy balances speed and quality with contextual batching.',
    advanced:
      `Long/complex meeting (${tokens.toLocaleString()} tokens). ` +
      'Advanced strategy provides highest quality with cascading analysis.',
  };

  let reason = reasons[adjustedStrategy];

  if (adjustedStrategy !== recommendation.strategy) {
    reason += ` (Adjusted from ${recommendation.strategy} due to recent failures)`;
  }

  return {
    strategy: adjustedStrategy,
    reason,
    metadata,
    circuitBreakerActive: circuitBreaker.isTripped(),
  };
}

/**
 * Reset the circuit breaker state.
 * Useful for testing or manual recovery.
 */
export function resetCircuitBreaker(): void {
  circuitBreaker.recordSuccess();
  logger.info('Circuit Breaker', 'Manually reset');
}

/**
 * Get the current circuit breaker state.
 * Useful for monitoring and debugging.
 */
export function getCircuitBreakerState(): {
  isOpen: boolean;
  failureCount: number;
  lastFailure: number | null;
  failedStrategy?: AnalysisStrategy;
} {
  const state = circuitBreaker.getState();
  return {
    isOpen: state.isOpen,
    failureCount: state.failureCount,
    lastFailure: state.lastFailure > 0 ? state.lastFailure : null,
    failedStrategy: state.failedStrategy,
  };
}

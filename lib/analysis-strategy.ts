/**
 * Analysis Strategy Selector
 *
 * This module provides intelligent strategy selection for transcript analysis based on
 * transcript length, complexity, content type, and user preferences.
 *
 * Three-Tier Strategy System (Updated for GPT-5.2):
 * - Basic: Fast monolithic single-pass analysis (2-4 min) for short meetings
 * - Hybrid: Batched analysis with context (4-6 min) for medium-length meetings
 * - Advanced: Serial cascading analysis (6-8 min) for complex, long meetings
 *
 * Content Type Considerations:
 * - radio-traffic: Lower token density, needs full context - caps at hybrid
 * - meeting: Standard token density, all strategies available
 * - interview: Similar to meetings, all strategies available
 * - general: No special handling
 *
 * Strategy Selection:
 * - Automatic: Token-based breakpoints with smart recommendations
 * - Manual: User can override for tweaking
 */

import { estimateTokens } from './token-utils';
import type { ContentType } from '@/types/template';

/**
 * Analysis strategy types
 */
export type AnalysisStrategy = 'basic' | 'hybrid' | 'advanced';

/**
 * Strategy order from least to most intensive.
 * Used for capping and comparison operations.
 */
export const STRATEGY_ORDER: readonly AnalysisStrategy[] = ['basic', 'hybrid', 'advanced'] as const;

/**
 * Default max strategy by content type.
 * Radio traffic caps at hybrid to preserve full context.
 */
export const CONTENT_TYPE_MAX_STRATEGY: Record<ContentType, AnalysisStrategy | undefined> = {
  'radio-traffic': 'hybrid',  // Radio needs full context, chunking loses critical timing
  'meeting': undefined,       // No cap - all strategies available
  'interview': undefined,     // No cap - all strategies available
  'general': undefined,       // No cap - all strategies available
} as const;

/**
 * Token breakpoints for strategy recommendation
 */
export const STRATEGY_BREAKPOINTS = {
  /** Below this threshold, recommend Basic strategy */
  BASIC_THRESHOLD: 15000,  // ~10-min meeting, ~3-4 pages

  /** Below this threshold, recommend Hybrid strategy */
  HYBRID_THRESHOLD: 60000,  // ~40-min meeting, ~15 pages

  /** Above HYBRID_THRESHOLD, recommend Advanced strategy */
} as const;

/**
 * Estimated processing times for each strategy (in seconds)
 * Updated for GPT-5.2 model upgrade - longer processing but better results
 */
export const STRATEGY_TIME_ESTIMATES = {
  basic: { min: 120, max: 240 },    // Single API call (2-4 min)
  hybrid: { min: 240, max: 360 },   // 3 batched API calls (4-6 min)
  advanced: { min: 360, max: 480 }, // 9-10 sequential API calls (6-8 min)
} as const;

/**
 * Strategy recommendation with reasoning
 */
export interface StrategyRecommendation {
  /** Recommended strategy */
  strategy: AnalysisStrategy;

  /** Why this strategy is recommended */
  reasoning: string;

  /** Estimated processing time in seconds */
  estimatedTime: { min: number; max: number };

  /** Estimated token count of transcript */
  transcriptTokens: number;

  /** Meeting duration estimate in minutes */
  estimatedDuration: number;

  /** Confidence in recommendation (0-1) */
  confidence: number;

  /** Alternative strategies the user can choose */
  alternatives: Array<{
    strategy: AnalysisStrategy;
    reason: string;
    tradeoff: string;
  }>;
}

/**
 * Cap a strategy to a maximum allowed strategy.
 * Strategy ordering: basic < hybrid < advanced
 *
 * @param strategy - Strategy to potentially cap
 * @param maxStrategy - Maximum allowed strategy
 * @returns The capped strategy
 */
export function capStrategy(strategy: AnalysisStrategy, maxStrategy?: AnalysisStrategy): AnalysisStrategy {
  if (!maxStrategy) return strategy;

  const strategyIndex = STRATEGY_ORDER.indexOf(strategy);
  const maxIndex = STRATEGY_ORDER.indexOf(maxStrategy);

  if (strategyIndex > maxIndex) {
    return maxStrategy;
  }
  return strategy;
}

/**
 * Get the effective max strategy considering both template maxStrategy and content type.
 *
 * @param templateMaxStrategy - Explicit max strategy from template
 * @param contentType - Content type classification
 * @returns The most restrictive max strategy
 */
export function getEffectiveMaxStrategy(
  templateMaxStrategy?: AnalysisStrategy,
  contentType?: ContentType
): AnalysisStrategy | undefined {
  const contentTypeMax = contentType ? CONTENT_TYPE_MAX_STRATEGY[contentType] : undefined;

  if (!templateMaxStrategy && !contentTypeMax) {
    return undefined;
  }

  if (!templateMaxStrategy) {
    return contentTypeMax;
  }

  if (!contentTypeMax) {
    return templateMaxStrategy;
  }

  // Return the more restrictive of the two
  const templateIndex = STRATEGY_ORDER.indexOf(templateMaxStrategy);
  const contentIndex = STRATEGY_ORDER.indexOf(contentTypeMax);
  return templateIndex <= contentIndex ? templateMaxStrategy : contentTypeMax;
}

/**
 * Options for strategy recommendation
 */
export interface RecommendStrategyOptions {
  /** Optional maximum strategy cap (from template) */
  maxStrategy?: AnalysisStrategy;
  /** Content type classification (affects default caps) */
  contentType?: ContentType;
}

/**
 * Recommend an analysis strategy based on transcript
 *
 * Analyzes transcript length, content type, and provides intelligent strategy
 * recommendation with reasoning, time estimates, and alternatives.
 *
 * @param transcriptText - Full transcript text
 * @param options - Optional configuration (maxStrategy, contentType)
 * @returns Strategy recommendation with alternatives
 *
 * @example
 * ```typescript
 * const recommendation = recommendStrategy(transcript.text);
 *
 * console.log(recommendation.strategy);      // "hybrid"
 * console.log(recommendation.reasoning);     // "Medium-length meeting..."
 * console.log(recommendation.estimatedTime); // { min: 120, max: 180 }
 * ```
 *
 * @example
 * ```typescript
 * // With content type (radio traffic caps at hybrid)
 * const recommendation = recommendStrategy(transcript.text, {
 *   contentType: 'radio-traffic'
 * });
 * ```
 */
export function recommendStrategy(
  transcriptText: string,
  options?: AnalysisStrategy | RecommendStrategyOptions
): StrategyRecommendation {
  // Support legacy call signature: recommendStrategy(text, maxStrategy)
  const opts: RecommendStrategyOptions = typeof options === 'string'
    ? { maxStrategy: options }
    : options ?? {};
  const tokens = estimateTokens(transcriptText);
  const estimatedDuration = Math.round(tokens / 150); // ~150 tokens per minute of speech

  let strategy: AnalysisStrategy;
  let reasoning: string;
  let confidence: number;
  let alternatives: StrategyRecommendation['alternatives'];

  if (tokens < STRATEGY_BREAKPOINTS.BASIC_THRESHOLD) {
    // Short meeting: Recommend Basic
    strategy = 'basic';
    confidence = 0.9;
    reasoning =
      `Short meeting (~${estimatedDuration} min) with ${tokens.toLocaleString()} tokens. ` +
      'Basic analysis provides results in 2-4 minutes with comprehensive coverage ' +
      'suitable for straightforward meetings.';

    alternatives = [
      {
        strategy: 'hybrid',
        reason: 'More detailed cross-referencing between sections',
        tradeoff: '2x slower but marginal quality improvement for short meetings',
      },
      {
        strategy: 'advanced',
        reason: 'Maximum quality with full contextual cascading',
        tradeoff: '3x slower with minimal benefit for short transcripts',
      },
    ];
  } else if (tokens < STRATEGY_BREAKPOINTS.HYBRID_THRESHOLD) {
    // Medium meeting: Recommend Hybrid
    strategy = 'hybrid';
    confidence = 0.95;
    reasoning =
      `Medium-length meeting (~${estimatedDuration} min) with ${tokens.toLocaleString()} tokens. ` +
      'Hybrid analysis balances speed and quality (4-6 min) with contextual batching ' +
      'that links related sections while maintaining reasonable processing time.';

    alternatives = [
      {
        strategy: 'basic',
        reason: 'Faster results if speed is critical',
        tradeoff: 'Less detailed cross-references, may miss some connections',
      },
      {
        strategy: 'advanced',
        reason: 'Maximum quality for complex discussions',
        tradeoff: '1.5x slower but provides deepest contextual understanding',
      },
    ];
  } else {
    // Long meeting: Recommend Advanced
    strategy = 'advanced';
    confidence = 0.98;
    reasoning =
      `Long meeting (~${estimatedDuration} min) with ${tokens.toLocaleString()} tokens. ` +
      'Advanced analysis recommended for complex discussions (6-8 min processing). ' +
      'Full contextual cascading ensures agenda items, discussions, decisions, and action ' +
      'items are properly linked with comprehensive cross-references.';

    alternatives = [
      {
        strategy: 'hybrid',
        reason: 'Faster results with good cross-referencing',
        tradeoff: 'May miss some nuanced connections in complex meetings',
      },
      {
        strategy: 'basic',
        reason: 'Quick overview if time is critical',
        tradeoff: 'Minimal cross-referencing, treats sections independently',
      },
    ];
  }

  // Compute effective max strategy considering both template and content type
  const effectiveMax = getEffectiveMaxStrategy(opts.maxStrategy, opts.contentType);
  const cappedStrategy = capStrategy(strategy, effectiveMax);

  // Update reasoning if strategy was capped
  if (cappedStrategy !== strategy) {
    const capSource = opts.contentType === 'radio-traffic' && !opts.maxStrategy
      ? 'content type (radio traffic needs full context)'
      : 'template configuration';
    reasoning = `${reasoning} (Capped to ${cappedStrategy} by ${capSource})`;
    // Update alternatives to only show allowed strategies
    alternatives = alternatives.filter(alt => {
      const altOrder = STRATEGY_ORDER.indexOf(alt.strategy);
      const maxOrder = STRATEGY_ORDER.indexOf(effectiveMax!);
      return altOrder <= maxOrder;
    });
  }

  return {
    strategy: cappedStrategy,
    reasoning,
    estimatedTime: STRATEGY_TIME_ESTIMATES[cappedStrategy],
    transcriptTokens: tokens,
    estimatedDuration,
    confidence,
    alternatives,
  };
}

/**
 * Validate user-selected strategy
 *
 * Checks if manual strategy override is appropriate and returns warnings if needed.
 *
 * @param transcriptText - Full transcript text
 * @param selectedStrategy - User's manual strategy choice
 * @returns Validation result with optional warnings
 *
 * @example
 * ```typescript
 * const validation = validateStrategy(transcript.text, 'basic');
 *
 * if (validation.warning) {
 *   console.warn(validation.warning);
 *   // Show warning to user but allow them to proceed
 * }
 * ```
 */
export function validateStrategy(
  transcriptText: string,
  selectedStrategy: AnalysisStrategy
): {
  isValid: boolean;
  warning?: string;
  recommendation?: AnalysisStrategy;
} {
  const recommended = recommendStrategy(transcriptText);
  const tokens = recommended.transcriptTokens;

  // Basic strategy on very long transcripts
  if (selectedStrategy === 'basic' && tokens > STRATEGY_BREAKPOINTS.HYBRID_THRESHOLD) {
    return {
      isValid: true,
      warning:
        `You've selected Basic analysis for a ${recommended.estimatedDuration}-minute meeting ` +
        `(${tokens.toLocaleString()} tokens). This will be fast but may miss important ` +
        'connections between agenda items, decisions, and action items. Consider Hybrid ' +
        'or Advanced for better quality.',
      recommendation: recommended.strategy,
    };
  }

  // Advanced strategy on very short transcripts
  if (selectedStrategy === 'advanced' && tokens < STRATEGY_BREAKPOINTS.BASIC_THRESHOLD) {
    return {
      isValid: true,
      warning:
        `You've selected Advanced analysis for a ${recommended.estimatedDuration}-minute meeting ` +
        `(${tokens.toLocaleString()} tokens). This will take 6-8 minutes with minimal quality ` +
        'improvement over Basic analysis for such a short transcript. Consider Basic for ' +
        'faster results.',
      recommendation: recommended.strategy,
    };
  }

  // All other cases are fine
  return { isValid: true };
}

/**
 * Get strategy description for UI display
 *
 * @param strategy - Strategy type
 * @returns User-friendly description
 */
export function getStrategyDescription(strategy: AnalysisStrategy): string {
  switch (strategy) {
    case 'basic':
      return (
        'Fast single-pass analysis. All sections analyzed together in one API call. ' +
        'Best for: Short meetings, quick overviews, straightforward discussions.'
      );
    case 'hybrid':
      return (
        'Balanced batched analysis. Related sections grouped with contextual linking. ' +
        'Best for: Medium meetings, standard discussions, good quality/speed balance.'
      );
    case 'advanced':
      return (
        'Deep contextual cascading. Each section builds on previous results with full cross-references. ' +
        'Best for: Long meetings, complex discussions, maximum quality and detail.'
      );
  }
}

/**
 * Get strategy metadata for display
 *
 * @param strategy - Strategy type
 * @returns Metadata object
 */
export function getStrategyMetadata(strategy: AnalysisStrategy): {
  name: string;
  speed: string;
  quality: string;
  apiCalls: string;
  icon: string;
} {
  switch (strategy) {
    case 'basic':
      return {
        name: 'Basic Analysis',
        speed: 'Fast (2-4 min)',
        quality: 'Good',
        apiCalls: '1 call',
        icon: '⚡',
      };
    case 'hybrid':
      return {
        name: 'Hybrid Analysis',
        speed: 'Medium (4-6 min)',
        quality: 'Excellent',
        apiCalls: '3 calls',
        icon: '⚖️',
      };
    case 'advanced':
      return {
        name: 'Advanced Analysis',
        speed: 'Thorough (6-8 min)',
        quality: 'Maximum',
        apiCalls: '9-10 calls',
        icon: '🎯',
      };
  }
}

/**
 * Format time estimate for display
 *
 * @param estimate - Time estimate object
 * @returns Formatted string
 *
 * @example
 * ```typescript
 * formatTimeEstimate({ min: 120, max: 180 }); // "2-3 minutes"
 * formatTimeEstimate({ min: 30, max: 60 });   // "30-60 seconds"
 * ```
 */
export function formatTimeEstimate(estimate: { min: number; max: number }): string {
  if (estimate.min >= 60) {
    const minMinutes = Math.floor(estimate.min / 60);
    const maxMinutes = Math.ceil(estimate.max / 60);
    return `${minMinutes}-${maxMinutes} minute${maxMinutes > 1 ? 's' : ''}`;
  }
  return `${estimate.min}-${estimate.max} seconds`;
}

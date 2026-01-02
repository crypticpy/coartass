/**
 * Enrichment Engine Module
 *
 * Pluggable mining pattern system for post-extraction enhancement.
 * Use this module to enrich analysis results with additional context
 * from the original transcript.
 *
 * @example
 * ```typescript
 * import { createMiningEngine, isEnrichmentEnabled } from '@/lib/analysis-strategies/enrichment';
 * import { decisionMiningPattern, actionMiningPattern, quoteMiningPattern } from '@/lib/analysis-strategies/enrichment/patterns';
 *
 * const engine = createMiningEngine(openaiClient, deployment);
 * engine.registerPattern(decisionMiningPattern);
 * engine.registerPattern(actionMiningPattern);
 * engine.registerPattern(quoteMiningPattern);
 *
 * const { results, metadata } = await engine.executePatterns(
 *   transcript,
 *   segments,
 *   analysisResults,
 *   { mode: 'combined', maxQuotes: 5 }
 * );
 * ```
 */

// Core engine
export { createMiningEngine, isEnrichmentEnabled } from './engine';
export type { MiningEngine } from './engine';

// Prompts
export { buildCombinedEnrichmentPrompt, buildPatternPrompt } from './prompts';

// Utilities
export {
  mergeEnrichment,
  mergeEnrichmentPartial,
  shouldEnrich,
  retryWithBackoff,
  formatTimestamp,
  parseTimestamp,
  filterByConfidence,
  sortByConfidence,
  calculateEnrichmentStats,
  validateEnrichedAction,
  validateEnrichedDecision,
  validateEnrichedQuote,
} from './utils';
export type {
  EnrichmentStats,
  PartialEnrichmentResult,
  ActionEnrichmentPartial,
  DecisionEnrichmentPartial,
  QuoteExtraction,
} from './utils';

// Mining Patterns
export {
  actionMiningPattern,
  decisionMiningPattern,
  quoteMiningPattern,
  createActionMiningPattern,
  createDecisionMiningPattern,
  createQuoteMiningPattern,
  registerDefaultPatterns,
  getDefaultPatterns,
  inferPriorityFromText,
  containsVotingLanguage,
  containsDecisionLanguage,
  detectCategory,
  detectSentiment,
  DEFAULT_ACTION_MINING_CONFIG,
  DEFAULT_DECISION_MINING_CONFIG,
  DEFAULT_QUOTE_MINING_CONFIG,
} from './patterns';
export type {
  ActionMiningConfig,
  DecisionMiningConfig,
  QuoteMiningConfig,
} from './patterns';

// Re-export types for convenience
export type {
  EnrichmentConfig,
  MiningContext,
  MiningPattern,
  MiningResult,
  MiningResultMetadata,
  EnrichedResults,
  EnrichmentMetadata,
  EnrichedActionItem,
  EnrichedDecision,
  EnrichedQuote,
} from '@/types/enrichment';

export { DEFAULT_ENRICHMENT_CONFIG } from '@/types/enrichment';

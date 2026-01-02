/**
 * Mining Patterns Module
 *
 * Barrel export for all available mining patterns.
 * Each pattern implements the MiningPattern interface for
 * pluggable enrichment of analysis results.
 *
 * @example
 * ```typescript
 * import {
 *   actionMiningPattern,
 *   decisionMiningPattern,
 *   quoteMiningPattern,
 * } from '@/lib/analysis-strategies/enrichment/patterns';
 *
 * // Register patterns with engine
 * engine.registerPattern(actionMiningPattern);
 * engine.registerPattern(decisionMiningPattern);
 * engine.registerPattern(quoteMiningPattern);
 * ```
 */

// Import patterns for local use
import { actionMiningPattern as _actionMiningPattern } from './action-mining';
import { decisionMiningPattern as _decisionMiningPattern } from './decision-mining';
import { quoteMiningPattern as _quoteMiningPattern } from './quote-mining';

// Action Mining
export {
  createActionMiningPattern,
  actionMiningPattern,
  inferPriorityFromText,
  DEFAULT_ACTION_MINING_CONFIG,
} from './action-mining';
export type { ActionMiningConfig } from './action-mining';

// Decision Mining
export {
  createDecisionMiningPattern,
  decisionMiningPattern,
  containsVotingLanguage,
  containsDecisionLanguage,
  DEFAULT_DECISION_MINING_CONFIG,
} from './decision-mining';
export type { DecisionMiningConfig } from './decision-mining';

// Quote Mining
export {
  createQuoteMiningPattern,
  quoteMiningPattern,
  detectCategory,
  detectSentiment,
  DEFAULT_QUOTE_MINING_CONFIG,
} from './quote-mining';
export type { QuoteMiningConfig } from './quote-mining';

/**
 * Register all default patterns with a mining engine.
 *
 * @param engine - Mining engine with registerPattern method
 */
export function registerDefaultPatterns(engine: {
  registerPattern: (pattern: { name: string }) => void;
}): void {
  engine.registerPattern(_actionMiningPattern);
  engine.registerPattern(_decisionMiningPattern);
  engine.registerPattern(_quoteMiningPattern);
}

/**
 * Get all default pattern instances.
 *
 * @returns Array of default mining patterns
 */
export function getDefaultPatterns() {
  return [_actionMiningPattern, _decisionMiningPattern, _quoteMiningPattern];
}

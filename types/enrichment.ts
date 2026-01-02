/**
 * Enrichment Engine Type Definitions
 *
 * Types for the pluggable mining pattern system that performs
 * post-extraction enhancement passes on analysis results.
 *
 * The enrichment engine is designed for extensibility:
 * - MiningPattern interface allows adding new extraction types
 * - EnrichmentConfig controls model and quality settings
 * - MiningResult provides consistent output structure
 */

import type { TranscriptSegment } from './transcript';
import type { AnalysisResults, ActionItem, Decision, Quote } from './analysis';

// ============================================================================
// Core Enrichment Configuration
// ============================================================================

/**
 * Configuration for enrichment execution.
 * Controls model selection, quality thresholds, and extraction limits.
 */
export interface EnrichmentConfig {
  /**
   * Enrichment mode determining which patterns to run.
   * - 'combined': Run all patterns in a single API call (faster, for Basic)
   * - 'separate': Run patterns individually (cleaner, for Hybrid/Advanced)
   */
  mode: 'combined' | 'separate';

  /**
   * Maximum number of quotes to extract.
   * Prevents overwhelming the user with too many quotes.
   */
  maxQuotes: number;

  /**
   * Minimum confidence threshold (0-1) for including enriched data.
   * Items below this threshold may be flagged or excluded.
   */
  minConfidence: number;

  /**
   * Maximum evidence items per enriched field.
   * Controls context density.
   */
  maxEvidencePerItem: number;

  /**
   * Whether enrichment is enabled at all.
   * Allows feature flagging.
   */
  enabled: boolean;
}

/**
 * Default enrichment configuration.
 */
export const DEFAULT_ENRICHMENT_CONFIG: EnrichmentConfig = {
  mode: 'combined',
  maxQuotes: 5,
  minConfidence: 0.7,
  maxEvidencePerItem: 3,
  enabled: true,
};

// ============================================================================
// Mining Pattern Interface
// ============================================================================

/**
 * Transcript segment with ID for mining context.
 * Extends base TranscriptSegment with a unique identifier.
 */
export interface MiningSegment extends TranscriptSegment {
  /** Unique identifier for referencing in enrichment */
  id: string;
}

/**
 * Context provided to mining patterns for extraction.
 * Contains all information needed to perform enrichment.
 */
export interface MiningContext {
  /** Full transcript text */
  transcript: string;

  /** Parsed transcript segments with timestamps and IDs */
  segments: MiningSegment[];

  /** Current analysis results to be enriched */
  existingResults: AnalysisResults;

  /** Enrichment configuration */
  config: EnrichmentConfig;
}

/**
 * Generic mining pattern interface.
 * Implement this interface to create new extraction patterns.
 *
 * The pattern uses a callback approach where:
 * - buildPrompt creates the prompt for the LLM
 * - parseResponse handles the raw response
 * - shouldRun determines if the pattern should execute
 *
 * @example
 * const voteMiningPattern: MiningPattern<VoteResult[]> = {
 *   name: 'vote-mining',
 *   description: 'Extract votes, motions, and tallies',
 *   buildPrompt: (context) => '...',
 *   parseResponse: (raw) => ({ data: extractedVotes, ... }),
 *   shouldRun: (context) => context.existingResults.decisions?.length > 0,
 * };
 */
export interface MiningPattern<T = unknown> {
  /** Unique identifier for this pattern */
  name: string;

  /** Human-readable description of what this pattern extracts */
  description: string;

  /**
   * Build the prompt for the LLM based on context.
   * @param context - Mining context with transcript and results
   * @returns Prompt string for the LLM
   */
  buildPrompt(context: MiningContext): string;

  /**
   * Parse the raw LLM response into structured data.
   * @param raw - Raw string response from LLM
   * @returns Parsed mining result
   */
  parseResponse(raw: string): MiningResult<T>;

  /**
   * Determine if this pattern should run for the given context.
   * @param context - Mining context
   * @returns true if pattern should run, false to skip
   */
  shouldRun(context: MiningContext): boolean;

  /**
   * Optional validation for the pattern output.
   * @param data - The extracted data to validate
   * @returns true if valid, false otherwise
   */
  validate?(data: T): boolean;
}

// ============================================================================
// Mining Result Types
// ============================================================================

/**
 * Result wrapper for mining pattern execution.
 * Provides consistent structure for all pattern outputs.
 *
 * @template T - The type of data extracted by the pattern
 */
export interface MiningResult<T> {
  /** Extracted data */
  data: T;

  /** Metadata about the extraction process */
  metadata: MiningResultMetadata;

  /** Error message if extraction had issues (partial failure) */
  error?: string;
}

/**
 * Metadata about a mining extraction.
 * Used internally by patterns for tracking.
 */
export interface MiningResultMetadata {
  /** Number of items processed from input */
  itemsProcessed: number;

  /** Number of items successfully enriched */
  itemsEnriched: number;

  /** Average confidence score across enrichments */
  confidence: number;

  /** Processing time in milliseconds (set by engine) */
  processingTimeMs: number;
}

/**
 * Extended metadata for engine-level tracking.
 * Includes additional fields for comprehensive monitoring.
 */
export interface ExtendedMiningResultMetadata extends MiningResultMetadata {
  /** Pattern name that produced this result */
  patternName: string;

  /** Number of items skipped (e.g., below confidence threshold) */
  itemsSkipped: number;

  /** Model used for extraction */
  model: string;

  /** Time taken for extraction in milliseconds */
  durationMs: number;

  /** Token usage for this extraction */
  tokenUsage?: {
    prompt: number;
    completion: number;
    total: number;
  };
}

// ============================================================================
// Enriched Data Types
// ============================================================================

/**
 * Priority level for action items.
 * Inferred from urgency language in the transcript.
 */
export type ActionPriority = 'high' | 'medium' | 'low';

/**
 * Category for notable quotes.
 * Helps organize and filter quotes by their significance.
 */
export type QuoteCategory =
  | 'decision'    // Quote about a decision being made
  | 'commitment'  // Quote expressing a commitment or promise
  | 'concern'     // Quote expressing concern or objection
  | 'insight'     // Quote providing valuable insight
  | 'humor';      // Memorable humorous moment

/**
 * Sentiment classification for quotes.
 */
export type QuoteSentiment = 'positive' | 'negative' | 'neutral';

/**
 * Vote tally for decisions that involved voting.
 */
export interface VoteTally {
  /** Number of votes in favor */
  for: number;

  /** Number of votes against */
  against: number;

  /** Number of abstentions */
  abstain: number;
}

/**
 * Enrichment fields for ActionItem.
 * All fields are optional to maintain backwards compatibility.
 */
export interface ActionItemEnrichment {
  /** ID of the action item being enriched (for matching) */
  id: string;

  /** Who assigned or mentioned this action item (speaker) */
  assignedBy?: string;

  /** Timestamp when the assignment occurred (may differ from task timestamp) */
  assignmentTimestamp?: number;

  /** Inferred priority based on urgency language */
  priority?: ActionPriority;

  /** Whether the action was explicitly stated vs inferred from context */
  isExplicit?: boolean;

  /** Confidence score (0-1) for this enrichment */
  confidence?: number;

  /** Dependencies on other action items or decisions */
  dependencies?: string[];
}

/**
 * Enrichment fields for Decision.
 * All fields are optional to maintain backwards compatibility.
 */
export interface DecisionEnrichment {
  /** ID of the decision being enriched (for matching) */
  id: string;

  /** Who made or announced the decision */
  madeBy?: string;

  /** People who participated in the discussion */
  participants?: string[];

  /** Whether the decision was explicitly stated vs inferred */
  isExplicit?: boolean;

  /** Vote tally if the decision involved voting */
  voteTally?: VoteTally;

  /** Confidence score (0-1) for this enrichment */
  confidence?: number;

  /** Dissenting opinions or objections raised */
  dissent?: string[];
}

/**
 * Enrichment fields for Quote.
 * Used for extracting new quotes (contains full quote data plus enrichment).
 */
export interface QuoteEnrichment {
  /** The exact quote text */
  text: string;

  /** Speaker who said the quote */
  speaker?: string;

  /** Timestamp when the quote was said (in seconds) */
  timestamp: number;

  /** Why this quote is notable or important */
  context?: string;

  /** Category of the quote */
  category?: QuoteCategory;

  /** Sentiment of the quote */
  sentiment?: QuoteSentiment;

  /** Confidence score (0-1) for this extraction */
  confidence?: number;

  /** Related decision or action item IDs */
  relatedIds?: string[];
}

// ============================================================================
// Enriched Analysis Types
// ============================================================================

/**
 * ActionItem with enrichment data.
 * Extends base ActionItem with optional enrichment fields.
 */
export type EnrichedActionItem = ActionItem & ActionItemEnrichment;

/**
 * Decision with enrichment data.
 * Extends base Decision with optional enrichment fields.
 */
export type EnrichedDecision = Decision & DecisionEnrichment;

/**
 * Quote with enrichment data.
 * Extends base Quote with optional enrichment fields.
 */
export type EnrichedQuote = Quote & QuoteEnrichment;

/**
 * Analysis results after enrichment pass.
 * Same structure as AnalysisResults but with enriched types.
 */
export interface EnrichedResults {
  /** Enriched action items */
  actionItems?: EnrichedActionItem[];

  /** Enriched decisions */
  decisions?: EnrichedDecision[];

  /** Enriched quotes (new quotes extracted by mining) */
  quotes?: EnrichedQuote[];
}

// ============================================================================
// Enrichment Metadata
// ============================================================================

/**
 * Metadata tracking enrichment execution.
 * Stored with analysis for debugging and quality assessment.
 */
export interface EnrichmentMetadata {
  /** Whether enrichment was run */
  enrichmentRun: boolean;

  /** Mode used for enrichment */
  mode: 'combined' | 'separate';

  /** Timestamp when enrichment was executed */
  enrichedAt: Date;

  /** Total duration of all enrichment patterns */
  totalDurationMs: number;

  /** Model used for enrichment */
  model: string;

  /** Results from each pattern that was run */
  patternResults: {
    [patternName: string]: {
      success: boolean;
      itemsEnriched: number;
      durationMs: number;
      error?: string;
    };
  };

  /** Overall token usage across all patterns */
  totalTokenUsage?: {
    prompt: number;
    completion: number;
    total: number;
  };

  /** Any warnings generated during enrichment */
  warnings?: string[];
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if an action item has enrichment data.
 */
export function isEnrichedActionItem(
  item: ActionItem | EnrichedActionItem
): item is EnrichedActionItem {
  return (
    'assignedBy' in item ||
    'priority' in item ||
    'isExplicit' in item ||
    'confidence' in item
  );
}

/**
 * Check if a decision has enrichment data.
 */
export function isEnrichedDecision(
  decision: Decision | EnrichedDecision
): decision is EnrichedDecision {
  return (
    'madeBy' in decision ||
    'participants' in decision ||
    'voteTally' in decision ||
    'confidence' in decision
  );
}

/**
 * Check if a quote has enrichment data.
 */
export function isEnrichedQuote(
  quote: Quote | EnrichedQuote
): quote is EnrichedQuote {
  return (
    'category' in quote ||
    'sentiment' in quote ||
    'context' in quote ||
    'confidence' in quote
  );
}

/**
 * Check if analysis results have any enrichment data.
 */
export function hasEnrichmentData(results: AnalysisResults): boolean {
  const hasEnrichedActions = results.actionItems?.some(isEnrichedActionItem) ?? false;
  const hasEnrichedDecisions = results.decisions?.some(isEnrichedDecision) ?? false;
  const hasEnrichedQuotes = results.quotes?.some(isEnrichedQuote) ?? false;

  return hasEnrichedActions || hasEnrichedDecisions || hasEnrichedQuotes;
}

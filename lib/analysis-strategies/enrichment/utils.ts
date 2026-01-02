/**
 * Enrichment Utilities
 *
 * Shared utility functions for the enrichment engine.
 * Includes merge logic, validation, and helper functions.
 */

import type {
  EnrichedResults,
  EnrichedActionItem,
  EnrichedDecision,
  EnrichedQuote,
  ActionPriority,
  QuoteCategory,
  QuoteSentiment,
  VoteTally,
} from '@/types/enrichment';
import type { AnalysisResults } from '@/types';

// ============================================================================
// Internal Types for Partial Enrichment (from API response)
// ============================================================================

/**
 * Partial enrichment fields for action items from API response.
 */
export interface ActionEnrichmentPartial {
  id: string;
  assignedBy?: string;
  assignmentTimestamp?: number;
  priority?: ActionPriority;
  isExplicit?: boolean;
  confidence?: number;
}

/**
 * Partial enrichment fields for decisions from API response.
 */
export interface DecisionEnrichmentPartial {
  id: string;
  madeBy?: string;
  participants?: string[];
  isExplicit?: boolean;
  voteTally?: VoteTally;
  confidence?: number;
}

/**
 * New quotes extracted by mining (complete quote with enrichment).
 */
export interface QuoteExtraction {
  text: string;
  speaker?: string;
  timestamp: number;
  context?: string;
  category?: QuoteCategory;
  sentiment?: QuoteSentiment;
  confidence?: number;
}

/**
 * Partial enrichment result from the mining engine.
 * Contains only enrichment fields, not full objects.
 */
export interface PartialEnrichmentResult {
  actionEnrichments: ActionEnrichmentPartial[];
  decisionEnrichments: DecisionEnrichmentPartial[];
  newQuotes: QuoteExtraction[];
}

// ============================================================================
// Merge Utilities
// ============================================================================

/**
 * Merge partial enrichment results back into original analysis results.
 * This is the primary merge function used by the engine.
 *
 * @param original - Original analysis results
 * @param partial - Partial enrichment results (just enrichment fields)
 * @returns Merged results with enrichment data
 */
export function mergeEnrichmentPartial(
  original: AnalysisResults,
  partial: PartialEnrichmentResult
): EnrichedResults {
  // Build lookup maps for enrichment data by ID
  const actionEnrichmentById = new Map<string, ActionEnrichmentPartial>(
    partial.actionEnrichments.map((a) => [a.id, a])
  );

  const decisionEnrichmentById = new Map<string, DecisionEnrichmentPartial>(
    partial.decisionEnrichments.map((d) => [d.id, d])
  );

  // Merge action items with their enrichments
  const mergedActions: EnrichedActionItem[] = (original.actionItems ?? []).map((action) => {
    const enrichment = actionEnrichmentById.get(action.id);
    if (!enrichment) return action;

    return {
      ...action,
      assignedBy: enrichment.assignedBy ?? action.assignedBy,
      assignmentTimestamp: enrichment.assignmentTimestamp ?? action.assignmentTimestamp,
      priority: enrichment.priority ?? action.priority,
      isExplicit: enrichment.isExplicit ?? action.isExplicit,
      confidence: enrichment.confidence ?? action.confidence,
    };
  });

  // Merge decisions with their enrichments
  const mergedDecisions: EnrichedDecision[] = (original.decisions ?? []).map((decision) => {
    const enrichment = decisionEnrichmentById.get(decision.id);
    if (!enrichment) return decision;

    return {
      ...decision,
      madeBy: enrichment.madeBy ?? decision.madeBy,
      participants: enrichment.participants ?? decision.participants,
      isExplicit: enrichment.isExplicit ?? decision.isExplicit,
      voteTally: enrichment.voteTally ?? decision.voteTally,
      confidence: enrichment.confidence ?? decision.confidence,
    };
  });

  // Merge quotes - combine original with new extracted quotes
  const existingQuoteTexts = new Set(
    (original.quotes ?? []).map((q) => normalizeQuoteText(q.text))
  );

  const newQuotes: EnrichedQuote[] = partial.newQuotes
    .filter((q) => !existingQuoteTexts.has(normalizeQuoteText(q.text)))
    .map((q) => ({
      text: q.text,
      speaker: q.speaker,
      timestamp: q.timestamp,
      context: q.context,
      category: q.category,
      sentiment: q.sentiment,
      confidence: q.confidence,
    }));

  const mergedQuotes: EnrichedQuote[] = [
    ...(original.quotes ?? []),
    ...newQuotes,
  ];

  return {
    actionItems: mergedActions,
    decisions: mergedDecisions,
    quotes: mergedQuotes,
  };
}

/**
 * Merge enrichment results back into original analysis results.
 * Legacy function for backwards compatibility.
 *
 * @param original - Original analysis results
 * @param enriched - Full enrichment results
 * @returns Merged results with enrichment data
 */
export function mergeEnrichment(
  original: AnalysisResults,
  enriched: EnrichedResults
): EnrichedResults {
  // Convert to partial format and use main merge function
  const partial: PartialEnrichmentResult = {
    actionEnrichments: (enriched.actionItems ?? []).map((a) => ({
      id: a.id,
      assignedBy: a.assignedBy,
      assignmentTimestamp: a.assignmentTimestamp,
      priority: a.priority,
      isExplicit: a.isExplicit,
      confidence: a.confidence,
    })),
    decisionEnrichments: (enriched.decisions ?? []).map((d) => ({
      id: d.id,
      madeBy: d.madeBy,
      participants: d.participants,
      isExplicit: d.isExplicit,
      voteTally: d.voteTally,
      confidence: d.confidence,
    })),
    newQuotes: (enriched.quotes ?? []).map((q) => ({
      text: q.text,
      speaker: q.speaker,
      timestamp: q.timestamp,
      context: q.context,
      category: q.category,
      sentiment: q.sentiment,
      confidence: q.confidence,
    })),
  };

  return mergeEnrichmentPartial(original, partial);
}

/**
 * Normalize quote text for comparison.
 */
function normalizeQuoteText(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').trim();
}

// ============================================================================
// Validation Utilities
// ============================================================================

/**
 * Check if analysis results have enough content to warrant enrichment.
 *
 * @param results - Analysis results to check
 * @returns true if enrichment should run
 */
export function shouldEnrich(results: AnalysisResults): boolean {
  const minItems = getMinItemsThreshold();

  const hasDecisions = (results.decisions?.length ?? 0) >= minItems;
  const hasActions = (results.actionItems?.length ?? 0) >= minItems;

  // Enrich if we have either decisions or actions to process
  return hasDecisions || hasActions;
}

/**
 * Get minimum items threshold from environment or default.
 */
function getMinItemsThreshold(): number {
  const envValue = process.env.ENRICHMENT_MIN_ITEMS;
  if (!envValue) return 1;

  const parsed = parseInt(envValue, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 1;
}

/**
 * Validate enriched action item fields.
 */
export function validateEnrichedAction(action: Partial<EnrichedActionItem>): boolean {
  // Check confidence is in valid range
  if (action.confidence !== undefined) {
    if (action.confidence < 0 || action.confidence > 1) return false;
  }

  // Check priority is valid
  if (action.priority !== undefined) {
    if (!['high', 'medium', 'low'].includes(action.priority)) return false;
  }

  // Check timestamp is non-negative
  if (action.assignmentTimestamp !== undefined) {
    if (action.assignmentTimestamp < 0) return false;
  }

  return true;
}

/**
 * Validate enriched decision fields.
 */
export function validateEnrichedDecision(decision: Partial<EnrichedDecision>): boolean {
  // Check confidence is in valid range
  if (decision.confidence !== undefined) {
    if (decision.confidence < 0 || decision.confidence > 1) return false;
  }

  // Check vote tally has valid values
  if (decision.voteTally !== undefined) {
    const { for: f, against, abstain } = decision.voteTally;
    if (f < 0 || against < 0 || abstain < 0) return false;
  }

  // Check participants is an array of strings
  if (decision.participants !== undefined) {
    if (!Array.isArray(decision.participants)) return false;
    if (!decision.participants.every((p) => typeof p === 'string')) return false;
  }

  return true;
}

/**
 * Validate enriched quote fields.
 */
export function validateEnrichedQuote(quote: Partial<EnrichedQuote>): boolean {
  // Check required fields
  if (!quote.text || typeof quote.text !== 'string') return false;
  if (quote.timestamp === undefined || quote.timestamp < 0) return false;

  // Check confidence is in valid range
  if (quote.confidence !== undefined) {
    if (quote.confidence < 0 || quote.confidence > 1) return false;
  }

  // Check category is valid
  if (quote.category !== undefined) {
    const validCategories = ['decision', 'commitment', 'concern', 'insight', 'humor'];
    if (!validCategories.includes(quote.category)) return false;
  }

  // Check sentiment is valid
  if (quote.sentiment !== undefined) {
    if (!['positive', 'negative', 'neutral'].includes(quote.sentiment)) return false;
  }

  return true;
}

// ============================================================================
// Retry Utilities
// ============================================================================

/**
 * Retry a function with exponential backoff.
 * Copied from shared.ts to avoid circular dependencies.
 *
 * @param fn - Function to retry
 * @param attempts - Maximum number of attempts
 * @param initialDelayMs - Initial delay between retries
 * @returns Result of the function
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  attempts: number,
  initialDelayMs: number
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Don't retry on certain errors
      if (error instanceof Error) {
        // Rate limit errors should be retried with longer delay
        if (error.message.includes('429')) {
          const delay = initialDelayMs * Math.pow(3, attempt); // More aggressive backoff
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }

        // Don't retry on auth errors
        if (error.message.includes('401') || error.message.includes('403')) {
          throw error;
        }
      }

      const delay = initialDelayMs * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

// ============================================================================
// Timestamp Utilities
// ============================================================================

/**
 * Format seconds as [MM:SS] string.
 */
export function formatTimestamp(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '[00:00]';

  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `[${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}]`;
}

/**
 * Parse [MM:SS] or [HH:MM:SS] timestamp to seconds.
 */
export function parseTimestamp(timestamp: string): number | null {
  // Match [MM:SS] or [HH:MM:SS] format
  const match = timestamp.match(/\[(\d{1,2}):(\d{2})(?::(\d{2}))?\]/);
  if (!match) return null;

  const parts = match.slice(1).filter(Boolean).map(Number);

  if (parts.length === 2) {
    // [MM:SS]
    return parts[0] * 60 + parts[1];
  } else if (parts.length === 3) {
    // [HH:MM:SS]
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }

  return null;
}

// ============================================================================
// Filter Utilities
// ============================================================================

/**
 * Filter enriched items by confidence threshold.
 */
export function filterByConfidence<T extends { confidence?: number }>(
  items: T[],
  minConfidence: number
): T[] {
  return items.filter((item) => {
    if (item.confidence === undefined) return true; // Keep items without confidence
    return item.confidence >= minConfidence;
  });
}

/**
 * Sort enriched items by confidence (highest first).
 */
export function sortByConfidence<T extends { confidence?: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const confA = a.confidence ?? 0.5;
    const confB = b.confidence ?? 0.5;
    return confB - confA;
  });
}

// ============================================================================
// Statistics Utilities
// ============================================================================

/**
 * Calculate enrichment statistics.
 */
export function calculateEnrichmentStats(results: EnrichedResults): EnrichmentStats {
  const actions = results.actionItems ?? [];
  const decisions = results.decisions ?? [];
  const quotes = results.quotes ?? [];

  // Count items with enrichment data
  const enrichedActions = actions.filter(
    (a) => a.assignedBy || a.priority || a.confidence !== undefined
  ).length;

  const enrichedDecisions = decisions.filter(
    (d) => d.madeBy || d.participants || d.voteTally || d.confidence !== undefined
  ).length;

  const enrichedQuotes = quotes.filter(
    (q) => q.category || q.sentiment || q.context
  ).length;

  // Calculate average confidence
  const allConfidences = [
    ...actions.map((a) => a.confidence).filter((c): c is number => c !== undefined),
    ...decisions.map((d) => d.confidence).filter((c): c is number => c !== undefined),
    ...quotes.map((q) => q.confidence).filter((c): c is number => c !== undefined),
  ];

  const avgConfidence =
    allConfidences.length > 0
      ? allConfidences.reduce((sum, c) => sum + c, 0) / allConfidences.length
      : 0;

  return {
    totalActions: actions.length,
    enrichedActions,
    totalDecisions: decisions.length,
    enrichedDecisions,
    totalQuotes: quotes.length,
    enrichedQuotes,
    averageConfidence: Math.round(avgConfidence * 100) / 100,
  };
}

export interface EnrichmentStats {
  totalActions: number;
  enrichedActions: number;
  totalDecisions: number;
  enrichedDecisions: number;
  totalQuotes: number;
  enrichedQuotes: number;
  averageConfidence: number;
}

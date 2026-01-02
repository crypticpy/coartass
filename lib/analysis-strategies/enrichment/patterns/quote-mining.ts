/**
 * Quote Mining Pattern
 *
 * Extracts and enriches notable quotes with:
 * - Context explaining why the quote is notable
 * - Category classification (decision, commitment, concern, insight, humor)
 * - Sentiment analysis (positive, negative, neutral)
 * - Confidence scores
 *
 * Unlike action/decision mining which enriches existing items,
 * quote mining primarily extracts NEW quotes that the base analysis missed.
 */

import type {
  MiningPattern,
  MiningResult,
  MiningContext,
  QuoteEnrichment,
  QuoteCategory,
  QuoteSentiment,
} from '@/types/enrichment';

/**
 * Quote mining pattern configuration.
 */
export interface QuoteMiningConfig {
  /** Minimum confidence threshold for new quotes (0-1) */
  minConfidence: number;

  /** Maximum number of new quotes to extract */
  maxNewQuotes: number;

  /** Categories to look for */
  categories: QuoteCategory[];

  /** Keywords by category for detection hints */
  categoryKeywords: Record<QuoteCategory, string[]>;
}

/**
 * Default quote mining configuration.
 */
export const DEFAULT_QUOTE_MINING_CONFIG: QuoteMiningConfig = {
  minConfidence: 0.6, // Higher threshold for new extractions
  maxNewQuotes: 10,
  categories: ['decision', 'commitment', 'concern', 'insight', 'humor'],
  categoryKeywords: {
    decision: ['decided', 'agreed', 'concluded', 'resolved', 'approved', 'rejected', 'final'],
    commitment: ['will', 'promise', 'commit', 'guarantee', 'pledge', "i'll", "we'll", 'going to'],
    concern: [
      'worried',
      'concerned',
      'issue',
      'problem',
      'risk',
      'warning',
      'careful',
      'danger',
      'afraid',
    ],
    insight: [
      'realize',
      'understand',
      'key',
      'important',
      'interesting',
      'actually',
      'turns out',
      'discovered',
    ],
    humor: ['funny', 'joke', 'laugh', 'kidding', 'hilarious', 'haha', 'lol'],
  },
};

/**
 * Create the quote mining pattern.
 *
 * @param config - Optional configuration overrides
 * @returns MiningPattern for quote extraction and enrichment
 */
export function createQuoteMiningPattern(
  config: Partial<QuoteMiningConfig> = {}
): MiningPattern<QuoteEnrichment[]> {
  const fullConfig = { ...DEFAULT_QUOTE_MINING_CONFIG, ...config };

  return {
    name: 'quote-mining',
    description:
      'Extracts notable quotes with context, category, sentiment, and confidence',

    buildPrompt(context: MiningContext): string {
      const { segments, existingResults } = context;
      const existingQuotes = existingResults.quotes ?? [];

      // Format segments with IDs
      const segmentText = segments
        .map((s) => `[${s.id}] ${s.speaker ?? 'Unknown'} (${formatTime(s.start)}): ${s.text}`)
        .join('\n');

      // Format existing quotes to avoid duplicates
      const existingQuotesText =
        existingQuotes.length > 0
          ? existingQuotes.map((q, i) => `${i + 1}. "${q.text}" - ${q.speaker ?? 'Unknown'}`).join('\n')
          : 'None';

      return `## Task: Extract Notable Quotes

Analyze the transcript to find notable quotes that should be highlighted.

## Transcript (with segment IDs):
${segmentText}

## Already Extracted Quotes (avoid duplicates):
${existingQuotesText}

## Quote Categories:
- **decision**: Statements about decisions being made
- **commitment**: Promises, pledges, or commitments to action
- **concern**: Expressions of worry, risk, or caution
- **insight**: Valuable realizations or key observations
- **humor**: Memorable humorous moments

## Instructions:
Find up to ${fullConfig.maxNewQuotes} additional notable quotes that are:
1. Not duplicates of existing quotes
2. Significant enough to highlight
3. Exact text from the transcript (no paraphrasing)

For each quote, provide:
1. **text**: Exact quote from transcript (copy verbatim)
2. **speaker**: Who said it
3. **timestamp**: When they said it (in seconds)
4. **context**: Brief explanation of why this quote is notable (1-2 sentences)
5. **category**: One of: decision, commitment, concern, insight, humor
6. **sentiment**: positive, negative, or neutral
7. **confidence**: 0.0-1.0 score for how notable/significant the quote is

## Rules:
- ONLY extract exact text from transcript segments
- Do NOT paraphrase or modify quotes
- Do NOT extract quotes already listed above
- Each quote must come from a single segment
- Use segment timestamp for the quote timestamp
- Minimum confidence threshold: ${fullConfig.minConfidence}

## Response Format (JSON):
{
  "quotes": [
    {
      "text": "Exact quote from transcript",
      "speaker": "Speaker Name",
      "timestamp": 123.45,
      "context": "Why this quote is notable",
      "category": "decision" | "commitment" | "concern" | "insight" | "humor",
      "sentiment": "positive" | "negative" | "neutral",
      "confidence": 0.85
    }
  ]
}`;
    },

    parseResponse(raw: string): MiningResult<QuoteEnrichment[]> {
      try {
        const parsed = JSON.parse(raw);
        const enrichments: QuoteEnrichment[] = [];

        if (!parsed.quotes || !Array.isArray(parsed.quotes)) {
          return {
            data: [],
            metadata: {
              itemsProcessed: 0,
              itemsEnriched: 0,
              confidence: 0,
              processingTimeMs: 0,
            },
          };
        }

        for (const item of parsed.quotes) {
          // Validate required fields
          if (!item.text || typeof item.timestamp !== 'number') continue;

          // Filter by confidence threshold
          const confidence = item.confidence ?? 0.5;
          if (confidence < fullConfig.minConfidence) continue;

          // Validate category
          const category = validateCategory(item.category);
          const sentiment = validateSentiment(item.sentiment);

          enrichments.push({
            text: item.text.trim(),
            speaker: item.speaker,
            timestamp: item.timestamp,
            context: item.context,
            category,
            sentiment,
            confidence,
          });
        }

        // Sort by confidence and limit
        const sortedEnrichments = enrichments
          .sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))
          .slice(0, fullConfig.maxNewQuotes);

        const avgConfidence =
          sortedEnrichments.length > 0
            ? sortedEnrichments.reduce((sum, e) => sum + (e.confidence ?? 0), 0) /
              sortedEnrichments.length
            : 0;

        return {
          data: sortedEnrichments,
          metadata: {
            itemsProcessed: parsed.quotes.length,
            itemsEnriched: sortedEnrichments.length,
            confidence: avgConfidence,
            processingTimeMs: 0, // Set by engine
          },
        };
      } catch {
        return {
          data: [],
          metadata: {
            itemsProcessed: 0,
            itemsEnriched: 0,
            confidence: 0,
            processingTimeMs: 0,
          },
          error: 'Failed to parse quote mining response',
        };
      }
    },

    shouldRun(context: MiningContext): boolean {
      // Always run - can extract new quotes even if some exist
      return context.segments.length > 0;
    },
  };
}

/**
 * Validate and normalize quote category.
 */
function validateCategory(category: unknown): QuoteCategory | undefined {
  const validCategories: QuoteCategory[] = ['decision', 'commitment', 'concern', 'insight', 'humor'];
  if (typeof category === 'string' && validCategories.includes(category as QuoteCategory)) {
    return category as QuoteCategory;
  }
  return undefined;
}

/**
 * Validate and normalize sentiment.
 */
function validateSentiment(sentiment: unknown): QuoteSentiment | undefined {
  const validSentiments: QuoteSentiment[] = ['positive', 'negative', 'neutral'];
  if (typeof sentiment === 'string' && validSentiments.includes(sentiment as QuoteSentiment)) {
    return sentiment as QuoteSentiment;
  }
  return undefined;
}

/**
 * Detect likely category from quote text.
 * Client-side helper for category suggestion.
 *
 * @param text - Quote text
 * @param keywords - Category keywords mapping
 * @returns Most likely category or undefined
 */
export function detectCategory(
  text: string,
  keywords: QuoteMiningConfig['categoryKeywords'] = DEFAULT_QUOTE_MINING_CONFIG.categoryKeywords
): QuoteCategory | undefined {
  const lowerText = text.toLowerCase();

  // Score each category by keyword matches
  const scores: Record<QuoteCategory, number> = {
    decision: 0,
    commitment: 0,
    concern: 0,
    insight: 0,
    humor: 0,
  };

  for (const [category, categoryKeywords] of Object.entries(keywords)) {
    for (const keyword of categoryKeywords) {
      if (lowerText.includes(keyword.toLowerCase())) {
        scores[category as QuoteCategory]++;
      }
    }
  }

  // Find highest scoring category
  let maxScore = 0;
  let maxCategory: QuoteCategory | undefined;

  for (const [category, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score;
      maxCategory = category as QuoteCategory;
    }
  }

  return maxScore > 0 ? maxCategory : undefined;
}

/**
 * Simple sentiment detection based on word lists.
 * Client-side helper for sentiment suggestion.
 *
 * @param text - Quote text
 * @returns Detected sentiment
 */
export function detectSentiment(text: string): QuoteSentiment {
  const lowerText = text.toLowerCase();

  const positiveWords = [
    'great',
    'excellent',
    'good',
    'happy',
    'pleased',
    'success',
    'wonderful',
    'amazing',
    'love',
    'perfect',
    'fantastic',
    'awesome',
    'agree',
    'support',
    'excited',
  ];

  const negativeWords = [
    'bad',
    'terrible',
    'awful',
    'worried',
    'concerned',
    'fail',
    'problem',
    'issue',
    'risk',
    'danger',
    'hate',
    'wrong',
    'disagree',
    'oppose',
    'frustrated',
  ];

  let positiveScore = 0;
  let negativeScore = 0;

  for (const word of positiveWords) {
    if (lowerText.includes(word)) positiveScore++;
  }

  for (const word of negativeWords) {
    if (lowerText.includes(word)) negativeScore++;
  }

  if (positiveScore > negativeScore) return 'positive';
  if (negativeScore > positiveScore) return 'negative';
  return 'neutral';
}

/**
 * Format time in seconds to mm:ss string.
 */
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Pre-built quote mining pattern instance.
 */
export const quoteMiningPattern = createQuoteMiningPattern();

/**
 * Analysis Utilities
 *
 * Provides evidence extraction, TF-IDF scoring, and analysis processing utilities
 * for AI-powered transcript analysis.
 *
 * Features:
 * - TF-IDF (Term Frequency-Inverse Document Frequency) scoring
 * - Keyword-based evidence extraction
 * - Relevance scoring for transcript segments
 * - Prompt generation for GPT-4 analysis
 * - Context building for AI analysis
 * - JSON parsing with fallback for structured AI outputs
 */

import type {
  TranscriptSegment,
  TemplateSection,
  Evidence,
  AnalysisSection,
  AnalysisResults,
  ActionItem,
  Decision,
  Quote,
  Analysis,
} from '@/types';
import type { Template } from '@/types/template';

/**
 * Check if a value is a finite number (not NaN/Infinity)
 */
function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * Parse a timestamp string into seconds.
 *
 * Supports:
 * - "SS"
 * - "MM:SS"
 * - "H:MM:SS"
 * - Bracketed variants like "[MM:SS]"
 */
function parseTimestampToSeconds(value: string): number | null {
  const trimmed = value.trim().replace(/^\[|\]$/g, '');

  // Plain seconds ("42" or "42.5")
  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    const seconds = Number(trimmed);
    return Number.isFinite(seconds) ? seconds : null;
  }

  const parts = trimmed.split(':').map((p) => p.trim());
  if (parts.length < 2 || parts.length > 3) return null;

  const numbers = parts.map((p) => Number(p));
  if (numbers.some((n) => !Number.isFinite(n))) return null;

  if (numbers.length === 2) {
    const [minutes, seconds] = numbers;
    return minutes * 60 + seconds;
  }

  const [hours, minutes, seconds] = numbers;
  return hours * 3600 + minutes * 60 + seconds;
}

/**
 * Parse a timestamp or timestamp range into seconds.
 *
 * Examples:
 * - "0:15"
 * - "0:15-0:20"
 * - "0:15 - 0:20"
 * - "0:15–0:20"
 * - "[0:15 - 0:20]"
 */
function parseTimestampRange(value: string): { start: number; end: number } | null {
  const cleaned = value.trim().replace(/^\[|\]$/g, '');
  const match = cleaned.match(/(\d+(?::\d{1,2}){1,2})(?:\s*[-–]\s*(\d+(?::\d{1,2}){1,2}))?/);
  if (!match) return null;

  const start = parseTimestampToSeconds(match[1]);
  if (!isFiniteNumber(start) || start < 0) return null;

  const end = match[2] ? parseTimestampToSeconds(match[2]) : start;
  if (!isFiniteNumber(end) || end < start) return null;

  return { start, end };
}

/**
 * Strip inline timestamps from text for copy/paste friendly output.
 *
 * Removes patterns like [44], [57], [193], etc. while preserving
 * the surrounding text flow. Cleans up double spaces and trailing
 * whitespace that may result from removal.
 *
 * @example
 * stripTimestamps("They agreed [44] [57] the function is critical")
 * // Returns: "They agreed the function is critical"
 */
export function stripTimestamps(text: string): string {
  if (!text) return text;

  return text
    // Remove [number] patterns (with optional leading/trailing space)
    .replace(/\s*\[\d+\]\s*/g, ' ')
    // Clean up multiple consecutive spaces
    .replace(/\s{2,}/g, ' ')
    // Trim leading/trailing whitespace
    .trim();
}

/**
 * Attempt to normalize "evidence-like" values into the canonical Evidence shape.
 *
 * This handles legacy/LLM-produced shapes so the UI doesn't show "N citations"
 * with nothing renderable.
 */
export function normalizeEvidence(evidence: unknown): Evidence[] {
  if (!Array.isArray(evidence)) return [];

  const normalizeItem = (item: unknown): Evidence | null => {
    // Evidence sometimes arrives as a string in various timestamp formats:
    // - "[0:15]-[0:30] Quote text..." (two separate brackets)
    // - "[0:15-0:30] Quote text..." (range inside one bracket)
    // - "[0:15] Quote text..." (single timestamp)
    if (typeof item === 'string') {
      let start: number | null = null;
      let end: number | null = null;
      let text = item;

      // Try to match [time1]-[time2] format first (separate brackets)
      const twoTimestamps = item.match(/\[(\d+(?::\d{1,2}){1,2})\]\s*[-–]\s*\[(\d+(?::\d{1,2}){1,2})\]/);
      if (twoTimestamps) {
        start = parseTimestampToSeconds(twoTimestamps[1]);
        end = parseTimestampToSeconds(twoTimestamps[2]);
        // Remove the matched timestamp pattern from text
        text = item.replace(/\[\d+(?::\d{1,2}){1,2}\]\s*[-–]\s*\[\d+(?::\d{1,2}){1,2}\]\s*/, '');
      } else {
        // Try single [timestamp] or [range] format
        const bracketed = item.match(/\[([^\]]+)\]/);
        const range = bracketed ? parseTimestampRange(bracketed[1]) : parseTimestampRange(item);
        if (!range) return null;
        start = range.start;
        end = range.end;
        // Remove timestamp patterns from text
        text = item
          .replace(/\[\s*\d+(?::\d{1,2}){1,2}(?:\s*[-–]\s*\d+(?::\d{1,2}){1,2})?\s*\]/, '')
          .replace(/\d+(?::\d{1,2}){1,2}(?:\s*[-–]\s*\d+(?::\d{1,2}){1,2})?/, '');
      }

      // Clean up the text
      text = text.trim().replace(/^[-–\s]+/, '').replace(/^"|"$/g, '').trim();
      if (!text) return null;
      if (!isFiniteNumber(start) || start < 0) return null;
      if (!isFiniteNumber(end) || end < start) return null;

      return {
        text,
        start,
        end,
        relevance: 0.75,
      };
    }

    if (!item || typeof item !== 'object') return null;
    const obj = item as Record<string, unknown>;

    const text =
      (typeof obj.text === 'string' && obj.text.trim()) ||
      (typeof obj.quote === 'string' && obj.quote.trim()) ||
      (typeof obj.snippet === 'string' && obj.snippet.trim()) ||
      (typeof obj.content === 'string' && obj.content.trim()) ||
      '';

    // Prefer explicit start/end; fall back to single timestamp-like fields.
    const rawStart = obj.start ?? obj.timestamp ?? obj.time ?? obj.startTime ?? obj.startTimestamp;
    const rawEnd = obj.end ?? obj.stop ?? obj.endTime ?? obj.endTimestamp;

    const startRange = typeof rawStart === 'string' ? parseTimestampRange(rawStart) : null;
    const endRange = typeof rawEnd === 'string' ? parseTimestampRange(rawEnd) : null;

    const start = (() => {
      if (isFiniteNumber(rawStart)) return rawStart;
      if (startRange) return startRange.start;
      if (typeof rawStart === 'string') return parseTimestampToSeconds(rawStart);
      if (endRange) return endRange.start;
      return null;
    })();

    const end = (() => {
      if (isFiniteNumber(rawEnd)) return rawEnd;
      if (endRange) return endRange.end;
      if (typeof rawEnd === 'string') return parseTimestampToSeconds(rawEnd);
      if (startRange) return startRange.end;
      return start;
    })();

    // Relevance can arrive as 0-1, 0-100, or a string.
    const rawRelevance = obj.relevance ?? obj.score ?? obj.confidence;
    let relevance: number | null = null;
    if (isFiniteNumber(rawRelevance)) relevance = rawRelevance;
    if (typeof rawRelevance === 'string') {
      const cleaned = rawRelevance.trim();
      const parsed = Number(cleaned.replace('%', ''));
      if (Number.isFinite(parsed)) {
        relevance = cleaned.includes('%') ? parsed / 100 : parsed;
      }
    }

    if (relevance !== null && relevance > 1 && relevance <= 100) {
      relevance = relevance / 100;
    }

    if (!text) return null;
    if (!isFiniteNumber(start) || start < 0) return null;
    if (!isFiniteNumber(end) || end < start) return null;

    const finalRelevance =
      relevance !== null && Number.isFinite(relevance)
        ? Math.min(Math.max(relevance, 0), 1)
        : 0.75;

    return {
      text,
      start,
      end,
      relevance: finalRelevance,
    };
  };

  return evidence
    .map(normalizeItem)
    .filter((e): e is Evidence => !!e);
}

export interface EvidenceGenerationOptions {
  /** Template used for analysis (optional, improves keyword selection) */
  template?: Template;
  /** Maximum number of evidence citations per section */
  maxEvidencePerSection?: number;
  /** Minimum relevance score for evidence (0-1) */
  minRelevanceScore?: number;
}

/**
 * Ensure each analysis section has renderable Evidence objects.
 *
 * - If valid evidence exists, keep it (normalized + capped).
 * - If evidence is missing/invalid and we have transcript segments, generate evidence
 *   using keyword matching against transcript segments.
 */
export function ensureEvidenceForResults(
  results: AnalysisResults,
  segments: TranscriptSegment[],
  options: EvidenceGenerationOptions = {}
): AnalysisResults {
  const {
    template,
    maxEvidencePerSection = 5,
    minRelevanceScore = 0.7,
  } = options;

  const templateSectionsByName = new Map(
    template?.sections?.map((s) => [s.name, s]) ?? []
  );

  // Filter out prompt/instruction words that tend to produce junk evidence matches.
  const evidenceStopWords = new Set([
    'add',
    'address',
    'analysis',
    'build',
    'candidate',
    'candidates',
    'choose',
    'create',
    'define',
    'describe',
    'document',
    'draft',
    'ensure',
    'evaluate',
    'example',
    'extract',
    'feature',
    'find',
    'focus',
    'format',
    'generate',
    'include',
    'initiative',
    'list',
    'make',
    'note',
    'output',
    'provide',
    'review',
    'section',
    'show',
    'summarize',
    'summary',
    'support',
    'type',
    'use',
    'write',
  ]);

  const filterEvidenceKeywords = (words: string[]) =>
    words.filter((w) => w.length > 2 && !evidenceStopWords.has(w));

  const sections = results.sections.map((section) => {
    const templateSection = templateSectionsByName.get(section.name);
    const shouldIncludeEvidence =
      templateSection?.extractEvidence !== false;

    if (!shouldIncludeEvidence) {
      return { ...section, evidence: [] };
    }

    const normalized = normalizeEvidence(section.evidence);
    if (normalized.length > 0) {
      return { ...section, evidence: normalized.slice(0, maxEvidencePerSection) };
    }

    // Generate evidence from transcript segments
    const contentKeywords = filterEvidenceKeywords(extractKeywords(section.content)).slice(0, 18);
    const nameKeywords = filterEvidenceKeywords(extractKeywords(section.name)).slice(0, 6);

    const baseKeywords = Array.from(new Set([...contentKeywords, ...nameKeywords]));

    let generated = extractEvidence(
      '', // transcript text unused by extractEvidence currently
      segments,
      baseKeywords,
      maxEvidencePerSection,
      minRelevanceScore,
      {
        minQuoteWords: 20,
        minQuoteChars: 160,
        maxQuoteWords: 90,
        maxQuoteChars: 700,
        maxWindowSeconds: 90,
        maxWindowSegments: 12,
      }
    );

    // If we couldn't find enough matches, fall back to (filtered) prompt keywords
    // and slightly relax relevance.
    if (generated.length < Math.min(2, maxEvidencePerSection) && templateSection) {
      const promptKeywords = filterEvidenceKeywords(
        extractPromptKeywords(templateSection.prompt)
      ).slice(0, 10);

      const relaxed = Math.max(0.55, minRelevanceScore - 0.15);
      generated = extractEvidence(
        '',
        segments,
        Array.from(new Set([...baseKeywords, ...promptKeywords])),
        maxEvidencePerSection,
        relaxed,
        {
          minQuoteWords: 20,
          minQuoteChars: 160,
          maxQuoteWords: 90,
          maxQuoteChars: 700,
          maxWindowSeconds: 90,
          maxWindowSegments: 12,
        }
      );
    }

    return { ...section, evidence: generated };
  });

  return { ...results, sections };
}

/**
 * Extract keywords from a text string (simple tokenization)
 * Removes common stop words and performs basic normalization
 */
export function extractKeywords(text: string): string[] {
  // Common stop words to filter out
  const stopWords = new Set([
    'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from',
    'has', 'he', 'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the',
    'to', 'was', 'will', 'with', 'we', 'you', 'your', 'this', 'they',
    'but', 'or', 'if', 'not', 'what', 'when', 'where', 'who', 'why',
    'how', 'can', 'could', 'should', 'would', 'do', 'does', 'did',
  ]);

  // Tokenize and normalize
  const words = text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ') // Remove punctuation
    .split(/\s+/)
    .filter((word) => word.length > 2 && !stopWords.has(word));

  // Return unique keywords
  return Array.from(new Set(words));
}

/**
 * Calculate term frequency for a document
 */
function calculateTermFrequency(terms: string[]): Map<string, number> {
  const tf = new Map<string, number>();
  const totalTerms = terms.length;

  for (const term of terms) {
    tf.set(term, (tf.get(term) || 0) + 1);
  }

  // Normalize by document length
  tf.forEach((count, term) => {
    tf.set(term, count / totalTerms);
  });

  return tf;
}

/**
 * Calculate inverse document frequency across all segments
 */
function calculateInverseDocumentFrequency(
  segments: TranscriptSegment[]
): Map<string, number> {
  const idf = new Map<string, number>();
  const totalDocuments = segments.length;

  // Count how many documents contain each term
  const documentFrequency = new Map<string, number>();

  segments.forEach((segment) => {
    const terms = new Set(extractKeywords(segment.text));
    terms.forEach((term) => {
      documentFrequency.set(term, (documentFrequency.get(term) || 0) + 1);
    });
  });

  // Calculate IDF: log(total_docs / docs_containing_term)
  documentFrequency.forEach((docCount, term) => {
    idf.set(term, Math.log(totalDocuments / docCount));
  });

  return idf;
}

/**
 * Calculate TF-IDF score for a segment given query keywords
 */
function calculateTFIDFScore(
  segment: TranscriptSegment,
  queryKeywords: string[],
  idf: Map<string, number>
): number {
  const segmentTerms = extractKeywords(segment.text);
  const tf = calculateTermFrequency(segmentTerms);

  let score = 0;
  for (const keyword of queryKeywords) {
    const tfScore = tf.get(keyword) || 0;
    const idfScore = idf.get(keyword) || 0;
    score += tfScore * idfScore;
  }

  return score;
}

/**
 * Calculate simple keyword match score (fallback method)
 */
function calculateKeywordScore(
  segment: TranscriptSegment,
  keywords: string[]
): number {
  const segmentText = segment.text.toLowerCase();
  let score = 0;

  const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  for (const keyword of keywords) {
    const keywordLower = keyword.toLowerCase();
    // Count occurrences
    const escaped = escapeRegExp(keywordLower);
    const occurrences = (segmentText.match(new RegExp(`\\b${escaped}\\b`, 'g')) || []).length;
    score += occurrences;
  }

  // Normalize by segment length
  const wordCount = segment.text.split(/\s+/).length;
  return score / Math.max(wordCount, 1);
}

export interface EvidenceExtractionOptions {
  /** Minimum words in an evidence excerpt (expanded with neighbors if needed) */
  minQuoteWords?: number;
  /** Minimum characters in an evidence excerpt (expanded with neighbors if needed) */
  minQuoteChars?: number;
  /** Maximum words in an evidence excerpt */
  maxQuoteWords?: number;
  /** Maximum characters in an evidence excerpt */
  maxQuoteChars?: number;
  /** Maximum excerpt duration in seconds */
  maxWindowSeconds?: number;
  /** Maximum number of transcript segments to include */
  maxWindowSegments?: number;
}

function buildEvidenceExcerpt(
  segments: TranscriptSegment[],
  centerIndex: number,
  options: Required<EvidenceExtractionOptions>
): { text: string; start: number; end: number } | null {
  let startIndex = centerIndex;
  let endIndex = centerIndex;

  const buildText = (sIdx: number, eIdx: number) =>
    segments
      .slice(sIdx, eIdx + 1)
      .map((s) => s.text)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();

  let text = buildText(startIndex, endIndex);
  let words = text ? text.split(/\s+/).filter(Boolean).length : 0;

  const withinWindowLimits = (sIdx: number, eIdx: number) => {
    const windowSeconds = segments[eIdx].end - segments[sIdx].start;
    const windowSegments = eIdx - sIdx + 1;
    return (
      windowSeconds <= options.maxWindowSeconds &&
      windowSegments <= options.maxWindowSegments
    );
  };

  // Expand excerpt until it has enough substance, respecting hard caps.
  let expandLeftNext = true;
  for (let i = 0; i < options.maxWindowSegments * 2; i++) {
    const needsMore = words < options.minQuoteWords && text.length < options.minQuoteChars;
    if (!needsMore) break;

    const canExpandLeft = startIndex > 0 && withinWindowLimits(startIndex - 1, endIndex);
    const canExpandRight =
      endIndex < segments.length - 1 && withinWindowLimits(startIndex, endIndex + 1);

    if (!canExpandLeft && !canExpandRight) break;

    const tryExpandLeft =
      expandLeftNext ? canExpandLeft : !canExpandRight && canExpandLeft;

    let nextStart = startIndex;
    let nextEnd = endIndex;
    if (tryExpandLeft) {
      nextStart = startIndex - 1;
    } else {
      nextEnd = endIndex + 1;
    }

    const nextText = buildText(nextStart, nextEnd);
    const nextWords = nextText ? nextText.split(/\s+/).filter(Boolean).length : 0;

    // Stop if we'd exceed hard caps.
    if (nextWords > options.maxQuoteWords || nextText.length > options.maxQuoteChars) {
      // Try the other direction once if available
      if (tryExpandLeft && canExpandRight) {
        const altText = buildText(startIndex, endIndex + 1);
        const altWords = altText ? altText.split(/\s+/).filter(Boolean).length : 0;
        if (altWords <= options.maxQuoteWords && altText.length <= options.maxQuoteChars) {
          endIndex = endIndex + 1;
          text = altText;
          words = altWords;
        }
      } else if (!tryExpandLeft && canExpandLeft) {
        const altText = buildText(startIndex - 1, endIndex);
        const altWords = altText ? altText.split(/\s+/).filter(Boolean).length : 0;
        if (altWords <= options.maxQuoteWords && altText.length <= options.maxQuoteChars) {
          startIndex = startIndex - 1;
          text = altText;
          words = altWords;
        }
      }
      break;
    }

    startIndex = nextStart;
    endIndex = nextEnd;
    text = nextText;
    words = nextWords;
    expandLeftNext = !expandLeftNext;
  }

  if (!text) return null;
  return {
    text,
    start: segments[startIndex].start,
    end: segments[endIndex].end,
  };
}

/**
 * Extract top N most relevant segments from transcript based on keywords
 *
 * Uses TF-IDF scoring to find segments most relevant to the given keywords.
 * Falls back to simple keyword matching if TF-IDF produces no results.
 *
 * @param transcript - Full transcript text (not used in current implementation)
 * @param segments - Array of transcript segments with timestamps
 * @param keywords - Keywords or phrases to search for
 * @param topN - Number of top segments to return (default: 5)
 * @param minRelevance - Minimum relevance score (0-1) to include (default: 0.0)
 * @returns Array of Evidence objects with relevance scores
 */
export function extractEvidence(
  transcript: string,
  segments: TranscriptSegment[],
  keywords: string[],
  topN: number = 5,
  minRelevance: number = 0.0,
  options: EvidenceExtractionOptions = {}
): Evidence[] {
  if (segments.length === 0 || keywords.length === 0) {
    return [];
  }

   
  const _transcript = transcript; // Reserved for future evidence extraction improvements

  // Extract keywords from query
  const queryKeywords = Array.from(new Set(keywords.flatMap((k) => extractKeywords(k))));
  if (queryKeywords.length === 0) {
    return [];
  }

  // Calculate IDF for all segments
  const idf = calculateInverseDocumentFrequency(segments);

  // Calculate TF-IDF scores for each segment
  const scoredSegments = segments.map((segment, index) => {
    const tfidfScore = calculateTFIDFScore(segment, queryKeywords, idf);
    const keywordScore = calculateKeywordScore(segment, keywords);

    // Combine both scores (weighted average)
    const combinedScore = tfidfScore * 0.85 + keywordScore * 0.15;

    return {
      segment,
      index,
      score: combinedScore,
    };
  });

  // Sort by score (descending). Pull extra candidates to account for
  // overlap/filters and then truncate to topN at the end.
  const candidateSegments = scoredSegments
    .filter((s) => s.score > 0) // Only include segments with positive scores
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(topN * 4, topN));

  // Normalize scores to 0-1 range
  const maxScore = candidateSegments[0]?.score || 1;

  const resolvedOptions: Required<EvidenceExtractionOptions> = {
    minQuoteWords: options.minQuoteWords ?? 18,
    minQuoteChars: options.minQuoteChars ?? 120,
    maxQuoteWords: options.maxQuoteWords ?? 80,
    maxQuoteChars: options.maxQuoteChars ?? 450,
    maxWindowSeconds: options.maxWindowSeconds ?? 45,
    maxWindowSegments: options.maxWindowSegments ?? 8,
  };

  // Convert to Evidence format, expanding to include enough context and
  // avoiding overlapping windows so citations are distinct.
  const evidence: Evidence[] = [];
  const usedRanges: Array<{ start: number; end: number }> = [];

  const overlapsExisting = (start: number, end: number) =>
    usedRanges.some((r) => start <= r.end && end >= r.start);

  for (const { score, index } of candidateSegments) {
    const relevance = Math.min(score / maxScore, 1);
    if (relevance < minRelevance) continue;

    const excerpt = buildEvidenceExcerpt(segments, index, resolvedOptions);
    if (!excerpt) continue;

    if (overlapsExisting(excerpt.start, excerpt.end)) continue;

    evidence.push({
      text: excerpt.text,
      start: excerpt.start,
      end: excerpt.end,
      relevance,
    });
    usedRanges.push({ start: excerpt.start, end: excerpt.end });

    if (evidence.length >= topN) break;
  }

  return evidence;
}

/**
 * Extract keywords from template section prompt
 *
 * Extracts key terms from the section prompt to use for evidence extraction
 */
export function extractPromptKeywords(sectionPrompt: string): string[] {
  // Extract quoted phrases
  const quotedPhrases = sectionPrompt.match(/"([^"]+)"/g);
  const phrases = quotedPhrases ? quotedPhrases.map((p) => p.replace(/"/g, '')) : [];

  // Extract general keywords from the prompt
  const keywords = extractKeywords(sectionPrompt);

  // Combine and deduplicate
  return Array.from(new Set([...phrases, ...keywords]));
}

/**
 * Generate a structured prompt for GPT-4 analysis
 *
 * Builds a prompt that includes the section requirements, evidence,
 * and instructions for generating the analysis with strict formatting enforcement.
 */
export function generateSectionPrompt(
  section: TemplateSection,
  transcript: string,
  evidence: Evidence[]
): string {
  const evidenceText = evidence.length > 0
    ? evidence
        .map((e, i) => {
          const timestamp = formatTimestamp(e.start);
          return `[${i + 1}] [${timestamp}] "${e.text}" (relevance: ${(e.relevance * 100).toFixed(0)}%)`;
        })
        .join('\n')
    : 'No specific evidence found for this section.';

  // Build format-specific instructions with strict constraints
  let formatInstructions = '';

  if (section.outputFormat === 'bullet_points') {
    formatInstructions = `
FORMAT REQUIREMENTS FOR BULLET POINTS:
- Use the "-" character for bullet points
- Maximum 10 bullet points
- Each bullet point must be 15 words or less
- Start each bullet with an action verb or key concept
- No sub-bullets or nested lists
- Use proper capitalization and punctuation
- Group related points together

EXAMPLE OUTPUT:
- Team approved new design system with accessible components
- Budget increased by $50K for Q4 marketing campaign
- Engineering to complete API migration by December 31st
- Marketing launching social media campaign next Monday`;
  } else if (section.outputFormat === 'paragraph') {
    formatInstructions = `
FORMAT REQUIREMENTS FOR PARAGRAPHS:
- Write 1-3 coherent paragraphs maximum
- Each paragraph should be 50-100 words
- Use line breaks between paragraphs
- Focus on narrative flow and connections between ideas
- Avoid walls of text - keep paragraphs scannable
- Use transition words between ideas

EXAMPLE OUTPUT:
The team made significant progress on the product roadmap. Key features were prioritized based on customer feedback and technical feasibility. The engineering team committed to delivering the core functionality by end of quarter.

Budget discussions resulted in approval for additional resources. Marketing will receive increased funding for the product launch campaign. The finance team will track spending against revised projections.`;
  } else if (section.outputFormat === 'table') {
    formatInstructions = `
FORMAT REQUIREMENTS FOR TABLES:
- Use markdown table syntax with pipes (|) and hyphens (-)
- Include header row with clear column names
- Maximum 10 rows (excluding header)
- Keep cell content concise (under 20 words per cell)
- Align columns properly using hyphens

EXAMPLE OUTPUT:
| Topic | Decision | Owner | Deadline |
|-------|----------|-------|----------|
| Budget | Approved $50K increase | Finance | Dec 15 |
| Design | New component library | Engineering | Jan 1 |`;
  }

  return `You are analyzing a meeting transcript to extract specific information.

SECTION: ${section.name}
TASK: ${section.prompt}

OUTPUT FORMAT: ${section.outputFormat}${formatInstructions}

CRITICAL CONSTRAINTS:
1. DO NOT include excessive detail or supporting evidence in your output
2. DO NOT repeat information from the evidence verbatim
3. DO NOT create walls of text - maintain readability
4. FOCUS on key takeaways and actionable information
5. BE CONCISE - quality over quantity

RELEVANT EVIDENCE FROM TRANSCRIPT:
${evidenceText}

FULL TRANSCRIPT (for context only - prioritize evidence above):
${transcript}

Provide your analysis following the EXACT format requirements above. Be accurate, concise, and well-structured.`;
}

/**
 * Format timestamp in MM:SS or HH:MM:SS format
 */
export function formatTimestamp(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Safely parse JSON from AI response
 * Handles code blocks, trailing commas, and other common AI JSON issues
 */
export function safeParseJSON<T>(content: string): T | null {
  try {
    // Remove markdown code blocks if present
    let jsonStr = content.trim();
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```(?:json)?/, '').replace(/```$/, '');
    }
    jsonStr = jsonStr.trim();

    return JSON.parse(jsonStr) as T;
  } catch (error) {
    console.error('Failed to parse JSON:', error);
    return null;
  }
}

/**
 * Normalize text for comparison (remove punctuation, lower case, extra spaces)
 */
function normalizeForMatch(text: string): string {
  return text.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * Find the best matching timestamp for a quote or text segment
 */
export function findMatchingSegment(
  text: string,
  segments: TranscriptSegment[]
): TranscriptSegment | undefined {
  if (!text || segments.length === 0) return undefined;

  const normalizedSearch = normalizeForMatch(text);
  if (normalizedSearch.length < 5) return undefined;

  // 1. Try exact substring match of normalized text
  let bestMatch: TranscriptSegment | undefined;
  let bestScore = 0;

  for (const segment of segments) {
    const normalizedSeg = normalizeForMatch(segment.text);
    
    // Exact match
    if (normalizedSeg.includes(normalizedSearch)) {
      return segment;
    }

    // Partial match / overlap scoring
    // This is a simple heuristic: check how many words overlap
    const searchWords = normalizedSearch.split(' ');
    let matchCount = 0;
    
    for (const word of searchWords) {
      if (word.length > 3 && normalizedSeg.includes(word)) {
        matchCount++;
      }
    }

    const score = matchCount / searchWords.length;
    if (score > bestScore && score > 0.6) { // 60% word match threshold
      bestScore = score;
      bestMatch = segment;
    }
  }

  return bestMatch;
}

/**
 * Parse GPT-4 response for action items
 * Tries JSON parsing first, then falls back to regex patterns
 */
export function parseActionItems(content: string): ActionItem[] {
  // 1. Try JSON parsing
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const jsonData = safeParseJSON<any[]>(content);
  if (jsonData && Array.isArray(jsonData)) {
    return jsonData.map((item, index) => ({
      id: item.id || `action-${index + 1}`,
      task: item.task || item.action || item.description || '',
      owner: item.owner || item.assignee || undefined,
      deadline: item.deadline || item.due_date || item.dueDate || undefined,
      timestamp: item.timestamp || 0, // Required - default to 0 if not provided
    })).filter(item => item.task.length > 0);
  }

  // 2. Fallback to regex patterns
  const actionItems: ActionItem[] = [];

  // Look for common action item patterns
  const patterns = [
    /(?:^|\n)[-*]\s*(.+?)(?:\s*\[(?:owner|assigned to|responsible):\s*(.+?)\])?(?:\s*\[(?:due|deadline|by):\s*(.+?)\])?(?:\n|$)/gi,
    /(?:^|\n)\d+\.\s*(.+?)(?:\s*\[(?:owner|assigned to|responsible):\s*(.+?)\])?(?:\s*\[(?:due|deadline|by):\s*(.+?)\])?(?:\n|$)/gi,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const task = match[1]?.trim();
      const owner = match[2]?.trim();
      const deadline = match[3]?.trim();

      if (task) {
        actionItems.push({
          id: `action-${actionItems.length + 1}`,
          task,
          owner: owner || undefined,
          deadline: deadline || undefined,
          timestamp: 0, // Required - default to 0 when extracting from legacy patterns
        });
      }
    }
  }

  return actionItems;
}

/**
 * Parse GPT-4 response for decisions
 * Tries JSON parsing first, then falls back to regex patterns
 */
export function parseDecisions(content: string, segments: TranscriptSegment[]): Decision[] {
  const decisions: Decision[] = [];

  // 1. Try JSON parsing
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const jsonData = safeParseJSON<any[]>(content);
  if (jsonData && Array.isArray(jsonData)) {
    return jsonData.map((item, index) => {
      const decisionText = item.decision || item.text || '';
      const matchingSegment = findMatchingSegment(decisionText, segments);

      return {
        id: item.id || `decision-${index + 1}`,
        decision: decisionText,
        context: item.context || item.rationale || undefined,
        timestamp: matchingSegment?.start || 0,
      };
    }).filter(item => item.decision.length > 0);
  }

  // 2. Fallback to text parsing
  const lines = content.split('\n').map(line => line.trim());

  let currentDecision: Partial<Decision> | null = null;

  for (const line of lines) {
    if (!line) continue;

    // Check if it's a new numbered decision (1., 2., etc.)
    const decisionMatch = line.match(/^(\d+)\.\s*(.+)$/);

    if (decisionMatch) {
      // Save previous decision if exists
      if (currentDecision && currentDecision.decision) {
        decisions.push(currentDecision as Decision);
      }

      // Start new decision
      currentDecision = {
        id: `decision-${decisions.length + 1}`,
        decision: decisionMatch[2].trim(),
        timestamp: 0,
        context: undefined,
      };
    } else if (currentDecision && line.toLowerCase().startsWith('context:')) {
      // Add context to current decision
      currentDecision.context = line.replace(/^context:\s*/i, '').trim();
    } else if (currentDecision && !line.match(/^[-*•]\s/)) {
      // Continuation of context (multi-line) or indented text
      // Skip if it looks like a new bullet point
      if (currentDecision.context) {
        currentDecision.context = `${currentDecision.context} ${line}`;
      } else {
        // This might be context without "Context:" prefix
        currentDecision.context = line;
      }
    } else if (!currentDecision) {
      // Legacy format: bullet or plain text without numbering
      const match = line.match(/^[-*•]\s*(.+)$/);
      const decisionText = match ? match[1].trim() : line;

      if (decisionText.length >= 10) {
        decisions.push({
          id: `decision-${decisions.length + 1}`,
          decision: decisionText,
          timestamp: 0,
          context: undefined,
        });
      }
    }
  }

  // Push final decision if exists
  if (currentDecision && currentDecision.decision) {
    decisions.push(currentDecision as Decision);
  }

  // Match timestamps using fuzzy search
  return decisions.map(decision => {
    const relevantSegment = findMatchingSegment(decision.decision, segments);

    return {
      ...decision,
      timestamp: relevantSegment?.start || 0,
      // Only use segment text as context if we don't already have context
      context: decision.context || (relevantSegment?.text),
    };
  });
}

/**
 * Parse GPT-4 response for notable quotes
 * Tries JSON parsing first, then falls back to regex patterns
 */
export function parseQuotes(content: string, segments: TranscriptSegment[]): Quote[] {
  const quotes: Quote[] = [];

  // 1. Try JSON parsing
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const jsonData = safeParseJSON<any[]>(content);
  if (jsonData && Array.isArray(jsonData)) {
    jsonData.forEach(item => {
      const quoteText = typeof item === 'string' ? item : (item.quote || item.text);
      if (!quoteText) return;

      const matchingSegment = findMatchingSegment(quoteText, segments);
      
      if (matchingSegment) {
        quotes.push({
          text: quoteText,
          speaker: matchingSegment.speaker,
          timestamp: matchingSegment.start,
        });
      } else {
        // If no match found, add it anyway with best guess or 0
        quotes.push({
          text: quoteText,
          speaker: item.speaker || undefined,
          timestamp: 0,
        });
      }
    });
    
    if (quotes.length > 0) return quotes;
  }

  // 2. Fallback to regex for quoted text
  const quotePattern = /"([^"]{10,})"/g;
  let match;

  while ((match = quotePattern.exec(content)) !== null) {
    const quoteText = match[1].trim();
    const matchingSegment = findMatchingSegment(quoteText, segments);

    if (matchingSegment) {
      quotes.push({
        text: quoteText,
        speaker: matchingSegment.speaker,
        timestamp: matchingSegment.start,
      });
    }
  }

  return quotes;
}

/**
 * Build context-aware analysis prompt
 *
 * Creates a comprehensive prompt for overall transcript analysis
 */
export function buildAnalysisContext(
  transcript: string,
  segments: TranscriptSegment[],
  templateName: string
): string {
  const duration = segments.length > 0
    ? formatTimestamp(segments[segments.length - 1].end)
    : '0:00';

  const speakers = Array.from(
    new Set(segments.filter((s) => s.speaker).map((s) => s.speaker))
  );

  const speakerInfo = speakers.length > 0
    ? `\nParticipants: ${speakers.join(', ')}`
    : '';

  return `Transcript Duration: ${duration}${speakerInfo}
Segment Count: ${segments.length}
Template: ${templateName}

Transcript:
${transcript}`;
}

/**
 * Validate analysis section output
 */
export function validateAnalysisSection(section: AnalysisSection): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!section.name || section.name.trim().length === 0) {
    errors.push('Section name is required');
  }

  if (!section.content || section.content.trim().length === 0) {
    errors.push('Section content is required');
  }

  if (!Array.isArray(section.evidence)) {
    errors.push('Section evidence must be an array');
  } else {
    section.evidence.forEach((e, i) => {
      if (typeof e.text !== 'string' || e.text.trim().length === 0) {
        errors.push(`Evidence ${i + 1}: text is required`);
      }
      if (typeof e.start !== 'number' || e.start < 0) {
        errors.push(`Evidence ${i + 1}: invalid start timestamp`);
      }
      if (typeof e.end !== 'number' || e.end < e.start) {
        errors.push(`Evidence ${i + 1}: invalid end timestamp`);
      }
      if (typeof e.relevance !== 'number' || e.relevance < 0 || e.relevance > 1) {
        errors.push(`Evidence ${i + 1}: relevance must be between 0 and 1`);
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Truncate transcript if too long for API limits
 *
 * GPT-4 has token limits, so we need to handle very long transcripts
 */
export function truncateTranscriptForPrompt(
  transcript: string,
  maxTokens: number = 32000 // Approximate limit for GPT-5/GPT-41 outputs
): string {
  const maxChars = maxTokens * 4;

  if (transcript.length <= maxChars) {
    return transcript;
  }

  // Truncate and add notice
  const truncated = transcript.substring(0, maxChars);
  return `${truncated}\n\n[Note: Transcript truncated due to length. ${transcript.length - maxChars} characters omitted.]`;
}

/**
 * Capitalize the first letter of a string
 */
function capitalizeFirstLetter(str: string): string {
  if (!str || str.length === 0) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Format section content for consistent display and copy
 *
 * Handles common LLM formatting issues:
 * - Capitalizes bullets and numbered lists
 * - Normalizes whitespace and line breaks
 * - Ensures proper paragraph spacing
 * - Cleans up formatting artifacts
 *
 * @param content - Raw section content from LLM
 * @returns Formatted, clean markdown-style text
 */
export function formatSectionContent(content: string): string {
  if (!content || typeof content !== 'string') {
    return '';
  }

  // 1. Normalize line endings (CRLF → LF)
  let text = content.replace(/\r\n/g, '\n');

  // 2. Remove excessive whitespace
  text = text.replace(/[ \t]+/g, ' '); // Multiple spaces/tabs → single space
  text = text.replace(/\n{4,}/g, '\n\n\n'); // Max 3 consecutive newlines

  // 3. Split into blocks (paragraphs separated by blank lines)
  const blocks = text.split(/\n\s*\n/);
  const formattedBlocks: string[] = [];

  for (let block of blocks) {
    // Trim the block
    block = block.trim();
    if (!block) continue;

    // Split block into lines
    const lines = block.split('\n').map(line => line.trim()).filter(Boolean);
    const formattedLines: string[] = [];

    for (const line of lines) {
      let formattedLine = line;

      // Handle bullet points (-, •, *)
      if (/^[-•*]\s+/.test(line)) {
        const bulletMatch = line.match(/^([-•*])\s+(.+)$/);
        if (bulletMatch) {
          const bullet = bulletMatch[1];
          const text = bulletMatch[2].trim();
          formattedLine = `${bullet} ${capitalizeFirstLetter(text)}`;
        }
      }
      // Handle numbered lists (1., 2., etc.)
      else if (/^\d+\.\s+/.test(line)) {
        const numberedMatch = line.match(/^(\d+\.)\s+(.+)$/);
        if (numberedMatch) {
          const number = numberedMatch[1];
          const text = numberedMatch[2].trim();
          formattedLine = `${number} ${capitalizeFirstLetter(text)}`;
        }
      }
      // Handle checkboxes (- [ ] or - [x])
      else if (/^-\s*\[(x| )\]\s+/.test(line)) {
        const checkboxMatch = line.match(/^(-\s*\[(x| )\])\s+(.+)$/);
        if (checkboxMatch) {
          const checkbox = checkboxMatch[1];
          const text = checkboxMatch[3].trim();
          formattedLine = `${checkbox} ${capitalizeFirstLetter(text)}`;
        }
      }

      formattedLines.push(formattedLine);
    }

    // Join lines in this block
    // If all lines are list items, join with single newline
    // Otherwise, treat as paragraph and join with space
    const allListItems = formattedLines.every(line =>
      /^[-•*]\s+/.test(line) ||
      /^\d+\.\s+/.test(line) ||
      /^-\s*\[(x| )\]\s+/.test(line)
    );

    if (allListItems) {
      // This is a list block - preserve line breaks
      formattedBlocks.push(formattedLines.join('\n'));
    } else {
      // This is a paragraph block
      // Check if it's a single line or multiple related lines
      if (formattedLines.length === 1) {
        formattedBlocks.push(formattedLines[0]);
      } else {
        // Check if this looks like Q&A format (questionnaire output)
        // Patterns: "Q1 (topic):", "Source:", "Confidence:", or lines ending with timestamps like [123]
        const isQAFormat = formattedLines.some(line =>
          /^Q\d+\s*[\(\[]/.test(line) ||  // Q1 (topic) or Q1 [topic]
          /^Source:/i.test(line) ||        // Source: line
          /^Confidence:/i.test(line) ||    // Confidence: line
          /\[\d+\]\s*$/.test(line)         // Ends with [timestamp]
        );

        // Check if lines contain pipe-delimited key-value pairs
        // Pattern: "Field: Value | Field: Value" (common in action items, decisions, etc.)
        const hasPipeDelimitedPairs = formattedLines.some(line =>
          /\w+:\s*[^|]+\s*\|\s*\w+:/.test(line)  // At least two "Key: Value |" patterns
        );

        if (isQAFormat || hasPipeDelimitedPairs) {
          // Preserve line breaks for structured formats
          formattedBlocks.push(formattedLines.join('\n'));
        } else {
          // Multiple lines might be a paragraph split across lines
          // Join them intelligently
          const paragraph = formattedLines.join(' ');
          formattedBlocks.push(paragraph);
        }
      }
    }
  }

  // 4. Join blocks with double newlines for proper spacing
  const formatted = formattedBlocks.join('\n\n');

  // 5. Final cleanup
  return formatted
    .replace(/\n{3,}/g, '\n\n') // Ensure max 2 consecutive newlines
    .trim();
}

/**
 * Build a concise, email-friendly summary of analysis results.
 *
 * Includes:
 * - Optional header with template name
 * - Formatted creation date
 * - Executive summary (if present)
 * - Each section name and narrative content
 *
 * Excludes supporting artifacts such as evidence, action items,
 * decisions, quotes, and timestamps.
 */
export function buildAnalysisSummaryText(
  analysis: Analysis,
  template?: Template
): string {
  const lines: string[] = [];
  const headerTitle = template?.name ? `${template.name} Analysis` : 'Radio Traffic Analysis';

  lines.push(headerTitle);

  try {
    const createdAt = analysis.createdAt instanceof Date
      ? analysis.createdAt
      : new Date(analysis.createdAt);

    const formattedDate = new Intl.DateTimeFormat('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    }).format(createdAt);

    lines.push(`Date: ${formattedDate}`);
  } catch {
    // If date formatting fails, skip the date line
  }

  lines.push(''); // Blank line after header

  const { results } = analysis;

  if (results.summary) {
    lines.push('Executive Summary');
    lines.push('-'.repeat('Executive Summary'.length));
    lines.push('');
    // Strip timestamps from executive summary for clean copy/paste output
    lines.push(stripTimestamps(formatSectionContent(results.summary)));
    lines.push('');
  }

  if (results.benchmarks && results.benchmarks.length > 0) {
    lines.push('Benchmarks & Milestones');
    lines.push('-'.repeat('Benchmarks & Milestones'.length));
    lines.push('');

    results.benchmarks.forEach((b) => {
      const parts: string[] = [b.benchmark, `Status: ${b.status.replace(/_/g, ' ')}`];

      if (typeof b.timestamp === 'number') {
        parts.push(`Time: ${formatTimestamp(b.timestamp)}`);
      }

      if (b.unitOrRole) {
        parts.push(`Unit/Role: ${b.unitOrRole}`);
      }

      lines.push(`- ${parts.join(' | ')}`);
      if (b.evidenceQuote) {
        lines.push(`  Evidence: "${b.evidenceQuote}"`);
      }
      if (b.notes) {
        lines.push(`  Notes: ${b.notes}`);
      }
    });

    lines.push('');
  }

  if (results.radioReports && results.radioReports.length > 0) {
    lines.push('Radio Reports');
    lines.push('-'.repeat('Radio Reports'.length));
    lines.push('');

    results.radioReports.forEach((r) => {
      const headerParts: string[] = [
        formatTimestamp(r.timestamp),
        r.type.replace(/_/g, ' ').toUpperCase(),
      ];
      if (r.from) headerParts.push(`From: ${r.from}`);
      lines.push(`- ${headerParts.join(' | ')}`);

      if (r.fields && Object.keys(r.fields).length > 0) {
        Object.entries(r.fields).forEach(([key, value]) => {
          lines.push(`  - ${key}: ${String(value)}`);
        });
      }

      if (r.missingRequired && r.missingRequired.length > 0) {
        lines.push(`  Missing: ${r.missingRequired.join(', ')}`);
      }

      if (r.evidenceQuote) {
        lines.push(`  Evidence: "${r.evidenceQuote}"`);
      }
    });

    lines.push('');
  }

  if (results.safetyEvents && results.safetyEvents.length > 0) {
    lines.push('Safety & Accountability');
    lines.push('-'.repeat('Safety & Accountability'.length));
    lines.push('');

    results.safetyEvents.forEach((e) => {
      const parts: string[] = [
        formatTimestamp(e.timestamp),
        e.type.replace(/_/g, ' ').toUpperCase(),
        `Severity: ${e.severity.toUpperCase()}`,
      ];
      if (e.unitOrRole) parts.push(`Unit/Role: ${e.unitOrRole}`);
      lines.push(`- ${parts.join(' | ')}`);
      lines.push(`  Details: ${e.details}`);
      if (e.evidenceQuote) {
        lines.push(`  Evidence: "${e.evidenceQuote}"`);
      }
    });

    lines.push('');
  }

  // Filter out legacy meeting-era sections that are not used in RTASS outputs.
  const filteredSections = results.sections.filter(section => {
    const lowerName = section.name.toLowerCase();
    return ![
      'action items',
      'action items for improvement',
      'key decisions',
      'decisions',
      'notable quotes',
      'quotes',
    ].includes(lowerName);
  });

  filteredSections.forEach((section, index) => {
    lines.push(section.name);
    lines.push('-'.repeat(section.name.length));
    lines.push('');
    lines.push(formatSectionContent(section.content));

    if (index < filteredSections.length - 1) {
      lines.push('');
    }
  });

  return lines
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

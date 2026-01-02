/**
 * LLM-Powered Evidence Citations
 *
 * Generates human-readable "supporting evidence" by using a small model
 * (e.g. gpt-4.1-mini) to locate transcript excerpts that support each
 * analysis section.
 *
 * Strategy:
 * 1) Ask the model (chunk-by-chunk) to propose grounded segment ranges per section
 * 2) Build excerpts from those ranges using transcript timestamps
 * 3) Ask the model to select the best excerpts per section
 *
 * Important: The model is only allowed to reference provided segment ids.
 */

import type OpenAI from 'openai';
import type { Evidence, TranscriptSegment, TemplateSection } from '@/types';

export interface CitationSectionInput {
  name: string;
  content: string;
}

export interface CitationSectionResult {
  name: string;
  evidence: Evidence[];
}

interface SectionForPrompt {
  name: string;
  content: string;
  task?: string;
}

interface SegmentForPrompt {
  id: number;
  start: number;
  end: number;
  speaker?: string;
  text: string;
}

interface ExcerptOptions {
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

interface CitationCandidate extends Evidence {
  id: string;
}

interface CitationSelectionResponse {
  sections: Array<{
    name: string;
    citations: string[];
  }>;
}

interface ChunkCitation {
  startId: number;
  endId: number;
}

interface ChunkCitationsResponse {
  sections: Array<{
    name: string;
    citations: ChunkCitation[];
  }>;
}

function truncateForPrompt(text: string, maxChars: number): string {
  if (!text) return '';
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxChars) return normalized;
  return `${normalized.slice(0, maxChars - 1)}…`;
}

function chunkSegments<T>(
  items: T[],
  maxItemsPerChunk: number,
  overlap: number
): T[][] {
  if (items.length === 0) return [];
  if (maxItemsPerChunk <= 0) return [items];

  const chunks: T[][] = [];
  let startIndex = 0;
  while (startIndex < items.length) {
    const endIndex = Math.min(items.length, startIndex + maxItemsPerChunk);
    chunks.push(items.slice(startIndex, endIndex));

    if (endIndex >= items.length) break;
    startIndex = Math.max(0, endIndex - overlap);
  }

  return chunks;
}

function parsePositiveInt(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  const rounded = Math.floor(parsed);
  return rounded > 0 ? rounded : null;
}

function selectEvenlySpacedIndices(total: number, max: number): number[] {
  if (total <= 0 || max <= 0) return [];
  if (total <= max) return Array.from({ length: total }, (_, i) => i);
  if (max === 1) return [0];

  const indices = new Set<number>();
  for (let i = 0; i < max; i++) {
    const idx = Math.round((i * (total - 1)) / (max - 1));
    indices.add(Math.min(Math.max(idx, 0), total - 1));
  }

  return Array.from(indices).sort((a, b) => a - b);
}

function buildChunkExtractionPrompt(input: {
  maxCitationsPerSection: number;
  sections: SectionForPrompt[];
  segments: Array<{
    id: number;
    start: number;
    end: number;
    speaker?: string;
    text: string;
  }>;
}): string {
  return `
You are extracting grounded supporting-evidence quotes for a meeting analysis.

Goal: For EACH section, find up to ${input.maxCitationsPerSection} transcript excerpts in this chunk that best support the section content.

How to interpret input:
- sections[].content: the generated analysis content for that section (primary signal)
- sections[].task: what the section is intended to cover (template prompt; secondary signal)
- segments[]: timestamped transcript segments for this chunk

Rules:
- ONLY use segment ids that appear in the provided "segments" list.
- A citation must be a contiguous range of segments, returned as { "startId": number, "endId": number } (inclusive).
- Prefer excerpts that make sense on their own (include enough context).
- Prefer concrete details, decisions, and recommendations (avoid short questions, confirmations, or filler).
- Avoid excerpts that are only a question; include the answer/context that makes it understandable.
- If this chunk does not contain relevant support for a section, return an empty citations array for that section.

Return valid JSON in this exact shape:
{
  "sections": [
    { "name": "Section Name", "citations": [ { "startId": 123, "endId": 128 } ] }
  ]
}

Input:
${JSON.stringify(input)}
`.trim();
}

function isValidChunkCitationsResponse(data: unknown): data is ChunkCitationsResponse {
  if (!data || typeof data !== 'object') return false;
  const obj = data as Record<string, unknown>;
  if (!Array.isArray(obj.sections)) return false;

  for (const section of obj.sections) {
    if (!section || typeof section !== 'object') return false;
    const s = section as Record<string, unknown>;
    if (typeof s.name !== 'string') return false;
    if (!Array.isArray(s.citations)) return false;

    for (const citation of s.citations) {
      if (!citation || typeof citation !== 'object') return false;
      const c = citation as Record<string, unknown>;
      if (typeof c.startId !== 'number' || !Number.isFinite(c.startId)) return false;
      if (typeof c.endId !== 'number' || !Number.isFinite(c.endId)) return false;
    }
  }

  return true;
}

function buildExcerptFromRange(
  segments: SegmentForPrompt[],
  idToIndex: Map<number, number>,
  range: ChunkCitation,
  options: Required<ExcerptOptions>
): Evidence | null {
  const startIndexRaw = idToIndex.get(range.startId);
  const endIndexRaw = idToIndex.get(range.endId);
  if (startIndexRaw === undefined || endIndexRaw === undefined) return null;

  let startIndex = Math.min(startIndexRaw, endIndexRaw);
  let endIndex = Math.max(startIndexRaw, endIndexRaw);

  const buildText = (sIdx: number, eIdx: number) =>
    segments
      .slice(sIdx, eIdx + 1)
      .map((s) => s.text)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();

  const withinWindowLimits = (sIdx: number, eIdx: number) => {
    const windowSeconds = segments[eIdx].end - segments[sIdx].start;
    const windowSegments = eIdx - sIdx + 1;
    return windowSeconds <= options.maxWindowSeconds && windowSegments <= options.maxWindowSegments;
  };

  let text = buildText(startIndex, endIndex);
  let words = text ? text.split(/\s+/).filter(Boolean).length : 0;

  let expandLeftNext = true;
  for (let i = 0; i < options.maxWindowSegments * 2; i++) {
    const needsMore = words < options.minQuoteWords && text.length < options.minQuoteChars;
    if (!needsMore) break;

    const canExpandLeft = startIndex > 0 && withinWindowLimits(startIndex - 1, endIndex);
    const canExpandRight = endIndex < segments.length - 1 && withinWindowLimits(startIndex, endIndex + 1);
    if (!canExpandLeft && !canExpandRight) break;

    const tryExpandLeft = expandLeftNext ? canExpandLeft : !canExpandRight && canExpandLeft;
    let nextStart = startIndex;
    let nextEnd = endIndex;
    if (tryExpandLeft) {
      nextStart = startIndex - 1;
    } else {
      nextEnd = endIndex + 1;
    }

    const nextText = buildText(nextStart, nextEnd);
    const nextWords = nextText ? nextText.split(/\s+/).filter(Boolean).length : 0;

    if (nextWords > options.maxQuoteWords || nextText.length > options.maxQuoteChars) break;

    startIndex = nextStart;
    endIndex = nextEnd;
    text = nextText;
    words = nextWords;
    expandLeftNext = !expandLeftNext;
  }

  if (!text) return null;

  // Require a minimally self-contained quote. If we couldn't expand enough
  // within the window limits, discard rather than returning a meaningless snippet.
  const meetsMinimum = words >= options.minQuoteWords || text.length >= options.minQuoteChars;
  if (!meetsMinimum) return null;

  return {
    text,
    start: segments[startIndex].start,
    end: segments[endIndex].end,
    relevance: 0.85,
  };
}

function buildSelectionPrompt(input: {
  maxCitationsPerSection: number;
  sections: Array<{
    name: string;
    content: string;
    task?: string;
    candidates: Array<{
      id: string;
      start: number;
      end: number;
      text: string;
    }>;
  }>;
}): string {
  return `
You are selecting supporting evidence quotes for a meeting analysis.

Goal: For EACH section, choose up to ${input.maxCitationsPerSection} transcript excerpts that best support the section's content.

How to interpret input:
- sections[].content: the generated analysis content for that section (primary signal)
- sections[].task: what the section is intended to cover (template prompt; secondary signal)

Rules:
- ONLY choose from the provided candidates for that section (by candidate id).
- Prefer excerpts that contain concrete details and recommendations (not just short questions or filler).
- Prefer excerpts that make sense on their own (include enough context).
- Avoid excerpts that are only a question; prefer the segment(s) where the team explains or decides something.
- Choose citations that cover different points when possible.
- If no candidate is actually relevant, return an empty citations array for that section.

Return valid JSON in this exact shape:
{
  "sections": [
    { "name": "Section Name", "citations": ["c1", "c4"] }
  ]
}

Input:
${JSON.stringify(input)}
`.trim();
}

function isValidSelectionResponse(data: unknown): data is CitationSelectionResponse {
  if (!data || typeof data !== 'object') return false;
  const obj = data as Record<string, unknown>;
  if (!Array.isArray(obj.sections)) return false;

  for (const section of obj.sections) {
    if (!section || typeof section !== 'object') return false;
    const s = section as Record<string, unknown>;
    if (typeof s.name !== 'string') return false;
    if (!Array.isArray(s.citations)) return false;
    if (!s.citations.every((c) => typeof c === 'string')) return false;
  }

  return true;
}

async function retryWithBackoff<T>(
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
      const delay = initialDelayMs * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}

export async function generateEvidenceCitationsWithLLM(params: {
  openaiClient: OpenAI;
  deployment: string;
  templateSections: TemplateSection[];
  transcriptSegments: TranscriptSegment[];
  sections: CitationSectionInput[];
  maxEvidencePerSection?: number;
}): Promise<CitationSectionResult[]> {
  const maxEvidencePerSection = params.maxEvidencePerSection ?? 3;
  const maxCandidatesPerSection =
    parsePositiveInt(process.env.CITATIONS_MAX_CANDIDATES_PER_SECTION) ??
    Math.max(18, maxEvidencePerSection * 6);
  const maxChunksToScan = parsePositiveInt(process.env.CITATIONS_MAX_CHUNKS) ?? 48;

  /**
   * Excerpt sizing thresholds - tuned empirically for citation quality.
   *
   * Rationale for each threshold:
   * - minQuoteWords/Chars (40 words / 400 chars): Ensures excerpts have enough
   *   context to be meaningful. Shorter quotes often lack the surrounding
   *   discourse that makes evidence compelling.
   *
   * - maxQuoteWords/Chars (180 words / 1400 chars): Caps excerpt length to
   *   prevent overly long quotes that bury the key point. ~1400 chars is
   *   roughly 2 paragraphs, enough for a complete thought without overwhelming.
   *
   * - maxWindowSeconds (240s / 4min): Limits how far in time we expand when
   *   building an excerpt. Prevents spanning unrelated topics in long meetings.
   *
   * - maxWindowSegments (40): Hard cap on segments per excerpt. At ~1 segment/sec
   *   average speech rate, this aligns with maxWindowSeconds while handling
   *   variable segment densities.
   *
   * These can be overridden via environment variables for experimentation:
   *   CITATIONS_MIN_QUOTE_WORDS, CITATIONS_MAX_QUOTE_WORDS, etc.
   */
  const resolvedExcerptOptions: Required<ExcerptOptions> = {
    minQuoteWords: 40,
    minQuoteChars: 400,
    maxQuoteWords: 180,
    maxQuoteChars: 1400,
    maxWindowSeconds: 240,
    maxWindowSegments: 40,
  };

  const templateSectionByName = new Map<string, TemplateSection>(
    params.templateSections.map((s) => [s.name, s])
  );

  const sectionsForPrompt: SectionForPrompt[] = params.sections.map((section) => {
    const templateSection = templateSectionByName.get(section.name);
    return {
      name: section.name,
      content: section.content,
      task: templateSection?.prompt ?? '',
    };
  });

  const extractableSections = new Set(
    params.templateSections
      .filter((s) => s.extractEvidence !== false)
      .map((s) => s.name)
  );

  const sectionsToProcess = sectionsForPrompt.filter((s) => extractableSections.has(s.name));

  if (params.transcriptSegments.length === 0 || sectionsToProcess.length === 0) {
    return params.sections.map((s) => ({ name: s.name, evidence: [] }));
  }

  // Use array order as the canonical segment id for this request to guarantee uniqueness.
  const allSegments: SegmentForPrompt[] = params.transcriptSegments.map((s, idx) => ({
    id: idx,
    start: s.start,
    end: s.end,
    text: s.text,
    speaker: s.speaker,
  }));

  const idToIndex = new Map<number, number>(allSegments.map((s, idx) => [s.id, idx]));

  const MAX_SEGMENTS_PER_CHUNK = 220;
  const CHUNK_OVERLAP = 14;
  const maxCitationsPerSectionPerChunk = Math.min(2, maxEvidencePerSection);

  const transcriptChunks = chunkSegments(allSegments, MAX_SEGMENTS_PER_CHUNK, CHUNK_OVERLAP);
  const chunkIndicesToScan = selectEvenlySpacedIndices(
    transcriptChunks.length,
    Math.min(maxChunksToScan, transcriptChunks.length)
  );

  const candidatesBySection = new Map<string, CitationCandidate[]>();
  const usedRangesBySection = new Map<string, Array<{ start: number; end: number }>>();

  for (const section of sectionsToProcess) {
    candidatesBySection.set(section.name, []);
    usedRangesBySection.set(section.name, []);
  }

  const overlapsExisting = (ranges: Array<{ start: number; end: number }>, start: number, end: number) =>
    ranges.some((r) => start <= r.end && end >= r.start);

  // 1) Chunk pass: propose candidate citations grounded to segment ids.
  for (const chunkIndex of chunkIndicesToScan) {
    const chunk = transcriptChunks[chunkIndex];
    if (!chunk) continue;
    const chunkIdSet = new Set(chunk.map((s) => s.id));

    const promptInput = {
      maxCitationsPerSection: maxCitationsPerSectionPerChunk,
      sections: sectionsToProcess.map((s) => ({
        name: s.name,
        content: truncateForPrompt(s.content, 1200),
        task: truncateForPrompt(s.task ?? '', 900),
      })),
      segments: chunk.map((s) => ({
        id: s.id,
        start: s.start,
        end: s.end,
        speaker: s.speaker,
        text: truncateForPrompt(s.text, 600),
      })),
    };

    const prompt = buildChunkExtractionPrompt(promptInput);

    const chunkResponse = await retryWithBackoff(
      async () => {
        const res = await params.openaiClient.chat.completions.create({
          model: params.deployment,
          messages: [
            {
              role: 'system',
              content:
                'You extract grounded supporting evidence quotes from transcript segments. ' +
                'You only reference provided segment ids. You never invent quotes or timestamps. ' +
                'You always return valid JSON.',
            },
            { role: 'user', content: prompt },
          ],
          temperature: 0.1,
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

    const chunkContent = chunkResponse.choices[0].message.content;
    if (!chunkContent) continue;

    let parsedChunk: unknown;
    try {
      parsedChunk = JSON.parse(chunkContent);
    } catch {
      continue;
    }

    if (!isValidChunkCitationsResponse(parsedChunk)) {
      continue;
    }

    for (const section of parsedChunk.sections) {
      if (!candidatesBySection.has(section.name)) continue;

      const existingRanges = usedRangesBySection.get(section.name) ?? [];
      const candidates = candidatesBySection.get(section.name) ?? [];

      for (const range of section.citations) {
        if (candidates.length >= maxCandidatesPerSection) break;
        if (!chunkIdSet.has(range.startId) || !chunkIdSet.has(range.endId)) continue;

        const evidence = buildExcerptFromRange(allSegments, idToIndex, range, resolvedExcerptOptions);
        if (!evidence) continue;

        if (overlapsExisting(existingRanges, evidence.start, evidence.end)) continue;

        const nextId = `c${candidates.length + 1}`;
        candidates.push({ ...evidence, id: nextId });
        existingRanges.push({ start: evidence.start, end: evidence.end });
      }

      candidatesBySection.set(section.name, candidates);
      usedRangesBySection.set(section.name, existingRanges);
    }

    const allSectionsHaveEnoughCandidates = sectionsToProcess.every((s) => {
      const candidates = candidatesBySection.get(s.name) ?? [];
      return candidates.length >= maxCandidatesPerSection;
    });
    if (allSectionsHaveEnoughCandidates) break;
  }

  const hasAnyCandidates = Array.from(candidatesBySection.values()).some((c) => c.length > 0);
  if (!hasAnyCandidates) {
    return params.sections.map((s) => ({ name: s.name, evidence: [] }));
  }

  // 2) Final pass: select the best candidates per section.
  const selectionPromptInput = {
    maxCitationsPerSection: maxEvidencePerSection,
    sections: sectionsToProcess.map((section) => {
      const candidates = candidatesBySection.get(section.name) ?? [];
      return {
        name: section.name,
        content: truncateForPrompt(section.content, 1400),
        task: truncateForPrompt(section.task ?? '', 900),
        candidates: candidates.map((c) => ({
          id: c.id,
          start: c.start,
          end: c.end,
          text: truncateForPrompt(c.text, 900),
        })),
      };
    }),
  };

  const selectionPrompt = buildSelectionPrompt(selectionPromptInput);

  let selectionParsed: CitationSelectionResponse | null = null;
  try {
    const selectionResponse = await retryWithBackoff(
      async () => {
        const res = await params.openaiClient.chat.completions.create({
          model: params.deployment,
          messages: [
            {
              role: 'system',
              content:
                'You select grounded supporting evidence quotes for an analysis. ' +
                'You never invent quotes or timestamps. You always return valid JSON.',
            },
            { role: 'user', content: selectionPrompt },
          ],
          temperature: 0.1,
          max_completion_tokens: 2000,
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

    const content = selectionResponse.choices[0].message.content;
    if (content) {
      const parsed = JSON.parse(content) as unknown;
      if (isValidSelectionResponse(parsed)) {
        selectionParsed = parsed;
      }
    }
  } catch {
    selectionParsed = null;
  }

  const selectionsBySection = new Map<string, string[]>();
  if (selectionParsed) {
    for (const section of selectionParsed.sections) {
      selectionsBySection.set(section.name, section.citations);
    }
  }

  const evidenceBySection = new Map<string, Evidence[]>();
  for (const section of sectionsToProcess) {
    const candidates = candidatesBySection.get(section.name) ?? [];
    const requested = selectionsBySection.get(section.name) ?? [];
    const candidateById = new Map(candidates.map((c) => [c.id, c]));

    const chosen = (selectionParsed ? requested : candidates.map((c) => c.id))
      .map((id) => candidateById.get(id))
      .filter((c): c is CitationCandidate => !!c)
      .slice(0, maxEvidencePerSection)
      .map((c) => ({
        text: c.text,
        start: c.start,
        end: c.end,
        relevance: c.relevance,
      }));

    evidenceBySection.set(section.name, chosen);
  }

  // Preserve original section ordering; attach evidence where available and respect extractEvidence=false.
  return params.sections.map((section) => ({
    name: section.name,
    evidence: extractableSections.has(section.name)
      ? evidenceBySection.get(section.name) ?? []
      : [],
  }));
}

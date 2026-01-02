/**
 * Transcription Utility Functions
 *
 * This module provides helper functions for audio transcription processing:
 * - Converting OpenAI Whisper API responses to our TranscriptSegment format
 * - Calculating audio duration from segments
 * - Formatting timestamps (seconds to HH:MM:SS format)
 * - Generating unique transcript IDs
 * - Extracting and validating metadata from API responses
 */

import { nanoid } from 'nanoid';
import type { TranscriptSegment, TranscriptMetadata } from '@/types';

/**
 * OpenAI Whisper API response types
 * Based on the verbose_json format response
 */
export interface WhisperSegment {
  id?: number | string;
  seek?: number;
  start: number;
  end: number;
  text: string;
  tokens?: number[];
  temperature?: number;
  avg_logprob?: number;
  compression_ratio?: number;
  no_speech_prob?: number;
  speaker?: string;
}

export interface WhisperVerboseResponse {
  task?: string;
  language?: string;
  duration?: number;
  text: string;
  segments?: WhisperSegment[];
}

export interface SegmentSanitizationOptions {
  /**
   * Allow overlapping segments (useful for diarized speaker turns).
   * When false, overlaps will be resolved by trimming the start time.
   */
  allowOverlaps?: boolean;

  /**
   * Maximum tolerated overlap (in seconds) before a segment is considered invalid.
   * Used when `allowOverlaps` is false to smooth minor rounding issues.
   */
  overlapEpsilon?: number;

  /**
   * Minimum duration (in seconds) a segment must cover. Shorter segments will
   * be stretched to meet this threshold.
   */
  minDuration?: number;

  /**
   * When true (default), segments with empty text are dropped.
   */
  removeEmptyText?: boolean;
}

export interface SegmentSanitizationResult {
  segments: TranscriptSegment[];
  warnings: string[];
}

/**
 * Generate a unique transcript ID using nanoid
 *
 * Uses nanoid for generating URL-safe, unique identifiers.
 * Default length is 21 characters, providing good uniqueness guarantees.
 *
 * @param length - Optional custom length for the ID (default: 21)
 * @returns Unique transcript identifier
 *
 * @example
 * ```typescript
 * const id = generateTranscriptId();
 * // => "V1StGXR8_Z5jdHi6B-myT"
 * ```
 */
export function generateTranscriptId(length = 21): string {
  return nanoid(length);
}

/**
 * Convert seconds to HH:MM:SS timestamp format
 *
 * Handles fractional seconds by rounding to nearest integer.
 * Formats hours, minutes, and seconds with leading zeros.
 *
 * @param seconds - Time in seconds (can be fractional)
 * @returns Formatted timestamp string (HH:MM:SS)
 *
 * @example
 * ```typescript
 * formatTimestamp(0);      // => "00:00:00"
 * formatTimestamp(65);     // => "00:01:05"
 * formatTimestamp(3661.5); // => "01:01:02"
 * formatTimestamp(3600 * 2 + 60 * 30 + 45); // => "02:30:45"
 * ```
 */
export function formatTimestamp(seconds: number): string {
  const totalSeconds = Math.round(seconds);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;

  return [hours, minutes, secs]
    .map((val) => val.toString().padStart(2, '0'))
    .join(':');
}

/**
 * Convert seconds to MM:SS timestamp format
 *
 * For shorter durations where hours are not needed.
 * Useful for displaying segment timestamps in the UI.
 *
 * @param seconds - Time in seconds (can be fractional)
 * @returns Formatted timestamp string (MM:SS)
 *
 * @example
 * ```typescript
 * formatShortTimestamp(0);    // => "00:00"
 * formatShortTimestamp(65);   // => "01:05"
 * formatShortTimestamp(125);  // => "02:05"
 * ```
 */
export function formatShortTimestamp(seconds: number): string {
  const totalSeconds = Math.round(seconds);
  const minutes = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;

  return [minutes, secs]
    .map((val) => val.toString().padStart(2, '0'))
    .join(':');
}

/**
 * Parse timestamp string (HH:MM:SS or MM:SS) to seconds
 *
 * Supports both long (HH:MM:SS) and short (MM:SS) formats.
 * Returns null for invalid formats.
 *
 * @param timestamp - Timestamp string to parse
 * @returns Total seconds, or null if invalid format
 *
 * @example
 * ```typescript
 * parseTimestamp("00:00:00"); // => 0
 * parseTimestamp("01:30");    // => 90
 * parseTimestamp("02:30:45"); // => 9045
 * parseTimestamp("invalid");  // => null
 * ```
 */
export function parseTimestamp(timestamp: string): number | null {
  const parts = timestamp.split(':').map(Number);

  // Validate all parts are numbers
  if (parts.some(isNaN)) {
    return null;
  }

  if (parts.length === 3) {
    // HH:MM:SS format
    const [hours, minutes, seconds] = parts;
    return hours * 3600 + minutes * 60 + seconds;
  } else if (parts.length === 2) {
    // MM:SS format
    const [minutes, seconds] = parts;
    return minutes * 60 + seconds;
  }

  return null;
}

/**
 * Convert OpenAI Whisper segment to our TranscriptSegment format
 *
 * Maps OpenAI's segment structure to our application's format.
 * Trims whitespace from text and ensures proper indexing.
 *
 * @param whisperSegment - Segment from OpenAI Whisper API
 * @param index - Optional override for segment index (default: uses segment.id)
 * @returns Formatted TranscriptSegment
 *
 * @example
 * ```typescript
 * const whisperSeg = {
 *   id: 0,
 *   start: 0.5,
 *   end: 5.2,
 *   text: " Hello, world! ",
 *   // ... other fields
 * };
 *
 * const segment = convertWhisperSegment(whisperSeg);
 * // => { index: 0, start: 0.5, end: 5.2, text: "Hello, world!" }
 * ```
 */
export function convertWhisperSegment(
  whisperSegment: WhisperSegment,
  index?: number
): TranscriptSegment {
  const resolvedIndex =
    index !== undefined
      ? index
      : typeof whisperSegment.id === 'number'
        ? whisperSegment.id
        : 0;

  return {
    index: resolvedIndex,
    start: whisperSegment.start,
    end: whisperSegment.end,
    text: whisperSegment.text.trim(),
    ...(typeof whisperSegment.speaker === 'string' &&
    whisperSegment.speaker.trim().length > 0
      ? { speaker: whisperSegment.speaker.trim() }
      : {}),
  };
}

/**
 * Convert OpenAI Whisper verbose response to our TranscriptSegment array
 *
 * Handles cases where segments might be missing (creates single segment from full text).
 * Ensures all segments are properly indexed sequentially.
 *
 * @param response - Verbose response from OpenAI Whisper API
 * @returns Array of formatted TranscriptSegments
 *
 * @example
 * ```typescript
 * const response = {
 *   task: "transcribe",
 *   language: "en",
 *   duration: 10.5,
 *   text: "Full transcript text",
 *   segments: [...]
 * };
 *
 * const segments = convertWhisperResponse(response);
 * ```
 */
export function convertWhisperResponse(
  response: WhisperVerboseResponse
): TranscriptSegment[] {
  // If no segments are provided, create a single segment from the full text
  if (!response.segments || response.segments.length === 0) {
    return [
      {
        index: 0,
        start: 0,
        end: response.duration || 0,
        text: response.text.trim(),
      },
    ];
  }

  // Convert each segment, ensuring sequential indexing
  return response.segments.map((segment, index) =>
    convertWhisperSegment(segment, index)
  );
}

/**
 * Sanitize transcript segments for downstream consumption.
 *
 * - Sorts segments chronologically.
 * - Reindexes sequentially.
 * - Drops segments with invalid timing or empty text (optional).
 * - Resolves negative timestamps and minor overlaps when requested.
 */
export function sanitizeSegments(
  segments: TranscriptSegment[],
  options: SegmentSanitizationOptions = {}
): SegmentSanitizationResult {
  const {
    allowOverlaps = false,
    overlapEpsilon = 0.05,
    minDuration = 0,
    removeEmptyText = true,
  } = options;

  const sanitized: TranscriptSegment[] = [];
  const warnings: string[] = [];

  const sorted = [...segments].sort((a, b) => {
    if (a.start === b.start) {
      return a.index - b.index;
    }
    return a.start - b.start;
  });

  for (const segment of sorted) {
    const speaker =
      typeof segment.speaker === 'string' ? segment.speaker.trim() : undefined;
    let { start, end } = segment;
    const text = segment.text?.trim() ?? '';

    if (!Number.isFinite(start) || !Number.isFinite(end)) {
      warnings.push(
        `Dropped segment with non-finite timestamps (start=${start}, end=${end}).`
      );
      continue;
    }

    if (!removeEmptyText && text.length === 0) {
      warnings.push(
        `Kept segment ${segment.index} with empty text (empty text allowed).`
      );
    } else if (text.length === 0) {
      warnings.push(`Dropped segment ${segment.index} with empty text.`);
      continue;
    }

    if (start < 0) {
      warnings.push(
        `Clamped negative start time for segment ${segment.index} (start=${start}).`
      );
      start = 0;
    }

    if (end < start + Math.max(minDuration, 0)) {
      const adjustedEnd = start + Math.max(minDuration, 0.001);
      warnings.push(
        `Adjusted end time for segment ${segment.index} (start=${start}, end=${end}) -> ${adjustedEnd}.`
      );
      end = adjustedEnd;
    }

    if (!allowOverlaps && sanitized.length > 0) {
      const previous = sanitized[sanitized.length - 1];
      if (start < previous.end - overlapEpsilon) {
        const adjustedStart = previous.end;
        if (adjustedStart >= end) {
          warnings.push(
            `Dropped segment ${segment.index} due to unresolved overlap with segment ${previous.index}.`
          );
          continue;
        }

        warnings.push(
          `Adjusted start time for segment ${segment.index} to avoid overlap (start=${start} -> ${adjustedStart}).`
        );
        start = adjustedStart;
      }
    }

    sanitized.push({
      index: sanitized.length,
      start,
      end,
      text,
      ...(speaker ? { speaker } : {}),
    });
  }

  return { segments: sanitized, warnings };
}

/**
 * Calculate total duration from transcript segments
 *
 * Returns the end time of the last segment, or 0 if no segments exist.
 * Assumes segments are ordered chronologically.
 *
 * @param segments - Array of transcript segments
 * @returns Total duration in seconds
 *
 * @example
 * ```typescript
 * const segments = [
 *   { index: 0, start: 0, end: 5.2, text: "..." },
 *   { index: 1, start: 5.2, end: 10.8, text: "..." },
 * ];
 *
 * const duration = calculateDuration(segments);
 * // => 10.8
 * ```
 */
export function calculateDuration(segments: TranscriptSegment[]): number {
  if (segments.length === 0) {
    return 0;
  }

  // Return the end time of the last segment
  const lastSegment = segments[segments.length - 1];
  return lastSegment.end;
}

/**
 * Calculate total duration from Whisper response
 *
 * Uses the duration field if available, otherwise calculates from segments.
 *
 * @param response - Verbose response from OpenAI Whisper API
 * @returns Total duration in seconds
 */
export function calculateDurationFromResponse(
  response: WhisperVerboseResponse
): number {
  // Prefer the duration field from the response if available
  if (typeof response.duration === 'number' && response.duration > 0) {
    return response.duration;
  }

  // Fall back to calculating from segments
  const segments = convertWhisperResponse(response);
  return calculateDuration(segments);
}

/**
 * Extract metadata from Whisper API response
 *
 * Builds TranscriptMetadata object from the API response and file information.
 * Validates and normalizes language codes.
 *
 * @param response - Verbose response from OpenAI Whisper API
 * @param fileSize - Original file size in bytes
 * @param model - Model name used for transcription
 * @returns Formatted TranscriptMetadata
 *
 * @example
 * ```typescript
 * const metadata = extractMetadata(response, 1024000, "whisper-1");
 * // => {
 * //   model: "whisper-1",
 * //   language: "en",
 * //   fileSize: 1024000,
 * //   duration: 10.5
 * // }
 * ```
 */
export function extractMetadata(
  response: WhisperVerboseResponse,
  fileSize: number,
  model: string
): TranscriptMetadata {
  return {
    model,
    language: response.language ? response.language.toLowerCase() : undefined,
    fileSize,
    duration: calculateDurationFromResponse(response),
  };
}

/**
 * Validate and normalize language code
 *
 * Ensures language code is lowercase and 2 characters (ISO 639-1).
 * Returns undefined for invalid codes.
 *
 * @param languageCode - Language code to validate
 * @returns Normalized language code or undefined
 *
 * @example
 * ```typescript
 * normalizeLanguageCode("EN");   // => "en"
 * normalizeLanguageCode("en");   // => "en"
 * normalizeLanguageCode("eng");  // => undefined (not ISO 639-1)
 * normalizeLanguageCode("");     // => undefined
 * ```
 */
export function normalizeLanguageCode(
  languageCode?: string
): string | undefined {
  if (!languageCode || languageCode.length !== 2) {
    return undefined;
  }

  const normalized = languageCode.toLowerCase();

  // Basic validation: should be two lowercase letters
  if (!/^[a-z]{2}$/.test(normalized)) {
    return undefined;
  }

  return normalized;
}

/**
 * Format file size to human-readable string
 *
 * Converts bytes to KB, MB, or GB as appropriate.
 * Uses 1024 bytes = 1 KB (binary units).
 *
 * @param bytes - File size in bytes
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted file size string
 *
 * @example
 * ```typescript
 * formatFileSize(1024);           // => "1.00 KB"
 * formatFileSize(1536, 1);        // => "1.5 KB"
 * formatFileSize(1048576);        // => "1.00 MB"
 * formatFileSize(25 * 1024 * 1024); // => "25.00 MB"
 * ```
 */
export function formatFileSize(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

/**
 * Merge overlapping or adjacent transcript segments
 *
 * Useful for consolidating segments that are too granular.
 * Segments are merged if the gap between them is less than the threshold.
 *
 * @param segments - Array of transcript segments
 * @param gapThreshold - Maximum gap in seconds to merge (default: 0.5)
 * @returns Array of merged segments
 *
 * @example
 * ```typescript
 * const segments = [
 *   { index: 0, start: 0, end: 2, text: "Hello" },
 *   { index: 1, start: 2.1, end: 4, text: "world" },
 * ];
 *
 * const merged = mergeSegments(segments, 0.5);
 * // => [{ index: 0, start: 0, end: 4, text: "Hello world" }]
 * ```
 */
export function mergeSegments(
  segments: TranscriptSegment[],
  gapThreshold = 0.5
): TranscriptSegment[] {
  if (segments.length === 0) return [];

  const merged: TranscriptSegment[] = [];
  let current = { ...segments[0] };

  for (let i = 1; i < segments.length; i++) {
    const next = segments[i];
    const gap = next.start - current.end;

    if (gap <= gapThreshold) {
      // Merge segments
      current = {
        ...current,
        end: next.end,
        text: `${current.text} ${next.text}`.trim(),
      };
    } else {
      // Save current and start new segment
      merged.push(current);
      current = { ...next, index: merged.length };
    }
  }

  // Add the last segment
  merged.push({ ...current, index: merged.length });

  return merged;
}

/**
 * Split long segments into smaller chunks based on character count
 *
 * Useful for improving readability in the UI.
 * Attempts to split on sentence boundaries (periods, question marks, exclamation marks).
 *
 * @param segments - Array of transcript segments
 * @param maxLength - Maximum characters per segment (default: 500)
 * @returns Array of split segments
 *
 * @example
 * ```typescript
 * const segments = [{
 *   index: 0,
 *   start: 0,
 *   end: 60,
 *   text: "Very long text... (1000+ characters)"
 * }];
 *
 * const split = splitLongSegments(segments, 500);
 * // => Multiple segments with text <= 500 characters
 * ```
 */
export function splitLongSegments(
  segments: TranscriptSegment[],
  maxLength = 500
): TranscriptSegment[] {
  const result: TranscriptSegment[] = [];
  let currentIndex = 0;

  for (const segment of segments) {
    if (segment.text.length <= maxLength) {
      // Segment is fine as-is
      result.push({ ...segment, index: currentIndex++ });
      continue;
    }

    // Split long segment
    const duration = segment.end - segment.start;
    const sentences = segment.text.split(/([.!?]+\s+)/);
    let currentChunk = '';
    let chunkStart = segment.start;

    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i];

      if (currentChunk.length + sentence.length <= maxLength) {
        currentChunk += sentence;
      } else {
        if (currentChunk.trim()) {
          // Calculate proportional end time
          const chunkRatio = currentChunk.length / segment.text.length;
          const chunkEnd = chunkStart + duration * chunkRatio;

          result.push({
            index: currentIndex++,
            start: chunkStart,
            end: chunkEnd,
            text: currentChunk.trim(),
          });

          chunkStart = chunkEnd;
        }
        currentChunk = sentence;
      }
    }

    // Add remaining chunk
    if (currentChunk.trim()) {
      result.push({
        index: currentIndex++,
        start: chunkStart,
        end: segment.end,
        text: currentChunk.trim(),
      });
    }
  }

  return result;
}

/**
 * Search for text within transcript segments
 *
 * Case-insensitive search that returns matching segments.
 * Useful for implementing transcript search functionality.
 *
 * @param segments - Array of transcript segments
 * @param query - Search query string
 * @returns Array of segments containing the query
 *
 * @example
 * ```typescript
 * const segments = [
 *   { index: 0, start: 0, end: 5, text: "Hello world" },
 *   { index: 1, start: 5, end: 10, text: "Goodbye world" },
 * ];
 *
 * const results = searchSegments(segments, "hello");
 * // => [{ index: 0, start: 0, end: 5, text: "Hello world" }]
 * ```
 */
export function searchSegments(
  segments: TranscriptSegment[],
  query: string
): TranscriptSegment[] {
  if (!query.trim()) return [];

  const lowerQuery = query.toLowerCase();
  return segments.filter((segment) =>
    segment.text.toLowerCase().includes(lowerQuery)
  );
}

/**
 * Get segment at specific timestamp
 *
 * Returns the segment that contains the given timestamp.
 * Returns null if no segment contains the timestamp.
 *
 * @param segments - Array of transcript segments
 * @param timestamp - Timestamp in seconds
 * @returns Segment containing the timestamp, or null
 *
 * @example
 * ```typescript
 * const segments = [
 *   { index: 0, start: 0, end: 5, text: "First" },
 *   { index: 1, start: 5, end: 10, text: "Second" },
 * ];
 *
 * const segment = getSegmentAtTime(segments, 7);
 * // => { index: 1, start: 5, end: 10, text: "Second" }
 * ```
 */
export function getSegmentAtTime(
  segments: TranscriptSegment[],
  timestamp: number
): TranscriptSegment | null {
  return (
    segments.find(
      (segment) => timestamp >= segment.start && timestamp < segment.end
    ) || null
  );
}

/**
 * Validate transcript segments array
 *
 * Checks for common issues:
 * - Empty array
 * - Overlapping segments
 * - Invalid time ranges (end before start)
 * - Non-sequential indexing
 *
 * @param segments - Array of transcript segments to validate
 * @returns Validation result with errors array
 *
 * @example
 * ```typescript
 * const result = validateSegments(segments);
 * if (!result.valid) {
 *   console.error('Validation errors:', result.errors);
 * }
 * ```
 */
export interface SegmentValidationOptions {
  allowOverlaps?: boolean;
  allowEmptyText?: boolean;
  overlapEpsilon?: number;
  minDuration?: number;
}

export function validateSegments(
  segments: TranscriptSegment[],
  options: SegmentValidationOptions = {}
): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  const {
    allowOverlaps = false,
    allowEmptyText = false,
    overlapEpsilon = 0.05,
    minDuration = 0,
  } = options;

  if (segments.length === 0) {
    errors.push('Segments array is empty');
    return { valid: false, errors };
  }

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];

    // Check index sequencing
    if (segment.index !== i) {
      errors.push(
        `Segment ${i} has incorrect index: expected ${i}, got ${segment.index}`
      );
    }

    // Check time range validity
    if (segment.end < segment.start + minDuration) {
      errors.push(
        `Segment ${i} has invalid time range: start=${segment.start}, end=${segment.end}`
      );
    }

    // Check for negative times
    if (segment.start < 0 || segment.end < 0) {
      errors.push(`Segment ${i} has negative timestamp`);
    }

    // Check for overlaps with next segment
    if (!allowOverlaps && i < segments.length - 1) {
      const nextSegment = segments[i + 1];
      if (segment.end > nextSegment.start + overlapEpsilon) {
        errors.push(
          `Segment ${i} overlaps with segment ${i + 1}: ` +
            `seg${i}.end=${segment.end} > seg${i + 1}.start=${nextSegment.start}`
        );
      }
    }

    // Check text is not empty
    if (!allowEmptyText && !segment.text.trim()) {
      errors.push(`Segment ${i} has empty text`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

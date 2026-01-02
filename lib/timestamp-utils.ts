/**
 * Timestamp utilities for parsing, finding segments, and rendering clickable timestamps
 */

import type { TranscriptSegment } from '@/types';

/**
 * Regex patterns for matching timestamps in text
 * Matches: [00:00], [0:00], [00:00:00], [1:23:45], [123] (seconds), (00:00), 00:00 standalone
 */
export const TIMESTAMP_PATTERNS = {
  // Bracketed formatted: [MM:SS] or [HH:MM:SS]
  bracketedFormatted: /\[(\d{1,2}:\d{2}(?::\d{2})?)\]/g,
  // Bracketed seconds: [123] - just a number in brackets (common in analysis output)
  bracketedSeconds: /\[(\d+)\]/g,
  // Parenthesized: (MM:SS) or (HH:MM:SS)
  parenthesized: /\((\d{1,2}:\d{2}(?::\d{2})?)\)/g,
  // Standalone with context: "at 12:34" or "timestamp 1:23:45"
  contextual: /(?:at|timestamp|@)\s*(\d{1,2}:\d{2}(?::\d{2})?)/gi,
};

/**
 * Parse a timestamp string to seconds
 * Handles MM:SS and HH:MM:SS formats
 */
export function parseTimestampToSeconds(timestamp: string): number {
  const parts = timestamp.split(':').map(Number);

  if (parts.length === 2) {
    // MM:SS format
    const [minutes, seconds] = parts;
    return minutes * 60 + seconds;
  } else if (parts.length === 3) {
    // HH:MM:SS format
    const [hours, minutes, seconds] = parts;
    return hours * 3600 + minutes * 60 + seconds;
  }

  return 0;
}

/**
 * Format seconds to timestamp string (MM:SS or HH:MM:SS)
 */
export function formatSecondsToTimestamp(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Represents a timestamp match in text
 */
export interface TimestampMatch {
  /** Full match including brackets */
  fullMatch: string;
  /** Just the timestamp value (e.g., "12:34") */
  timestamp: string;
  /** Timestamp converted to seconds */
  seconds: number;
  /** Start index in original text */
  startIndex: number;
  /** End index in original text */
  endIndex: number;
}

/**
 * Extract all timestamps from a text string
 * Returns array of matches with position information
 *
 * Supports two formats:
 * - Formatted: [12:34] or [1:23:45] - MM:SS or HH:MM:SS
 * - Raw seconds: [63] or [217] - just the number of seconds
 */
export function extractTimestamps(text: string): TimestampMatch[] {
  const matches: TimestampMatch[] = [];
  const seenIndices = new Set<number>();

  // Process formatted timestamps [MM:SS] or [HH:MM:SS]
  const formattedRegex = /\[(\d{1,2}:\d{2}(?::\d{2})?)\]/g;
  let match;

  while ((match = formattedRegex.exec(text)) !== null) {
    seenIndices.add(match.index);
    matches.push({
      fullMatch: match[0],
      timestamp: match[1],
      seconds: parseTimestampToSeconds(match[1]),
      startIndex: match.index,
      endIndex: match.index + match[0].length,
    });
  }

  // Process raw seconds [123] - numbers that could be timestamps
  // Only match if the number is reasonable (0-36000 = up to 10 hours)
  const secondsRegex = /\[(\d+)\]/g;

  while ((match = secondsRegex.exec(text)) !== null) {
    // Skip if we already matched this as a formatted timestamp
    if (seenIndices.has(match.index)) continue;

    const seconds = parseInt(match[1], 10);

    // Only treat as timestamp if it's a reasonable duration (up to 10 hours)
    // and more than 0 (to avoid matching things like [0] or [1] which might be references)
    if (seconds > 0 && seconds <= 36000) {
      matches.push({
        fullMatch: match[0],
        timestamp: formatSecondsToTimestamp(seconds), // Convert to display format
        seconds: seconds,
        startIndex: match.index,
        endIndex: match.index + match[0].length,
      });
    }
  }

  // Sort by position in text
  return matches.sort((a, b) => a.startIndex - b.startIndex);
}

/**
 * Find the segment index that contains the given timestamp
 * Uses binary search for efficiency with large segment arrays
 *
 * @param segments - Array of transcript segments with start/end times
 * @param seconds - Timestamp in seconds to find
 * @returns Segment index, or -1 if not found
 */
export function findSegmentByTimestamp(
  segments: TranscriptSegment[],
  seconds: number
): number {
  if (!segments || segments.length === 0) {
    return -1;
  }

  // Clamp to valid range
  const firstSegment = segments[0];
  const lastSegment = segments[segments.length - 1];

  if (seconds < firstSegment.start) {
    return 0; // Before first segment, return first
  }

  if (seconds >= lastSegment.end) {
    return segments.length - 1; // After last segment, return last
  }

  // Binary search for the segment containing this timestamp
  let low = 0;
  let high = segments.length - 1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const segment = segments[mid];

    if (seconds >= segment.start && seconds < segment.end) {
      // Found the segment
      return mid;
    } else if (seconds < segment.start) {
      high = mid - 1;
    } else {
      low = mid + 1;
    }
  }

  // If not found in any segment, find the nearest one
  // This handles gaps between segments
  for (let i = 0; i < segments.length - 1; i++) {
    if (seconds >= segments[i].end && seconds < segments[i + 1].start) {
      // In a gap between segments - return the next segment
      return i + 1;
    }
  }

  return -1;
}

/**
 * Split text into parts with timestamps as separate items
 * Returns array of { type: 'text' | 'timestamp', content, seconds? }
 */
export interface TextPart {
  type: 'text' | 'timestamp';
  content: string;
  seconds?: number;
  timestamp?: string;
}

export function splitTextWithTimestamps(text: string): TextPart[] {
  const parts: TextPart[] = [];
  const matches = extractTimestamps(text);

  if (matches.length === 0) {
    return [{ type: 'text', content: text }];
  }

  let lastIndex = 0;

  for (const match of matches) {
    // Add text before this timestamp
    if (match.startIndex > lastIndex) {
      const textContent = text.slice(lastIndex, match.startIndex);
      if (textContent) {
        parts.push({ type: 'text', content: textContent });
      }
    }

    // Add the timestamp
    parts.push({
      type: 'timestamp',
      content: match.fullMatch,
      timestamp: match.timestamp,
      seconds: match.seconds,
    });

    lastIndex = match.endIndex;
  }

  // Add remaining text after last timestamp
  if (lastIndex < text.length) {
    const textContent = text.slice(lastIndex);
    if (textContent) {
      parts.push({ type: 'text', content: textContent });
    }
  }

  return parts;
}

/**
 * Check if a text string contains any timestamps
 * Matches both formatted [12:34] and raw seconds [123]
 */
export function containsTimestamp(text: string): boolean {
  // Check for formatted timestamps
  if (TIMESTAMP_PATTERNS.bracketedFormatted.test(text)) {
    TIMESTAMP_PATTERNS.bracketedFormatted.lastIndex = 0; // Reset regex
    return true;
  }
  // Check for raw seconds (reasonable range)
  const secondsMatch = text.match(/\[(\d+)\]/);
  if (secondsMatch) {
    const seconds = parseInt(secondsMatch[1], 10);
    return seconds > 0 && seconds <= 36000;
  }
  return false;
}

/**
 * Create a deep link hash for a timestamp
 * Can be used for shareable URLs
 */
export function createTimestampHash(seconds: number): string {
  return `#t=${Math.floor(seconds)}`;
}

/**
 * Parse a timestamp from a URL hash
 * Returns seconds or null if not a valid timestamp hash
 */
export function parseTimestampHash(hash: string): number | null {
  const match = hash.match(/^#t=(\d+)$/);
  if (match) {
    return parseInt(match[1], 10);
  }
  return null;
}

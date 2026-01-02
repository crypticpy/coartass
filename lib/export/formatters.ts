/**
 * Export Format Utilities
 *
 * Provides formatting functions for converting transcripts into various
 * export formats including TXT, JSON, SRT, and VTT.
 */

import { Transcript } from '@/types';

/**
 * Timestamp format types supported by different export formats
 */
export type TimestampFormat = 'srt' | 'vtt' | 'txt';

/**
 * Formats seconds into a timestamp string based on the specified format.
 *
 * @param seconds - Time in seconds (can include decimals for milliseconds)
 * @param format - The desired timestamp format
 * @returns Formatted timestamp string
 *
 * @example
 * formatTimestamp(75.5, 'srt')  // "00:01:15,500"
 * formatTimestamp(75.5, 'vtt')  // "00:01:15.500"
 * formatTimestamp(75.5, 'txt')  // "[00:01:15]"
 */
export function formatTimestamp(seconds: number, format: TimestampFormat): string {
  // Ensure we handle negative values gracefully
  const absSeconds = Math.max(0, seconds);

  const hours = Math.floor(absSeconds / 3600);
  const minutes = Math.floor((absSeconds % 3600) / 60);
  const secs = Math.floor(absSeconds % 60);
  const milliseconds = Math.floor((absSeconds % 1) * 1000);

  const h = String(hours).padStart(2, '0');
  const m = String(minutes).padStart(2, '0');
  const s = String(secs).padStart(2, '0');
  const ms = String(milliseconds).padStart(3, '0');

  switch (format) {
    case 'srt':
      // SRT uses comma as decimal separator: HH:MM:SS,mmm
      return `${h}:${m}:${s},${ms}`;

    case 'vtt':
      // VTT uses period as decimal separator: HH:MM:SS.mmm
      return `${h}:${m}:${s}.${ms}`;

    case 'txt':
      // TXT format uses simple bracketed time without milliseconds: [HH:MM:SS]
      return `[${h}:${m}:${s}]`;

    default:
      // Fallback to TXT format
      return `[${h}:${m}:${s}]`;
  }
}

/**
 * Formats a duration in seconds to a human-readable string.
 *
 * @param duration - Duration in seconds
 * @returns Formatted duration string (e.g., "1:23:45" or "45:30")
 */
export function formatDuration(duration: number): string {
  const hours = Math.floor(duration / 3600);
  const minutes = Math.floor((duration % 3600) / 60);
  const seconds = Math.floor(duration % 60);

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Formats a Date object to a human-readable string.
 *
 * @param date - Date to format
 * @returns Formatted date string (YYYY-MM-DD HH:MM:SS)
 */
export function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * Escapes special characters for safe inclusion in various text formats.
 *
 * @param text - Text to sanitize
 * @returns Sanitized text
 */
export function sanitizeText(text: string): string {
  // Replace any problematic control characters while preserving newlines
  return text
    .replace(/\r\n/g, '\n')  // Normalize line endings
    .replace(/\r/g, '\n')    // Normalize carriage returns
    .trim();
}

/**
 * Formats transcript as plain text with timestamps.
 *
 * Format:
 * ```
 * Meeting Transcription
 * Date: 2024-11-17 14:30:00
 * Duration: 45:30
 * Filename: meeting.mp3
 *
 * [00:00:00] First segment text here...
 * [00:00:15] Second segment text here...
 * ```
 *
 * @param transcript - Transcript to format
 * @returns Formatted TXT string
 */
export function formatTXT(transcript: Transcript): string {
  const lines: string[] = [];

  // Header section
  lines.push('Meeting Transcription');
  lines.push('='.repeat(50));
  lines.push('');

  // Metadata
  lines.push(`Date: ${formatDate(transcript.createdAt)}`);

  if (transcript.metadata?.duration) {
    lines.push(`Duration: ${formatDuration(transcript.metadata.duration)}`);
  }

  lines.push(`Filename: ${transcript.filename}`);

  if (transcript.metadata?.language) {
    lines.push(`Language: ${transcript.metadata.language}`);
  }

  lines.push('');
  lines.push('='.repeat(50));
  lines.push('');

  // Transcript content with timestamps
  if (transcript.segments && transcript.segments.length > 0) {
    for (const segment of transcript.segments) {
      const timestamp = formatTimestamp(segment.start, 'txt');
      const text = sanitizeText(segment.text);

      if (segment.speaker) {
        lines.push(`${timestamp} [${segment.speaker}] ${text}`);
      } else {
        lines.push(`${timestamp} ${text}`);
      }
    }
  } else {
    // Fallback if no segments available
    lines.push(sanitizeText(transcript.text));
  }

  return lines.join('\n');
}

/**
 * Formats transcript as JSON with full metadata.
 *
 * @param transcript - Transcript to format
 * @returns Formatted JSON string
 */
export function formatJSON(transcript: Transcript): string {
  // Create a clean serializable version
  const exportData = {
    id: transcript.id,
    filename: transcript.filename,
    text: transcript.text,
    segments: transcript.segments.map(segment => ({
      index: segment.index,
      start: segment.start,
      end: segment.end,
      text: sanitizeText(segment.text),
      ...(segment.speaker && { speaker: segment.speaker }),
    })),
    metadata: {
      model: transcript.metadata.model,
      language: transcript.metadata.language,
      fileSize: transcript.metadata.fileSize,
      duration: transcript.metadata.duration,
    },
    createdAt: transcript.createdAt.toISOString(),
  };

  return JSON.stringify(exportData, null, 2);
}

/**
 * Formats transcript as SRT (SubRip) subtitle format.
 *
 * Format:
 * ```
 * 1
 * 00:00:00,000 --> 00:00:15,000
 * First segment text here...
 *
 * 2
 * 00:00:15,000 --> 00:00:30,000
 * Second segment text here...
 * ```
 *
 * @param transcript - Transcript to format
 * @returns Formatted SRT string
 */
export function formatSRT(transcript: Transcript): string {
  const lines: string[] = [];

  if (!transcript.segments || transcript.segments.length === 0) {
    // If no segments, create a single entry with full text
    lines.push('1');
    lines.push(`00:00:00,000 --> 00:00:00,000`);
    lines.push(sanitizeText(transcript.text));
    lines.push('');
    return lines.join('\n');
  }

  // Format each segment
  for (let i = 0; i < transcript.segments.length; i++) {
    const segment = transcript.segments[i];
    const startTime = formatTimestamp(segment.start, 'srt');
    const endTime = formatTimestamp(segment.end, 'srt');
    const text = sanitizeText(segment.text);

    // Sequence number (1-indexed)
    lines.push(String(i + 1));

    // Timestamp range
    lines.push(`${startTime} --> ${endTime}`);

    // Subtitle text (with optional speaker prefix)
    if (segment.speaker) {
      lines.push(`[${segment.speaker}] ${text}`);
    } else {
      lines.push(text);
    }

    // Empty line separator between entries
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Formats transcript as WebVTT (Web Video Text Tracks) format.
 *
 * Format:
 * ```
 * WEBVTT
 *
 * 00:00:00.000 --> 00:00:15.000
 * First segment text here...
 *
 * 00:00:15.000 --> 00:00:30.000
 * Second segment text here...
 * ```
 *
 * @param transcript - Transcript to format
 * @returns Formatted VTT string
 */
export function formatVTT(transcript: Transcript): string {
  const lines: string[] = [];

  // VTT files must start with this header
  lines.push('WEBVTT');
  lines.push('');

  if (!transcript.segments || transcript.segments.length === 0) {
    // If no segments, create a single cue with full text
    lines.push('00:00:00.000 --> 00:00:00.000');
    lines.push(sanitizeText(transcript.text));
    lines.push('');
    return lines.join('\n');
  }

  // Format each segment as a cue
  for (const segment of transcript.segments) {
    const startTime = formatTimestamp(segment.start, 'vtt');
    const endTime = formatTimestamp(segment.end, 'vtt');
    const text = sanitizeText(segment.text);

    // Timestamp range
    lines.push(`${startTime} --> ${endTime}`);

    // Cue text (with optional speaker as voice tag)
    if (segment.speaker) {
      // VTT supports voice tags for speaker identification
      lines.push(`<v ${segment.speaker}>${text}</v>`);
    } else {
      lines.push(text);
    }

    // Empty line separator between cues
    lines.push('');
  }

  return lines.join('\n');
}

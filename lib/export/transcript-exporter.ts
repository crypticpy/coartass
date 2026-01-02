/**
 * Transcript Export Module
 *
 * Main export functionality for transcripts. Provides functions to export
 * transcripts in various formats (TXT, JSON, SRT, VTT) with proper error handling.
 */

import { Transcript } from '@/types';
import { formatTXT, formatJSON, formatSRT, formatVTT } from './formatters';
import {
  safeDownload,
  type ExportFormat,
  MIME_TYPES,
} from './download-helper';

/**
 * Export result type
 */
export interface ExportResult {
  success: boolean;
  format: ExportFormat;
  filename?: string;
  error?: string;
}

/**
 * Export options
 */
export interface ExportOptions {
  /** Whether to include timestamp in filename (default: true) */
  includeTimestamp?: boolean;
  /** Custom filename (overrides original filename) */
  customFilename?: string;
}

/**
 * Exports a transcript to plain text format.
 *
 * Format includes header with metadata and timestamped segments.
 *
 * @param transcript - Transcript to export
 * @param options - Export options
 * @returns Export result with success status
 *
 * @example
 * const result = exportToTXT(transcript);
 * if (result.success) {
 *   console.log('Exported successfully');
 * }
 */
export function exportToTXT(
  transcript: Transcript,
  options: ExportOptions = {}
): ExportResult {
  try {
    const content = formatTXT(transcript);
    const filename = options.customFilename || transcript.filename;
    const includeTimestamp = options.includeTimestamp ?? true;

    const result = safeDownload(content, 'txt', filename, includeTimestamp);

    return {
      success: result.success,
      format: 'txt',
      error: result.error,
    };
  } catch (error) {
    return {
      success: false,
      format: 'txt',
      error: error instanceof Error ? error.message : 'Failed to export to TXT',
    };
  }
}

/**
 * Exports a transcript to JSON format.
 *
 * Includes complete transcript data with all metadata and segments.
 *
 * @param transcript - Transcript to export
 * @param options - Export options
 * @returns Export result with success status
 *
 * @example
 * const result = exportToJSON(transcript);
 * if (!result.success) {
 *   console.error(result.error);
 * }
 */
export function exportToJSON(
  transcript: Transcript,
  options: ExportOptions = {}
): ExportResult {
  try {
    const content = formatJSON(transcript);
    const filename = options.customFilename || transcript.filename;
    const includeTimestamp = options.includeTimestamp ?? true;

    const result = safeDownload(content, 'json', filename, includeTimestamp);

    return {
      success: result.success,
      format: 'json',
      error: result.error,
    };
  } catch (error) {
    return {
      success: false,
      format: 'json',
      error: error instanceof Error ? error.message : 'Failed to export to JSON',
    };
  }
}

/**
 * Exports a transcript to SRT subtitle format.
 *
 * Creates SubRip format compatible with most video players and editors.
 *
 * @param transcript - Transcript to export
 * @param options - Export options
 * @returns Export result with success status
 *
 * @example
 * const result = exportToSRT(transcript);
 */
export function exportToSRT(
  transcript: Transcript,
  options: ExportOptions = {}
): ExportResult {
  try {
    const content = formatSRT(transcript);
    const filename = options.customFilename || transcript.filename;
    const includeTimestamp = options.includeTimestamp ?? true;

    const result = safeDownload(content, 'srt', filename, includeTimestamp);

    return {
      success: result.success,
      format: 'srt',
      error: result.error,
    };
  } catch (error) {
    return {
      success: false,
      format: 'srt',
      error: error instanceof Error ? error.message : 'Failed to export to SRT',
    };
  }
}

/**
 * Exports a transcript to WebVTT subtitle format.
 *
 * Creates Web Video Text Tracks format for HTML5 video subtitles.
 *
 * @param transcript - Transcript to export
 * @param options - Export options
 * @returns Export result with success status
 *
 * @example
 * const result = exportToVTT(transcript);
 */
export function exportToVTT(
  transcript: Transcript,
  options: ExportOptions = {}
): ExportResult {
  try {
    const content = formatVTT(transcript);
    const filename = options.customFilename || transcript.filename;
    const includeTimestamp = options.includeTimestamp ?? true;

    const result = safeDownload(content, 'vtt', filename, includeTimestamp);

    return {
      success: result.success,
      format: 'vtt',
      error: result.error,
    };
  } catch (error) {
    return {
      success: false,
      format: 'vtt',
      error: error instanceof Error ? error.message : 'Failed to export to VTT',
    };
  }
}

/**
 * Exports a transcript in the specified format.
 *
 * Convenience function that routes to the appropriate export function.
 *
 * @param transcript - Transcript to export
 * @param format - Desired export format
 * @param options - Export options
 * @returns Export result with success status
 *
 * @example
 * const result = exportTranscript(transcript, 'json');
 */
export function exportTranscript(
  transcript: Transcript,
  format: ExportFormat,
  options: ExportOptions = {}
): ExportResult {
  switch (format) {
    case 'txt':
      return exportToTXT(transcript, options);
    case 'json':
      return exportToJSON(transcript, options);
    case 'srt':
      return exportToSRT(transcript, options);
    case 'vtt':
      return exportToVTT(transcript, options);
    default:
      return {
        success: false,
        format,
        error: `Unsupported export format: ${format}`,
      };
  }
}

/**
 * Gets formatted content without triggering download.
 *
 * Useful for previewing export content or programmatic access.
 *
 * @param transcript - Transcript to format
 * @param format - Desired format
 * @returns Formatted content string
 *
 * @example
 * const content = getFormattedContent(transcript, 'srt');
 */
export function getFormattedContent(
  transcript: Transcript,
  format: ExportFormat
): string {
  switch (format) {
    case 'txt':
      return formatTXT(transcript);
    case 'json':
      return formatJSON(transcript);
    case 'srt':
      return formatSRT(transcript);
    case 'vtt':
      return formatVTT(transcript);
    default:
      throw new Error(`Unsupported format: ${format}`);
  }
}

/**
 * Validates a transcript for export.
 *
 * Checks if the transcript has the required data for export.
 *
 * @param transcript - Transcript to validate
 * @returns Validation result with error message if invalid
 */
export function validateTranscriptForExport(transcript: Transcript): {
  valid: boolean;
  error?: string;
} {
  if (!transcript) {
    return { valid: false, error: 'Transcript is required' };
  }

  if (!transcript.id) {
    return { valid: false, error: 'Transcript must have an ID' };
  }

  if (!transcript.filename) {
    return { valid: false, error: 'Transcript must have a filename' };
  }

  if (!transcript.text && (!transcript.segments || transcript.segments.length === 0)) {
    return { valid: false, error: 'Transcript must have text or segments' };
  }

  if (!transcript.createdAt) {
    return { valid: false, error: 'Transcript must have a creation date' };
  }

  if (!transcript.metadata) {
    return { valid: false, error: 'Transcript must have metadata' };
  }

  return { valid: true };
}

/**
 * Batch export multiple transcripts.
 *
 * Exports multiple transcripts in the same format sequentially.
 *
 * @param transcripts - Array of transcripts to export
 * @param format - Export format to use for all
 * @param options - Export options
 * @returns Array of export results
 */
export function batchExport(
  transcripts: Transcript[],
  format: ExportFormat,
  options: ExportOptions = {}
): ExportResult[] {
  return transcripts.map(transcript =>
    exportTranscript(transcript, format, options)
  );
}

/**
 * Available export formats with metadata.
 * Note: JSON export removed in favor of "Share as Package" to avoid confusion.
 * The package format includes proper metadata and can be imported by other users.
 */
export const EXPORT_FORMATS = [
  {
    format: 'txt' as ExportFormat,
    label: 'Plain Text',
    description: 'Text file with timestamps',
    mimeType: MIME_TYPES.txt,
    extension: '.txt',
  },
  {
    format: 'srt' as ExportFormat,
    label: 'SRT Subtitles',
    description: 'SubRip subtitle format',
    mimeType: MIME_TYPES.srt,
    extension: '.srt',
  },
  {
    format: 'vtt' as ExportFormat,
    label: 'WebVTT Subtitles',
    description: 'Web Video Text Tracks format',
    mimeType: MIME_TYPES.vtt,
    extension: '.vtt',
  },
  {
    format: 'pdf' as ExportFormat,
    label: 'PDF Document',
    description: 'Professional business report',
    mimeType: MIME_TYPES.pdf,
    extension: '.pdf',
  },
] as const;

/**
 * Package Export Utilities
 *
 * Functions for exporting Meeting Transcriber packages as shareable JSON files.
 * Packages include transcripts, analyses, and integrity checksums for verification.
 */

import type { Transcript } from '@/types/transcript';
import type { Analysis } from '@/types/analysis';
import type { Template } from '@/types/template';
import {
  computeChecksum,
  createChecksumContent,
  PACKAGE_FORMAT_VERSION,
  type ExportableTranscript,
  type ExportableAnalysis,
  type MeetingTranscriberPackage,
} from './validation';
import {
  createDownloadBlob,
  triggerDownload,
  MIME_TYPES,
} from '@/lib/export/download-helper';

// ============================================================================
// Constants
// ============================================================================

/**
 * Current application version for package metadata.
 * This is pulled from package.json at build time.
 */
const APP_VERSION = '0.10.1';

/**
 * Package type identifiers for filename generation.
 */
export type PackageType = 'transcript' | 'analysis';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Prepares a transcript for export by removing transient fields
 * and ensuring dates are serialized as ISO strings.
 *
 * @param transcript - The transcript to prepare for export
 * @returns Exportable transcript without audioUrl and with serialized dates
 *
 * @example
 * ```typescript
 * const exportable = prepareTranscriptForExport(transcript);
 * // exportable.audioUrl is undefined
 * // exportable.createdAt is an ISO string
 * ```
 */
function prepareTranscriptForExport(transcript: Transcript): ExportableTranscript {
  // Destructure to remove audioUrl (browser ObjectURL - not serializable)
  // Also remove fingerprint as it's for internal duplicate detection
  const {
    audioUrl: _audioUrl,
    fingerprint: _fingerprint,
    partIndex: _partIndex,
    totalParts: _totalParts,
    ...rest
  } = transcript;

  return {
    ...rest,
    // Ensure createdAt is serialized as ISO string
    createdAt:
      transcript.createdAt instanceof Date
        ? transcript.createdAt.toISOString()
        : transcript.createdAt,
  };
}

/**
 * Prepares an analysis for export by ensuring dates are serialized as ISO strings.
 *
 * @param analysis - The analysis to prepare for export
 * @returns Exportable analysis with serialized dates
 */
function prepareAnalysisForExport(analysis: Analysis): ExportableAnalysis {
  // Remove enrichmentMetadata as it's internal processing data
  const { enrichmentMetadata: _enrichmentMetadata, ...rest } = analysis;

  return {
    ...rest,
    // Ensure createdAt is serialized as ISO string
    createdAt:
      analysis.createdAt instanceof Date
        ? analysis.createdAt.toISOString()
        : analysis.createdAt,
  };
}

/**
 * Sanitizes a string for use as a filename.
 * Removes special characters, replaces spaces with underscores.
 *
 * @param input - String to sanitize
 * @returns Sanitized string safe for filenames
 */
function sanitizeFilename(input: string): string {
  return input
    .replace(/\.[^/.]+$/, '') // Remove file extension
    .replace(/[^a-zA-Z0-9-_\s]/g, '') // Remove special chars (keep spaces temporarily)
    .replace(/\s+/g, '_') // Replace spaces with underscores
    .replace(/_+/g, '_') // Collapse multiple underscores
    .replace(/^_|_$/g, '') // Remove leading/trailing underscores
    .substring(0, 100); // Limit length
}

/**
 * Formats a date as YYYY-MM-DD for filename inclusion.
 *
 * @param date - Date to format
 * @returns Formatted date string
 */
function formatDateForFilename(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// ============================================================================
// Package Creation Functions
// ============================================================================

/**
 * Creates a transcript-only export package.
 *
 * @param transcript - The transcript to export
 * @returns Promise resolving to a MeetingTranscriberPackage
 *
 * @example
 * ```typescript
 * const pkg = await exportTranscriptPackage(transcript);
 * downloadPackage(pkg, transcript.filename);
 * ```
 */
export async function exportTranscriptPackage(
  transcript: Transcript
): Promise<MeetingTranscriberPackage> {
  // Prepare transcript for export (remove transient fields)
  const exportableTranscript = prepareTranscriptForExport(transcript);

  // Create content object for checksum computation
  const checksumContent = createChecksumContent(exportableTranscript, []);

  // Compute checksum
  const checksum = await computeChecksum(checksumContent);

  // Build and return the package
  return {
    metadata: {
      exportedAt: new Date().toISOString(),
      appVersion: APP_VERSION,
      formatVersion: PACKAGE_FORMAT_VERSION,
      checksum,
    },
    transcript: exportableTranscript,
    analyses: [],
  };
}

/**
 * Creates an analysis export package including the transcript and template.
 *
 * @param analysis - The analysis to export
 * @param transcript - The transcript that was analyzed
 * @param template - The template used for analysis
 * @returns Promise resolving to a MeetingTranscriberPackage
 *
 * @example
 * ```typescript
 * const pkg = await exportAnalysisPackage(analysis, transcript, template);
 * downloadPackage(pkg, transcript.filename);
 * ```
 */
export async function exportAnalysisPackage(
  analysis: Analysis,
  transcript: Transcript,
  _template: Template
): Promise<MeetingTranscriberPackage> {
  // Prepare data for export
  const exportableTranscript = prepareTranscriptForExport(transcript);
  const exportableAnalysis = prepareAnalysisForExport(analysis);

  // Note: Template is not included in the package directly per the schema,
  // but the templateId reference is preserved in the analysis.
  // If the importing user doesn't have the template, they can still view
  // the analysis results but won't be able to re-run the analysis.

  // Create content object for checksum computation
  const checksumContent = createChecksumContent(exportableTranscript, [
    exportableAnalysis,
  ]);

  // Compute checksum
  const checksum = await computeChecksum(checksumContent);

  // Build and return the package
  return {
    metadata: {
      exportedAt: new Date().toISOString(),
      appVersion: APP_VERSION,
      formatVersion: PACKAGE_FORMAT_VERSION,
      checksum,
    },
    transcript: exportableTranscript,
    analyses: [exportableAnalysis],
  };
}

/**
 * Creates an export package with multiple analyses.
 *
 * @param transcript - The transcript that was analyzed
 * @param analyses - Array of analyses to include
 * @returns Promise resolving to a MeetingTranscriberPackage
 *
 * @example
 * ```typescript
 * const pkg = await exportMultipleAnalysesPackage(transcript, [analysis1, analysis2]);
 * downloadPackage(pkg, transcript.filename);
 * ```
 */
export async function exportMultipleAnalysesPackage(
  transcript: Transcript,
  analyses: Analysis[]
): Promise<MeetingTranscriberPackage> {
  // Prepare data for export
  const exportableTranscript = prepareTranscriptForExport(transcript);
  const exportableAnalyses = analyses.map(prepareAnalysisForExport);

  // Create content object for checksum computation
  const checksumContent = createChecksumContent(
    exportableTranscript,
    exportableAnalyses
  );

  // Compute checksum
  const checksum = await computeChecksum(checksumContent);

  // Build and return the package
  return {
    metadata: {
      exportedAt: new Date().toISOString(),
      appVersion: APP_VERSION,
      formatVersion: PACKAGE_FORMAT_VERSION,
      checksum,
    },
    transcript: exportableTranscript,
    analyses: exportableAnalyses,
  };
}

// ============================================================================
// Filename Generation
// ============================================================================

/**
 * Generates a safe filename for a package export.
 *
 * @param transcript - The transcript being exported
 * @param packageType - Type of package ('transcript' or 'analysis')
 * @returns Sanitized filename with type suffix and date
 *
 * @example
 * ```typescript
 * const filename = generatePackageFilename(transcript, 'transcript');
 * // Returns: "meeting_recording_transcript-export_2024-12-29.json"
 *
 * const filename = generatePackageFilename(transcript, 'analysis');
 * // Returns: "meeting_recording_analysis-export_2024-12-29.json"
 * ```
 */
export function generatePackageFilename(
  transcript: Transcript,
  packageType: PackageType
): string {
  const sanitizedName = sanitizeFilename(transcript.filename);
  const dateStr = formatDateForFilename(new Date());
  const typeSuffix = packageType === 'transcript' ? 'transcript-export' : 'analysis-export';

  return `${sanitizedName}_${typeSuffix}_${dateStr}.json`;
}

// ============================================================================
// Download Functions
// ============================================================================

/**
 * Triggers a download of the package as a JSON file.
 *
 * @param pkg - The package to download
 * @param baseFilename - Base filename (without extension) for the download
 *
 * @example
 * ```typescript
 * const pkg = await exportTranscriptPackage(transcript);
 * downloadPackage(pkg, 'meeting_transcript-export_2024-12-29');
 * // Downloads: meeting_transcript-export_2024-12-29.json
 * ```
 */
export function downloadPackage(
  pkg: MeetingTranscriberPackage,
  baseFilename: string
): void {
  // Convert package to pretty-printed JSON
  const jsonContent = JSON.stringify(pkg, null, 2);

  // Create blob with JSON MIME type
  const blob = createDownloadBlob(jsonContent, MIME_TYPES.json);

  // Ensure filename has .json extension
  const filename = baseFilename.endsWith('.json')
    ? baseFilename
    : `${baseFilename}.json`;

  // Trigger the download
  triggerDownload(blob, filename);
}

/**
 * Convenience function to export and download a transcript package in one step.
 *
 * @param transcript - The transcript to export and download
 * @returns Promise that resolves when download is triggered
 *
 * @example
 * ```typescript
 * await exportAndDownloadTranscript(transcript);
 * // Automatically generates filename and triggers download
 * ```
 */
export async function exportAndDownloadTranscript(
  transcript: Transcript
): Promise<void> {
  const pkg = await exportTranscriptPackage(transcript);
  const filename = generatePackageFilename(transcript, 'transcript');
  downloadPackage(pkg, filename);
}

/**
 * Convenience function to export and download an analysis package in one step.
 *
 * @param analysis - The analysis to export
 * @param transcript - The transcript that was analyzed
 * @param template - The template used for analysis
 * @returns Promise that resolves when download is triggered
 *
 * @example
 * ```typescript
 * await exportAndDownloadAnalysis(analysis, transcript, template);
 * // Automatically generates filename and triggers download
 * ```
 */
export async function exportAndDownloadAnalysis(
  analysis: Analysis,
  transcript: Transcript,
  _template: Template
): Promise<void> {
  const pkg = await exportAnalysisPackage(analysis, transcript, _template);
  const filename = generatePackageFilename(transcript, 'analysis');
  downloadPackage(pkg, filename);
}

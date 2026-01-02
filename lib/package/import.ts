/**
 * Package Import Utilities
 *
 * Functions for importing Meeting Transcriber shareable packages.
 * Handles file parsing, validation, conflict detection, and database operations.
 */

import {
  validatePackage,
  validatePackageFile,
  verifyChecksum,
  type MeetingTranscriberPackage,
  type ExportableTranscript,
  type ExportableAnalysis,
} from './validation';
import {
  findTranscriptByFingerprint,
  saveTranscript,
  saveAnalysis,
  getTemplate,
  getDatabase,
} from '@/lib/db';
import type { Transcript } from '@/types/transcript';
import type { Analysis } from '@/types/analysis';

// ============================================================================
// Types
// ============================================================================

/**
 * Result of parsing a package file.
 */
export interface ParseResult<T> {
  /** Whether parsing succeeded */
  success: boolean;
  /** Parsed and validated data (only present if success is true) */
  data?: T;
  /** Error message (only present if success is false) */
  error?: string;
}

/**
 * Information about a detected import conflict.
 */
export interface ConflictInfo {
  /** ID of the existing transcript that conflicts */
  existingTranscriptId: string;
  /** Filename of the existing transcript */
  existingFilename: string;
  /** Suggested new name for the import (original + timestamp) */
  suggestedNewName: string;
}

/**
 * Options for importing a package into the database.
 */
export interface ImportOptions {
  /** Action to take on conflict */
  conflictAction: 'rename' | 'cancel';
  /** Custom filename to use if renaming (optional) */
  customFilename?: string;
}

/**
 * Result of a package import operation.
 */
export interface ImportResult {
  /** Whether the import succeeded */
  success: boolean;
  /** ID of the imported transcript (if successful) */
  transcriptId?: string;
  /** ID of the imported analysis (if successful and package contains analysis) */
  analysisId?: string;
  /** ID of the imported template (if successful and package contains template) */
  templateId?: string;
  /** Error message (only present if success is false) */
  error?: string;
  /** Non-fatal warnings encountered during import */
  warnings?: string[];
  /** Whether the transcript was renamed due to conflict */
  wasRenamed?: boolean;
}

/**
 * Result of the initial import orchestration (parse + conflict check).
 */
export interface ImportPreflightResult {
  /** Result of parsing the package file */
  parsed: ParseResult<MeetingTranscriberPackage>;
  /** Conflict information if a duplicate exists (null if no conflict) */
  conflict: ConflictInfo | null;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Generates a new unique transcript ID using crypto.randomUUID().
 *
 * @returns A new UUID string for the transcript
 */
export function generateImportTranscriptId(): string {
  return crypto.randomUUID();
}

/**
 * Generates a new unique analysis ID using crypto.randomUUID().
 *
 * @returns A new UUID string for the analysis
 */
function generateImportAnalysisId(): string {
  return crypto.randomUUID();
}

/**
 * Generates a timestamp-based suffix for renaming imported transcripts.
 *
 * @returns Formatted timestamp string like "2025-01-15-143052"
 */
function generateTimestampSuffix(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');

  return `${year}-${month}-${day}-${hours}${minutes}${seconds}`;
}

/**
 * Generates a suggested new name for an imported transcript.
 * Format: {originalBasename}-imported-{YYYY-MM-DD-HHmmss}{extension}
 *
 * @param originalFilename - The original filename of the transcript
 * @returns The suggested new filename with timestamp suffix
 */
function generateSuggestedNewName(originalFilename: string): string {
  const timestamp = generateTimestampSuffix();

  // Handle files with extensions
  const lastDotIndex = originalFilename.lastIndexOf('.');
  if (lastDotIndex > 0) {
    const basename = originalFilename.substring(0, lastDotIndex);
    const extension = originalFilename.substring(lastDotIndex);
    return `${basename}-imported-${timestamp}${extension}`;
  }

  // No extension
  return `${originalFilename}-imported-${timestamp}`;
}

// ============================================================================
// Parse Functions
// ============================================================================

/**
 * Parses and validates a package file.
 *
 * Performs the following steps:
 * 1. Validates file type and size
 * 2. Parses JSON content
 * 3. Validates package structure with Zod schema
 * 4. Verifies checksum integrity
 *
 * @param file - The File object to parse
 * @returns ParseResult with validated package data or error
 *
 * @example
 * ```typescript
 * const file = event.target.files?.[0];
 * if (file) {
 *   const result = await parsePackageFile(file);
 *   if (result.success) {
 *     console.log('Package parsed:', result.data.transcript.filename);
 *   } else {
 *     console.error('Parse failed:', result.error);
 *   }
 * }
 * ```
 */
export async function parsePackageFile(
  file: File
): Promise<ParseResult<MeetingTranscriberPackage>> {
  // Step 1: Validate file type and size, then parse JSON
  const fileValidation = await validatePackageFile(file);
  if (!fileValidation.success) {
    return {
      success: false,
      error: fileValidation.error,
    };
  }

  // Step 2: Validate package structure
  const packageValidation = validatePackage(fileValidation.data);
  if (!packageValidation.success) {
    return {
      success: false,
      error: packageValidation.error || 'Invalid package structure',
    };
  }

  const pkg = packageValidation.data!;

  // Step 3: Verify checksum integrity
  const checksumValid = await verifyChecksum(pkg);
  if (!checksumValid) {
    return {
      success: false,
      error:
        'Package checksum verification failed. The file may be corrupted or tampered with.',
    };
  }

  return {
    success: true,
    data: pkg,
  };
}

// ============================================================================
// Conflict Detection
// ============================================================================

/**
 * Checks if importing the package would conflict with existing data.
 *
 * Detection strategy:
 * 1. First checks by fingerprint hash (most reliable) if available
 * 2. Falls back to filename + duration combination check
 *
 * @param pkg - The validated package to check for conflicts
 * @returns ConflictInfo if a conflict exists, null otherwise
 *
 * @example
 * ```typescript
 * const parsed = await parsePackageFile(file);
 * if (parsed.success) {
 *   const conflict = await checkForConflict(parsed.data);
 *   if (conflict) {
 *     // Show conflict resolution UI
 *     console.log('Existing:', conflict.existingFilename);
 *     console.log('Suggested new name:', conflict.suggestedNewName);
 *   }
 * }
 * ```
 */
export async function checkForConflict(
  pkg: MeetingTranscriberPackage
): Promise<ConflictInfo | null> {
  const transcript = pkg.transcript;

  // Check 1: By fingerprint hash (most reliable)
  // The exportable transcript may have fingerprint as an optional field
  const fingerprint = (transcript as ExportableTranscript & { fingerprint?: { fileHash: string } }).fingerprint;
  if (fingerprint?.fileHash) {
    const existing = await findTranscriptByFingerprint(fingerprint.fileHash);
    if (existing) {
      return {
        existingTranscriptId: existing.id,
        existingFilename: existing.filename,
        suggestedNewName: generateSuggestedNewName(transcript.filename),
      };
    }
  }

  // Check 2: By filename + duration combination
  // This is a fallback for packages without fingerprints
  const db = getDatabase();
  const matchingByFilename = await db.transcripts
    .where('filename')
    .equals(transcript.filename)
    .toArray();

  // Check if any have the same duration (within 1 second tolerance)
  const duration = transcript.metadata.duration;
  const matchingTranscript = matchingByFilename.find(
    (t) => Math.abs(t.metadata.duration - duration) < 1
  );

  if (matchingTranscript) {
    return {
      existingTranscriptId: matchingTranscript.id,
      existingFilename: matchingTranscript.filename,
      suggestedNewName: generateSuggestedNewName(transcript.filename),
    };
  }

  return null;
}

// ============================================================================
// Import Operations
// ============================================================================

/**
 * Converts an exportable transcript to a full Transcript for database storage.
 *
 * @param exportable - The exportable transcript from the package
 * @param newId - The new ID to assign
 * @param newFilename - Optional new filename (for conflict resolution)
 * @returns A Transcript object ready for database insertion
 */
function convertToTranscript(
  exportable: ExportableTranscript,
  newId: string,
  newFilename?: string
): Transcript {
  return {
    ...exportable,
    id: newId,
    filename: newFilename || exportable.filename,
    createdAt: new Date(exportable.createdAt),
    // audioUrl is intentionally omitted - it's a runtime-only field
  };
}

/**
 * Converts an exportable analysis to a full Analysis for database storage.
 *
 * @param exportable - The exportable analysis from the package
 * @param newId - The new ID to assign
 * @param newTranscriptId - The new transcript ID to link to
 * @returns An Analysis object ready for database insertion
 */
function convertToAnalysis(
  exportable: ExportableAnalysis,
  newId: string,
  newTranscriptId: string
): Analysis {
  return {
    ...exportable,
    id: newId,
    transcriptId: newTranscriptId,
    createdAt: new Date(exportable.createdAt),
  };
}

/**
 * Imports a validated package into the database.
 *
 * Handles:
 * - Conflict resolution (rename or cancel)
 * - Transcript import with new ID
 * - Analysis import (if present) linked to new transcript
 * - Template import (if custom and not already existing)
 *
 * @param pkg - The validated package to import
 * @param options - Import options including conflict action
 * @returns ImportResult with IDs of imported items or error
 *
 * @example
 * ```typescript
 * const result = await importPackageToDatabase(pkg, {
 *   conflictAction: 'rename',
 *   customFilename: 'my-renamed-transcript.mp3',
 * });
 *
 * if (result.success) {
 *   console.log('Imported transcript:', result.transcriptId);
 *   if (result.analysisId) {
 *     console.log('Imported analysis:', result.analysisId);
 *   }
 * }
 * ```
 */
export async function importPackageToDatabase(
  pkg: MeetingTranscriberPackage,
  options: ImportOptions
): Promise<ImportResult> {
  const warnings: string[] = [];

  // Handle cancel action early
  if (options.conflictAction === 'cancel') {
    return {
      success: false,
      error: 'Import cancelled by user',
    };
  }

  try {
    // Generate new IDs
    const newTranscriptId = generateImportTranscriptId();

    // Determine filename (use custom if provided, otherwise original)
    let filename = pkg.transcript.filename;
    let wasRenamed = false;

    if (options.customFilename) {
      filename = options.customFilename;
      wasRenamed = true;
    } else if (options.conflictAction === 'rename') {
      // Check if we need to rename (there might be a conflict)
      const conflict = await checkForConflict(pkg);
      if (conflict) {
        filename = conflict.suggestedNewName;
        wasRenamed = true;
      }
    }

    // Convert and save transcript
    const transcript = convertToTranscript(
      pkg.transcript,
      newTranscriptId,
      filename
    );
    await saveTranscript(transcript);

    let analysisId: string | undefined;
    let templateId: string | undefined;

    // Import analyses if present
    if (pkg.analyses && pkg.analyses.length > 0) {
      // Import the first analysis (primary)
      // Future enhancement: could import all analyses
      const primaryAnalysis = pkg.analyses[0];
      const newAnalysisId = generateImportAnalysisId();

      const analysis = convertToAnalysis(
        primaryAnalysis,
        newAnalysisId,
        newTranscriptId
      );
      await saveAnalysis(analysis);
      analysisId = newAnalysisId;

      // Check if we need to import the template
      // Note: Template might be referenced but not included in package
      // We only import if it's a custom template that doesn't exist
      const existingTemplate = await getTemplate(primaryAnalysis.templateId);
      if (!existingTemplate) {
        // Template doesn't exist - add a warning
        // The package format from validation.ts doesn't include templates
        // This is expected for packages without embedded templates
        warnings.push(
          `Analysis references template '${primaryAnalysis.templateId}' which was not found. ` +
            'The analysis will still be viewable but may show as using an unknown template.'
        );
      }

      // Handle additional analyses (add warning for now)
      if (pkg.analyses.length > 1) {
        warnings.push(
          `Package contains ${pkg.analyses.length} analyses. Only the first analysis was imported.`
        );
      }
    }

    return {
      success: true,
      transcriptId: newTranscriptId,
      analysisId,
      templateId,
      warnings: warnings.length > 0 ? warnings : undefined,
      wasRenamed,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error during import';
    return {
      success: false,
      error: `Failed to import package: ${errorMessage}`,
    };
  }
}

// ============================================================================
// Main Import Orchestrator
// ============================================================================

/**
 * Main import orchestrator that parses a file and checks for conflicts.
 *
 * This is the primary entry point for the import flow. It:
 * 1. Parses and validates the package file
 * 2. Checks for conflicts with existing data
 *
 * The caller should then use the result to either:
 * - Proceed with import if no conflict
 * - Show conflict resolution UI if conflict exists
 * - Show error if parsing failed
 *
 * @param file - The File object to import
 * @returns ImportPreflightResult with parsed package and conflict info
 *
 * @example
 * ```typescript
 * const { parsed, conflict } = await importPackage(file);
 *
 * if (!parsed.success) {
 *   showError(parsed.error);
 *   return;
 * }
 *
 * if (conflict) {
 *   // Show conflict resolution UI
 *   const action = await showConflictDialog(conflict);
 *   if (action === 'rename') {
 *     const result = await importPackageToDatabase(parsed.data, {
 *       conflictAction: 'rename',
 *       customFilename: conflict.suggestedNewName,
 *     });
 *     // Handle result...
 *   }
 * } else {
 *   // No conflict, import directly
 *   const result = await importPackageToDatabase(parsed.data, {
 *     conflictAction: 'rename', // No effect since no conflict
 *   });
 *   // Handle result...
 * }
 * ```
 */
export async function importPackage(
  file: File
): Promise<ImportPreflightResult> {
  // Parse and validate the package
  const parsed = await parsePackageFile(file);

  // If parsing failed, return early with no conflict check
  if (!parsed.success || !parsed.data) {
    return {
      parsed,
      conflict: null,
    };
  }

  // Check for conflicts
  const conflict = await checkForConflict(parsed.data);

  return {
    parsed,
    conflict,
  };
}

/**
 * Convenience function to import a package with automatic conflict handling.
 *
 * This function combines parsing, conflict checking, and import into a single call.
 * Useful for programmatic imports where user interaction isn't needed.
 *
 * @param file - The File object to import
 * @param conflictAction - Action to take on conflict (default: 'rename')
 * @returns ImportResult with import status and IDs
 *
 * @example
 * ```typescript
 * // Import with automatic rename on conflict
 * const result = await importPackageAuto(file);
 *
 * if (result.success) {
 *   console.log('Imported:', result.transcriptId);
 *   if (result.wasRenamed) {
 *     console.log('Note: File was renamed due to conflict');
 *   }
 * }
 * ```
 */
export async function importPackageAuto(
  file: File,
  conflictAction: 'rename' | 'cancel' = 'rename'
): Promise<ImportResult> {
  const { parsed, conflict } = await importPackage(file);

  if (!parsed.success || !parsed.data) {
    return {
      success: false,
      error: parsed.error || 'Failed to parse package file',
    };
  }

  // Use suggested name if conflict exists and action is rename
  const customFilename =
    conflict && conflictAction === 'rename'
      ? conflict.suggestedNewName
      : undefined;

  return importPackageToDatabase(parsed.data, {
    conflictAction,
    customFilename,
  });
}

/**
 * Package Validation Utilities
 *
 * Zod schemas and validation functions for validating Meeting Transcriber
 * shareable JSON packages. Provides robust validation before processing imports.
 */

import { z, type ZodIssue } from 'zod';

// ============================================================================
// Constants
// ============================================================================

/**
 * Maximum allowed package size (20MB)
 */
export const MAX_PACKAGE_SIZE = 20 * 1024 * 1024; // 20MB in bytes

/**
 * Current package format version
 */
export const PACKAGE_FORMAT_VERSION = '1.0';

/**
 * Maximum duration for transcript segments (4 hours)
 */
const MAX_DURATION = 4 * 60 * 60; // 4 hours in seconds

/**
 * Minimum file size for audio metadata (1KB)
 */
const MIN_FILE_SIZE = 1024; // 1KB in bytes

/**
 * Maximum file size for audio metadata (25MB - OpenAI Whisper limit)
 */
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB in bytes

// ============================================================================
// Local Type Definitions (to be moved to @/types/package when created)
// ============================================================================

/**
 * Transcript segment structure for export (matches TranscriptSegment)
 */
export interface ExportableTranscriptSegment {
  index: number;
  start: number;
  end: number;
  text: string;
  speaker?: string;
}

/**
 * Transcript metadata for export (matches TranscriptMetadata)
 */
export interface ExportableTranscriptMetadata {
  model: string;
  language?: string;
  fileSize: number;
  duration: number;
}

/**
 * Exportable transcript structure (without audioUrl which is runtime-only)
 */
export interface ExportableTranscript {
  id: string;
  filename: string;
  text: string;
  segments: ExportableTranscriptSegment[];
  createdAt: string; // ISO 8601 string for JSON serialization
  metadata: ExportableTranscriptMetadata;
  summary?: string;
  department?: string;
}

/**
 * Evidence citation for export (matches Evidence)
 */
export interface ExportableEvidence {
  text: string;
  start: number;
  end: number;
  relevance: number;
}

/**
 * Analysis section for export (matches AnalysisSection)
 */
export interface ExportableAnalysisSection {
  name: string;
  content: string;
  evidence: ExportableEvidence[];
}

/**
 * Action item for export (matches ActionItem)
 */
export interface ExportableActionItem {
  id: string;
  task: string;
  owner?: string;
  deadline?: string;
  timestamp: number;
  agendaItemIds?: string[];
  decisionIds?: string[];
  assignedBy?: string;
  assignmentTimestamp?: number;
  priority?: 'high' | 'medium' | 'low';
  isExplicit?: boolean;
  confidence?: number;
}

/**
 * Decision for export (matches Decision)
 */
export interface ExportableDecision {
  id: string;
  decision: string;
  timestamp: number;
  context?: string;
  agendaItemIds?: string[];
  madeBy?: string;
  participants?: string[];
  isExplicit?: boolean;
  voteTally?: {
    for: number;
    against: number;
    abstain: number;
  };
  confidence?: number;
}

/**
 * Quote for export (matches Quote)
 */
export interface ExportableQuote {
  text: string;
  speaker?: string;
  timestamp: number;
  context?: string;
  category?: 'decision' | 'commitment' | 'concern' | 'insight' | 'humor';
  sentiment?: 'positive' | 'negative' | 'neutral';
  confidence?: number;
}

/**
 * Agenda item for export (matches AgendaItem)
 */
export interface ExportableAgendaItem {
  id: string;
  topic: string;
  timestamp?: number;
  context?: string;
}

/**
 * Analysis results for export (matches AnalysisResults)
 */
export interface ExportableAnalysisResults {
  summary?: string;
  sections: ExportableAnalysisSection[];
  agendaItems?: ExportableAgendaItem[];
  actionItems?: ExportableActionItem[];
  decisions?: ExportableDecision[];
  quotes?: ExportableQuote[];
}

/**
 * Evaluation results for export (matches EvaluationResults)
 */
export interface ExportableEvaluationResults {
  improvements: string[];
  additions: string[];
  qualityScore: number;
  reasoning: string;
  warnings?: string[];
  orphanedItems?: {
    decisionsWithoutAgenda?: string[];
    actionItemsWithoutDecisions?: string[];
    agendaItemsWithoutDecisions?: string[];
  };
}

/**
 * Exportable analysis structure
 */
export interface ExportableAnalysis {
  id: string;
  transcriptId: string;
  templateId: string;
  analysisStrategy: 'basic' | 'hybrid' | 'advanced';
  draftResults?: ExportableAnalysisResults;
  evaluation?: ExportableEvaluationResults;
  results: ExportableAnalysisResults;
  metadata?: {
    estimatedDuration: string;
    apiCalls: string;
    quality: string;
    actualTokens: number;
    wasAutoSelected: boolean;
  };
  createdAt: string; // ISO 8601 string for JSON serialization
}

/**
 * Package metadata
 */
export interface PackageMetadata {
  exportedAt: string; // ISO 8601 timestamp
  appVersion: string;
  formatVersion: string;
  checksum: string;
}

/**
 * Complete shareable package structure
 */
export interface MeetingTranscriberPackage {
  metadata: PackageMetadata;
  transcript: ExportableTranscript;
  analyses: ExportableAnalysis[];
}

// ============================================================================
// Validation Result Type
// ============================================================================

/**
 * Result of validation operations.
 * Returns success with validated data or error details.
 */
export interface ValidationResult<T> {
  /** Whether validation succeeded */
  success: boolean;
  /** Validated data (only present if success is true) */
  data?: T;
  /** Human-readable error message (only present if success is false) */
  error?: string;
  /** Detailed Zod validation issues (only present if success is false) */
  issues?: ZodIssue[];
}

// ============================================================================
// Zod Schemas
// ============================================================================

/**
 * Schema for transcript segment validation
 * Uses .nullish() for speaker to accept both null and undefined
 */
export const transcriptSegmentSchema = z.object({
  index: z
    .number()
    .int('Segment index must be an integer')
    .nonnegative('Segment index must be non-negative'),
  start: z
    .number()
    .nonnegative('Start time must be non-negative')
    .max(MAX_DURATION, `Start time cannot exceed ${MAX_DURATION} seconds`),
  end: z
    .number()
    .nonnegative('End time must be non-negative')
    .max(MAX_DURATION, `End time cannot exceed ${MAX_DURATION} seconds`),
  text: z
    .string()
    .min(1, 'Segment text cannot be empty')
    .max(5000, 'Segment text must be 5000 characters or less'),
  speaker: z.string().nullish(),
}).refine(
  (segment) => segment.end >= segment.start,
  {
    message: 'End time must be greater than or equal to start time',
  }
);

/**
 * Schema for transcript metadata validation
 * Uses .nullish() for language to accept both null and undefined
 */
export const transcriptMetadataSchema = z.object({
  model: z.string().min(1, 'Model name is required'),
  language: z.string().length(2, 'Language code must be 2 characters (ISO 639-1)').nullish(),
  fileSize: z
    .number()
    .int('File size must be an integer')
    .min(MIN_FILE_SIZE, `File size must be at least ${MIN_FILE_SIZE} bytes`)
    .max(MAX_FILE_SIZE, `File size cannot exceed ${MAX_FILE_SIZE} bytes`),
  duration: z
    .number()
    .nonnegative('Duration must be non-negative')
    .max(MAX_DURATION, `Duration cannot exceed ${MAX_DURATION} seconds`),
});

/**
 * Schema for exportable transcript validation (without audioUrl)
 * Uses .nullish() for optional fields to accept both null and undefined
 */
export const exportableTranscriptSchema = z.object({
  id: z.string().min(1, 'Transcript ID is required').max(100, 'Transcript ID must be 100 characters or less'),
  filename: z.string().min(1, 'Filename is required').max(255, 'Filename must be 255 characters or less'),
  text: z.string().min(1, 'Transcript text cannot be empty').max(1000000, 'Transcript text must be 1,000,000 characters or less'),
  segments: z.array(transcriptSegmentSchema).min(1, 'Transcript must have at least one segment').max(10000, 'Transcript cannot have more than 10,000 segments'),
  createdAt: z.string().datetime({ message: 'createdAt must be a valid ISO 8601 datetime string' }),
  metadata: transcriptMetadataSchema,
  summary: z.string().max(5000, 'Summary must be 5000 characters or less').nullish(),
  department: z.string().max(200, 'Department must be 200 characters or less').nullish(),
});

/**
 * Schema for evidence validation
 * Uses coercion and defaults to handle malformed AI output
 */
export const evidenceSchema = z.object({
  text: z.string().nullish().transform(v => v ?? ''),
  start: z.number().nonnegative('Start time must be non-negative').nullish().transform(v => v ?? 0),
  end: z.number().nonnegative('End time must be non-negative').nullish().transform(v => v ?? 0),
  relevance: z.number().min(0).max(1).nullish().transform(v => v ?? 0.5),
}).refine(
  (evidence) => evidence.end >= evidence.start,
  {
    message: 'End time must be greater than or equal to start time',
  }
);

/**
 * Schema for analysis section validation
 * Uses transforms to handle malformed AI output
 */
export const analysisSectionSchema = z.object({
  name: z.string().nullish().transform(v => v ?? 'Unnamed Section'),
  content: z.string().nullish().transform(v => v ?? ''),
  evidence: z.array(evidenceSchema).nullish().transform(v => v ?? []),
});

/**
 * Schema for vote tally validation
 */
const voteTallySchema = z.object({
  for: z.number().int().nonnegative(),
  against: z.number().int().nonnegative(),
  abstain: z.number().int().nonnegative(),
});

/**
 * Schema for action item validation
 * Uses .nullish() to accept both null and undefined (AI may return null for optional fields)
 */
const actionItemSchema = z.object({
  id: z.string().min(1, 'Action item ID is required'),
  task: z.string().min(1, 'Task description is required'),
  owner: z.string().nullish(),
  deadline: z.string().nullish(),
  timestamp: z.number().nonnegative('Timestamp must be non-negative'),
  agendaItemIds: z.array(z.string()).nullish(),
  decisionIds: z.array(z.string()).nullish(),
  assignedBy: z.string().nullish(),
  assignmentTimestamp: z.number().nonnegative().nullish(),
  priority: z.enum(['high', 'medium', 'low']).nullish(),
  isExplicit: z.boolean().nullish(),
  confidence: z.number().min(0).max(1).nullish(),
});

/**
 * Schema for decision validation
 * Uses .nullish() to accept both null and undefined (AI may return null for optional fields)
 */
const decisionSchema = z.object({
  id: z.string().min(1, 'Decision ID is required'),
  decision: z.string().min(1, 'Decision description is required'),
  timestamp: z.number().nonnegative('Timestamp must be non-negative'),
  context: z.string().nullish(),
  agendaItemIds: z.array(z.string()).nullish(),
  madeBy: z.string().nullish(),
  participants: z.array(z.string()).nullish(),
  isExplicit: z.boolean().nullish(),
  voteTally: voteTallySchema.nullish(),
  confidence: z.number().min(0).max(1).nullish(),
});

/**
 * Schema for quote validation
 * Uses .nullish() to accept both null and undefined (AI may return null for optional fields)
 */
const quoteSchema = z.object({
  text: z.string().min(1, 'Quote text is required'),
  speaker: z.string().nullish(),
  timestamp: z.number().nonnegative('Timestamp must be non-negative'),
  context: z.string().nullish(),
  category: z.enum(['decision', 'commitment', 'concern', 'insight', 'humor']).nullish(),
  sentiment: z.enum(['positive', 'negative', 'neutral']).nullish(),
  confidence: z.number().min(0).max(1).nullish(),
});

/**
 * Schema for agenda item validation
 * Uses .nullish() to accept both null and undefined (AI may return null for optional fields)
 */
const agendaItemSchema = z.object({
  id: z.string().min(1, 'Agenda item ID is required'),
  topic: z.string().min(1, 'Agenda topic is required'),
  timestamp: z.number().nonnegative().nullish(),
  context: z.string().nullish(),
});

/**
 * Schema for analysis results validation
 * Uses .nullish() to accept both null and undefined (AI may return null for optional fields)
 */
export const analysisResultsSchema = z.object({
  summary: z.string().nullish(),
  sections: z.array(analysisSectionSchema).min(0),
  agendaItems: z.array(agendaItemSchema).nullish(),
  actionItems: z.array(actionItemSchema).nullish(),
  decisions: z.array(decisionSchema).nullish(),
  quotes: z.array(quoteSchema).nullish(),
});

/**
 * Schema for orphaned items validation
 * Uses .nullish() to accept both null and undefined
 */
const orphanedItemsSchema = z.object({
  decisionsWithoutAgenda: z.array(z.string()).nullish(),
  actionItemsWithoutDecisions: z.array(z.string()).nullish(),
  agendaItemsWithoutDecisions: z.array(z.string()).nullish(),
});

/**
 * Schema for evaluation results validation
 * Uses .nullish() to accept both null and undefined
 */
const evaluationResultsSchema = z.object({
  improvements: z.array(z.string()),
  additions: z.array(z.string()),
  qualityScore: z.number().min(0).max(10),
  reasoning: z.string(),
  warnings: z.array(z.string()).nullish(),
  orphanedItems: orphanedItemsSchema.nullish(),
});

/**
 * Schema for analysis metadata validation
 */
const analysisMetadataSchema = z.object({
  estimatedDuration: z.string(),
  apiCalls: z.string(),
  quality: z.string(),
  actualTokens: z.number().int().nonnegative(),
  wasAutoSelected: z.boolean(),
});

/**
 * Schema for exportable analysis validation
 * Uses .nullish() to accept both null and undefined
 */
export const exportableAnalysisSchema = z.object({
  id: z.string().min(1, 'Analysis ID is required'),
  transcriptId: z.string().min(1, 'Transcript ID is required'),
  templateId: z.string().min(1, 'Template ID is required'),
  analysisStrategy: z.enum(['basic', 'hybrid', 'advanced']),
  draftResults: analysisResultsSchema.nullish(),
  evaluation: evaluationResultsSchema.nullish(),
  results: analysisResultsSchema,
  metadata: analysisMetadataSchema.nullish(),
  createdAt: z.string().datetime({ message: 'createdAt must be a valid ISO 8601 datetime string' }),
});

/**
 * Schema for package metadata validation
 */
const packageMetadataSchema = z.object({
  exportedAt: z.string().datetime({ message: 'exportedAt must be a valid ISO 8601 datetime string' }),
  appVersion: z.string().min(1, 'App version is required'),
  formatVersion: z.string().min(1, 'Format version is required'),
  checksum: z.string().min(1, 'Checksum is required'),
});

/**
 * Schema for complete package validation
 */
export const packageSchema = z.object({
  metadata: packageMetadataSchema,
  transcript: exportableTranscriptSchema,
  analyses: z.array(exportableAnalysisSchema).default([]),
});

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Checks if the data looks like a legacy JSON export (raw transcript without package wrapper).
 * Legacy exports have id, filename, segments at root level instead of metadata + transcript.
 *
 * @param data - Data to check
 * @returns true if it looks like a legacy export
 */
function isLegacyJsonExport(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false;

  const obj = data as Record<string, unknown>;

  // Legacy exports have these at root level (not wrapped in transcript object)
  const hasRootTranscriptFields =
    'id' in obj && 'filename' in obj && 'segments' in obj && 'createdAt' in obj;

  // Package format has metadata and transcript at root
  const hasPackageStructure = 'metadata' in obj && 'transcript' in obj;

  return hasRootTranscriptFields && !hasPackageStructure;
}

/**
 * Validates a complete Meeting Transcriber package.
 *
 * @param data - Unknown data to validate as a package
 * @returns ValidationResult with validated package or error details
 *
 * @example
 * ```typescript
 * const fileContent = await file.text();
 * const parsed = JSON.parse(fileContent);
 * const result = validatePackage(parsed);
 *
 * if (result.success) {
 *   console.log('Valid package:', result.data.transcript.filename);
 * } else {
 *   console.error('Invalid package:', result.error);
 * }
 * ```
 */
export function validatePackage(data: unknown): ValidationResult<MeetingTranscriberPackage> {
  try {
    // Check for legacy JSON export format and provide helpful error
    if (isLegacyJsonExport(data)) {
      return {
        success: false,
        error:
          'This file appears to be an old-format JSON export. ' +
          'To share transcripts, please use "Share as Package" from the Export menu. ' +
          'The old JSON format cannot be imported.',
      };
    }

    const result = packageSchema.safeParse(data);

    if (result.success) {
      return {
        success: true,
        data: result.data as MeetingTranscriberPackage,
      };
    }

    return {
      success: false,
      error: formatZodError(result.error.issues),
      issues: result.error.issues,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown validation error',
    };
  }
}

/**
 * Validates transcript data for import.
 *
 * @param data - Unknown data to validate as a transcript
 * @returns ValidationResult with validated transcript or error details
 *
 * @example
 * ```typescript
 * const result = validateTranscriptData(transcriptJson);
 * if (result.success) {
 *   await db.saveTranscript(result.data);
 * }
 * ```
 */
export function validateTranscriptData(data: unknown): ValidationResult<ExportableTranscript> {
  try {
    const result = exportableTranscriptSchema.safeParse(data);

    if (result.success) {
      return {
        success: true,
        data: result.data as ExportableTranscript,
      };
    }

    return {
      success: false,
      error: formatZodError(result.error.issues),
      issues: result.error.issues,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown validation error',
    };
  }
}

/**
 * Validates analysis data for import.
 *
 * @param data - Unknown data to validate as an analysis
 * @returns ValidationResult with validated analysis or error details
 *
 * @example
 * ```typescript
 * const result = validateAnalysisData(analysisJson);
 * if (result.success) {
 *   await db.saveAnalysis(result.data);
 * }
 * ```
 */
export function validateAnalysisData(data: unknown): ValidationResult<ExportableAnalysis> {
  try {
    const result = exportableAnalysisSchema.safeParse(data);

    if (result.success) {
      return {
        success: true,
        data: result.data as ExportableAnalysis,
      };
    }

    return {
      success: false,
      error: formatZodError(result.error.issues),
      issues: result.error.issues,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown validation error',
    };
  }
}

// ============================================================================
// Package Size Validation
// ============================================================================

/**
 * Validates that a file does not exceed the maximum package size.
 *
 * @param file - File object to validate
 * @returns ValidationResult indicating success or failure with error message
 *
 * @example
 * ```typescript
 * const fileInput = document.getElementById('import-file') as HTMLInputElement;
 * const file = fileInput.files?.[0];
 *
 * if (file) {
 *   const sizeResult = validatePackageSize(file);
 *   if (!sizeResult.success) {
 *     showError(sizeResult.error);
 *     return;
 *   }
 *   // Proceed with import...
 * }
 * ```
 */
export function validatePackageSize(file: File): ValidationResult<void> {
  if (file.size > MAX_PACKAGE_SIZE) {
    const maxSizeMB = MAX_PACKAGE_SIZE / (1024 * 1024);
    const actualSizeMB = (file.size / (1024 * 1024)).toFixed(2);

    return {
      success: false,
      error: `Package file size (${actualSizeMB}MB) exceeds maximum allowed size (${maxSizeMB}MB)`,
    };
  }

  return {
    success: true,
  };
}

/**
 * Validates package size from raw byte count.
 *
 * @param sizeInBytes - Size of the package in bytes
 * @returns ValidationResult indicating success or failure with error message
 */
export function validatePackageSizeBytes(sizeInBytes: number): ValidationResult<void> {
  if (sizeInBytes > MAX_PACKAGE_SIZE) {
    const maxSizeMB = MAX_PACKAGE_SIZE / (1024 * 1024);
    const actualSizeMB = (sizeInBytes / (1024 * 1024)).toFixed(2);

    return {
      success: false,
      error: `Package size (${actualSizeMB}MB) exceeds maximum allowed size (${maxSizeMB}MB)`,
    };
  }

  return {
    success: true,
  };
}

// ============================================================================
// Checksum Utilities
// ============================================================================

/**
 * Computes a SHA-256 checksum of a content object.
 * Used for verifying package integrity during import.
 *
 * @param content - Object to compute checksum for (will be JSON stringified)
 * @returns Promise resolving to hex-encoded SHA-256 hash
 *
 * @example
 * ```typescript
 * const packageContent = { transcript, analyses };
 * const checksum = await computeChecksum(packageContent);
 * console.log('Checksum:', checksum); // e.g., "a1b2c3d4..."
 * ```
 */
export async function computeChecksum(content: object): Promise<string> {
  // Create a stable JSON string (sorted keys for consistency)
  const jsonString = JSON.stringify(content, Object.keys(content).sort());

  // Encode to bytes
  const encoder = new TextEncoder();
  const data = encoder.encode(jsonString);

  // Compute SHA-256 hash using Web Crypto API
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);

  // Convert to hex string
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

  return hashHex;
}

/**
 * Verifies the checksum of a Meeting Transcriber package.
 * Ensures the package has not been tampered with or corrupted.
 *
 * @param pkg - Package to verify
 * @returns Promise resolving to true if checksum matches, false otherwise
 *
 * @example
 * ```typescript
 * const result = validatePackage(parsedJson);
 * if (result.success) {
 *   const isValid = await verifyChecksum(result.data);
 *   if (!isValid) {
 *     showError('Package checksum verification failed. File may be corrupted.');
 *     return;
 *   }
 * }
 * ```
 */
export async function verifyChecksum(pkg: MeetingTranscriberPackage): Promise<boolean> {
  try {
    // Extract the stored checksum
    const storedChecksum = pkg.metadata.checksum;

    // Create content object matching what was used during export
    // (everything except the checksum itself)
    const contentForChecksum = {
      transcript: pkg.transcript,
      analyses: pkg.analyses,
    };

    // Compute the checksum of the content
    const computedChecksum = await computeChecksum(contentForChecksum);

    // Compare checksums
    return storedChecksum === computedChecksum;
  } catch {
    // If checksum computation fails, verification fails
    return false;
  }
}

/**
 * Creates checksum content object from package data.
 * Used both during export (to create checksum) and import (to verify).
 *
 * @param transcript - Transcript data
 * @param analyses - Array of analysis data
 * @returns Object suitable for checksum computation
 */
export function createChecksumContent(
  transcript: ExportableTranscript,
  analyses: ExportableAnalysis[]
): { transcript: ExportableTranscript; analyses: ExportableAnalysis[] } {
  return {
    transcript,
    analyses,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Formats Zod validation issues into a human-readable error message.
 *
 * @param issues - Array of Zod validation issues
 * @returns Formatted error message
 */
function formatZodError(issues: ZodIssue[]): string {
  if (issues.length === 0) {
    return 'Validation failed';
  }

  if (issues.length === 1) {
    const issue = issues[0];
    const path = issue.path.join('.');
    return path ? `${path}: ${issue.message}` : issue.message;
  }

  // Multiple issues - summarize
  const firstIssue = issues[0];
  const path = firstIssue.path.join('.');
  const firstError = path ? `${path}: ${firstIssue.message}` : firstIssue.message;

  return `${firstError} (and ${issues.length - 1} more issue${issues.length > 2 ? 's' : ''})`;
}

/**
 * Validates that a string is valid JSON and parses it.
 *
 * @param jsonString - String to parse as JSON
 * @returns ValidationResult with parsed object or error
 */
export function parsePackageJson(jsonString: string): ValidationResult<unknown> {
  try {
    const parsed = JSON.parse(jsonString);
    return {
      success: true,
      data: parsed,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof SyntaxError
        ? `Invalid JSON: ${error.message}`
        : 'Failed to parse JSON content',
    };
  }
}

/**
 * Validates the file type for package import.
 * Only accepts .json files.
 *
 * @param file - File to validate
 * @returns ValidationResult indicating success or failure
 */
export function validatePackageFileType(file: File): ValidationResult<void> {
  const validTypes = ['application/json'];
  const validExtensions = ['.json'];

  // Check MIME type
  const hasValidType = validTypes.includes(file.type) || file.type === '';

  // Check file extension
  const hasValidExtension = validExtensions.some((ext) =>
    file.name.toLowerCase().endsWith(ext)
  );

  if (!hasValidType && !hasValidExtension) {
    return {
      success: false,
      error: 'Invalid file type. Please select a .json file.',
    };
  }

  return {
    success: true,
  };
}

/**
 * Comprehensive file validation for package import.
 * Validates file type, size, and JSON parsing.
 *
 * @param file - File to validate
 * @returns Promise resolving to ValidationResult with parsed content or error
 *
 * @example
 * ```typescript
 * const file = event.target.files?.[0];
 * if (file) {
 *   const result = await validatePackageFile(file);
 *   if (result.success) {
 *     const packageResult = validatePackage(result.data);
 *     // Continue with import...
 *   } else {
 *     showError(result.error);
 *   }
 * }
 * ```
 */
export async function validatePackageFile(file: File): Promise<ValidationResult<unknown>> {
  // Validate file type
  const typeResult = validatePackageFileType(file);
  if (!typeResult.success) {
    return typeResult;
  }

  // Validate file size
  const sizeResult = validatePackageSize(file);
  if (!sizeResult.success) {
    return sizeResult;
  }

  // Read and parse file content
  try {
    const content = await file.text();
    return parsePackageJson(content);
  } catch {
    return {
      success: false,
      error: 'Failed to read file content',
    };
  }
}

// ============================================================================
// Type Inference from Schemas
// ============================================================================

export type ValidatedTranscriptSegment = z.infer<typeof transcriptSegmentSchema>;
export type ValidatedTranscriptMetadata = z.infer<typeof transcriptMetadataSchema>;
export type ValidatedExportableTranscript = z.infer<typeof exportableTranscriptSchema>;
export type ValidatedAnalysisResults = z.infer<typeof analysisResultsSchema>;
export type ValidatedExportableAnalysis = z.infer<typeof exportableAnalysisSchema>;
export type ValidatedPackage = z.infer<typeof packageSchema>;

/**
 * Package Module Export
 *
 * Provides utilities for exporting and importing Meeting Transcriber packages.
 * These shareable JSON packages allow users to share transcripts and analyses
 * with others or backup their data.
 */

// Export utilities
export {
  exportTranscriptPackage,
  exportAnalysisPackage,
  exportMultipleAnalysesPackage,
  generatePackageFilename,
  downloadPackage,
  exportAndDownloadTranscript,
  exportAndDownloadAnalysis,
  type PackageType,
} from './export';

// Validation utilities
export {
  // Constants
  MAX_PACKAGE_SIZE,
  PACKAGE_FORMAT_VERSION,

  // Schemas
  transcriptSegmentSchema,
  transcriptMetadataSchema,
  exportableTranscriptSchema,
  analysisResultsSchema,
  exportableAnalysisSchema,
  packageSchema,

  // Validation functions
  validatePackage,
  validateTranscriptData,
  validateAnalysisData,
  validatePackageSize,
  validatePackageSizeBytes,
  validatePackageFileType,
  validatePackageFile,
  parsePackageJson,

  // Checksum utilities
  computeChecksum,
  verifyChecksum,
  createChecksumContent,

  // Types
  type ValidationResult,
  type ExportableTranscriptSegment,
  type ExportableTranscriptMetadata,
  type ExportableTranscript,
  type ExportableEvidence,
  type ExportableAnalysisSection,
  type ExportableActionItem,
  type ExportableDecision,
  type ExportableQuote,
  type ExportableAgendaItem,
  type ExportableAnalysisResults,
  type ExportableEvaluationResults,
  type ExportableAnalysis,
  type PackageMetadata,
  type MeetingTranscriberPackage,

  // Inferred types from schemas
  type ValidatedTranscriptSegment,
  type ValidatedTranscriptMetadata,
  type ValidatedExportableTranscript,
  type ValidatedAnalysisResults,
  type ValidatedExportableAnalysis,
  type ValidatedPackage,
} from './validation';

// Import utilities
export {
  // Functions
  parsePackageFile,
  checkForConflict,
  importPackageToDatabase,
  importPackage,
  importPackageAuto,
  generateImportTranscriptId,

  // Types
  type ParseResult,
  type ConflictInfo,
  type ImportOptions,
  type ImportResult,
  type ImportPreflightResult,
} from './import';

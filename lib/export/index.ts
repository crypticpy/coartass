/**
 * Export Module Entry Point
 *
 * Provides a centralized export point for all export-related functionality.
 */

// Re-export all formatters
export {
  formatTXT,
  formatJSON,
  formatSRT,
  formatVTT,
  formatTimestamp,
  formatDuration,
  formatDate,
  sanitizeText,
  type TimestampFormat,
} from './formatters';

// Re-export download helpers
export {
  createDownloadBlob,
  generateFilename,
  triggerDownload,
  downloadFile,
  isBrowserCompatible,
  validateContent,
  safeDownload,
  MIME_TYPES,
  type ExportFormat,
} from './download-helper';

// Re-export transcript exporter (main API)
export {
  exportToTXT,
  exportToJSON,
  exportToSRT,
  exportToVTT,
  exportTranscript,
  getFormattedContent,
  validateTranscriptForExport,
  batchExport,
  EXPORT_FORMATS,
  type ExportResult,
  type ExportOptions,
} from './transcript-exporter';

// Re-export analysis exporter
export {
  exportAnalysis,
  downloadExport,
  estimateExportSize,
  getExportFormats,
  DEFAULT_EXPORT_OPTIONS,
  type ExportFormat as AnalysisExportFormat,
  type ExportOptions as AnalysisExportOptions,
  type ExportResult as AnalysisExportResult,
} from './analysis-exporter';

// Re-export individual analysis format generators
export { generateAnalysisText } from './analysis-text';
export { generateAnalysisDocx } from './analysis-docx';
export { generateAnalysisJson, getAnalysisJsonSchema } from './analysis-json';
export { generateAnalysisPdf } from './analysis-pdf-export';

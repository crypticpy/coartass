/**
 * PDF Export Module
 *
 * Centralized export point for all PDF generation functionality.
 * Provides React-PDF components and utilities for generating
 * professional PDF documents from transcripts and analysis results.
 */

// Export PDF document components
export { TranscriptPDFDocument } from "./transcript-pdf";
export type { TranscriptPDFDocumentProps } from "./transcript-pdf";

export { AnalysisPDFDocument } from "./analysis-pdf";
export type { AnalysisPDFDocumentProps } from "./analysis-pdf";

export { ScorecardPDFDocument } from "./scorecard-pdf";
export type { ScorecardPDFDocumentProps } from "./scorecard-pdf";

// Export PDF generation utilities
export {
  exportTranscriptToPDF,
  exportAnalysisToPDF,
  exportScorecardToPDF,
  exportAndDownloadTranscript,
  exportAndDownloadAnalysis,
  exportAndDownloadScorecard,
  triggerPDFDownload,
  generatePDFFilename,
  estimateTranscriptPDFSize,
  estimateAnalysisPDFSize,
  isPDFExportSupported,
} from "./pdf-exporter";

export type {
  TranscriptPDFOptions,
  AnalysisPDFOptions,
  ScorecardPDFOptions,
  PDFExportResult,
} from "./pdf-exporter";

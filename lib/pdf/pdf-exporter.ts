/**
 * PDF Exporter Utilities
 *
 * Client-side PDF generation utilities for transcripts and analysis results.
 * Provides functions to generate PDFs and trigger downloads in the browser.
 */

import React from "react";
import { pdf } from "@react-pdf/renderer";
import { Transcript, Analysis } from "@/types";
import type { Template } from "@/types";
import type { RtassRubricTemplate, RtassScorecard } from "@/types/rtass";
import { TranscriptPDFDocument } from "./transcript-pdf";
import { AnalysisPDFDocument } from "./analysis-pdf";
import { ScorecardPDFDocument } from "./scorecard-pdf";

/**
 * Options for transcript PDF export
 */
export interface TranscriptPDFOptions {
  /** Whether to include the full continuous transcript text */
  includeFullText?: boolean;
  /** Whether to show individual segments with timestamps */
  includeSegments?: boolean;
}

/**
 * Options for analysis PDF export
 */
export interface AnalysisPDFOptions {
  /** Optional template information for context */
  template?: Template;
  /** Whether to include table of contents */
  includeTableOfContents?: boolean;
}

/**
 * Options for scorecard PDF export
 */
export interface ScorecardPDFOptions {
  /** Optional rubric template information */
  rubric?: RtassRubricTemplate;
  /** Original transcript filename for context */
  transcriptFilename?: string;
  /** Optional incident information */
  incidentInfo?: {
    incidentNumber?: string;
    incidentDate?: Date;
    location?: string;
  };
}

/**
 * Result of a PDF export operation
 */
export interface PDFExportResult {
  /** Whether the export was successful */
  success: boolean;
  /** The generated PDF blob (if successful) */
  blob?: Blob;
  /** Error message (if failed) */
  error?: string;
  /** Size of the generated PDF in bytes (if successful) */
  size?: number;
}

/**
 * Validates a transcript for PDF export
 *
 * @param transcript - The transcript to validate
 * @returns True if valid, false otherwise
 */
function validateTranscript(transcript: Transcript): boolean {
  if (!transcript) {
    return false;
  }

  if (!transcript.filename || transcript.filename.trim() === "") {
    return false;
  }

  if (!transcript.text || transcript.text.trim() === "") {
    return false;
  }

  if (!Array.isArray(transcript.segments)) {
    return false;
  }

  if (!transcript.metadata || !transcript.createdAt) {
    return false;
  }

  return true;
}

/**
 * Validates an analysis for PDF export
 *
 * @param analysis - The analysis to validate
 * @param transcript - The source transcript
 * @returns True if valid, false otherwise
 */
function validateAnalysis(analysis: Analysis, transcript: Transcript): boolean {
  if (!analysis || !transcript) {
    return false;
  }

  if (!validateTranscript(transcript)) {
    return false;
  }

  if (!analysis.results || !Array.isArray(analysis.results.sections)) {
    return false;
  }

  if (analysis.results.sections.length === 0) {
    return false;
  }

  return true;
}

/**
 * Validates a scorecard for PDF export
 *
 * @param scorecard - The scorecard to validate
 * @returns True if valid, false otherwise
 */
function validateScorecard(scorecard: RtassScorecard): boolean {
  if (!scorecard) {
    return false;
  }

  if (!scorecard.id || scorecard.id.trim() === "") {
    return false;
  }

  if (!scorecard.transcriptId || scorecard.transcriptId.trim() === "") {
    return false;
  }

  if (!scorecard.rubricTemplateId || scorecard.rubricTemplateId.trim() === "") {
    return false;
  }

  if (!scorecard.createdAt) {
    return false;
  }

  if (!scorecard.modelInfo?.model || scorecard.modelInfo.model.trim() === "") {
    return false;
  }

  if (!scorecard.overall || typeof scorecard.overall.score !== "number") {
    return false;
  }

  if (!Array.isArray(scorecard.sections)) {
    return false;
  }

  return true;
}

/**
 * Generates a PDF blob from a React element
 *
 * @param document - React-PDF document element
 * @returns Promise resolving to PDF blob
 * @throws Error if PDF generation fails
 */
async function generatePDF(
  document:
    | ReturnType<typeof TranscriptPDFDocument>
    | ReturnType<typeof AnalysisPDFDocument>
    | ReturnType<typeof ScorecardPDFDocument>
): Promise<Blob> {
  try {
    const pdfInstance = pdf(document as React.ReactElement);
    const blob = await pdfInstance.toBlob();
    return blob;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to generate PDF";
    throw new Error(`PDF generation failed: ${message}`);
  }
}

/**
 * Triggers a download of a PDF blob in the browser
 *
 * @param blob - The PDF blob to download
 * @param filename - Desired filename for the download
 */
export function triggerPDFDownload(blob: Blob, filename: string): void {
  // Ensure filename ends with .pdf
  const pdfFilename = filename.endsWith(".pdf") ? filename : `${filename}.pdf`;

  // Create object URL for the blob
  const url = URL.createObjectURL(blob);

  try {
    // Create temporary link element
    const link = document.createElement("a");
    link.href = url;
    link.download = pdfFilename;
    link.style.display = "none";

    // Append to body, click, and remove
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } finally {
    // Clean up object URL after a delay to ensure download started
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 100);
  }
}

/**
 * Exports a transcript to PDF
 *
 * Generates a professionally formatted PDF document from a transcript,
 * including metadata, timestamped segments, and optional full text.
 *
 * @param transcript - The transcript to export
 * @param options - Export options
 * @returns Promise resolving to export result
 *
 * @example
 * ```ts
 * const result = await exportTranscriptToPDF(transcript);
 * if (result.success && result.blob) {
 *   triggerPDFDownload(result.blob, transcript.filename);
 * }
 * ```
 */
export async function exportTranscriptToPDF(
  transcript: Transcript,
  options: TranscriptPDFOptions = {}
): Promise<PDFExportResult> {
  try {
    // Validate transcript
    if (!validateTranscript(transcript)) {
      return {
        success: false,
        error: "Invalid transcript data. Cannot generate PDF.",
      };
    }

    // Set default options
    const {
      includeFullText = true,
      includeSegments = true,
    } = options;

    // Generate PDF document
    const blob = await generatePDF(
      React.createElement(TranscriptPDFDocument, {
        transcript,
        includeFullText,
        includeSegments,
      })
    );

    return {
      success: true,
      blob,
      size: blob.size,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";
    return {
      success: false,
      error: message,
    };
  }
}

/**
 * Exports analysis results to PDF
 *
 * Generates a professionally formatted PDF report from analysis results,
 * including sections, evidence citations, action items, decisions, and quotes.
 *
 * @param analysis - The analysis results to export
 * @param transcript - The source transcript
 * @param options - Export options
 * @returns Promise resolving to export result
 *
 * @example
 * ```ts
 * const result = await exportAnalysisToPDF(analysis, transcript, { template });
 * if (result.success && result.blob) {
 *   triggerPDFDownload(result.blob, `${transcript.filename}-analysis`);
 * }
 * ```
 */
export async function exportAnalysisToPDF(
  analysis: Analysis,
  transcript: Transcript,
  options: AnalysisPDFOptions = {}
): Promise<PDFExportResult> {
  try {
    // Validate analysis and transcript
    if (!validateAnalysis(analysis, transcript)) {
      return {
        success: false,
        error: "Invalid analysis or transcript data. Cannot generate PDF.",
      };
    }

    // Set default options
    const {
      template,
      includeTableOfContents = true,
    } = options;

    // Generate PDF document
    const blob = await generatePDF(
      React.createElement(AnalysisPDFDocument, {
        analysis,
        transcript,
        template,
        includeTableOfContents,
      })
    );

    return {
      success: true,
      blob,
      size: blob.size,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";
    return {
      success: false,
      error: message,
    };
  }
}

/**
 * Exports a scorecard to PDF
 *
 * @param scorecard - The scorecard to export
 * @param options - Export options
 * @returns Promise resolving to export result
 */
export async function exportScorecardToPDF(
  scorecard: RtassScorecard,
  options: ScorecardPDFOptions = {}
): Promise<PDFExportResult> {
  try {
    if (!validateScorecard(scorecard)) {
      return {
        success: false,
        error: "Invalid scorecard data. Cannot generate PDF.",
      };
    }

    const { rubric, transcriptFilename, incidentInfo } = options;

    const scorecardData: RtassScorecard = {
      ...scorecard,
      createdAt:
        scorecard.createdAt instanceof Date
          ? scorecard.createdAt
          : new Date(scorecard.createdAt),
      humanReview: scorecard.humanReview
        ? {
            ...scorecard.humanReview,
            reviewedAt:
              scorecard.humanReview.reviewedAt instanceof Date
                ? scorecard.humanReview.reviewedAt
                : scorecard.humanReview.reviewedAt
                  ? new Date(scorecard.humanReview.reviewedAt)
                  : undefined,
          }
        : undefined,
    };

    const rubricData: RtassRubricTemplate | undefined = rubric
      ? {
          ...rubric,
          createdAt:
            rubric.createdAt instanceof Date
              ? rubric.createdAt
              : new Date(rubric.createdAt),
          updatedAt:
            rubric.updatedAt instanceof Date
              ? rubric.updatedAt
              : rubric.updatedAt
                ? new Date(rubric.updatedAt)
                : undefined,
        }
      : undefined;

    const incidentData = incidentInfo
      ? {
          ...incidentInfo,
          incidentDate:
            incidentInfo.incidentDate instanceof Date
              ? incidentInfo.incidentDate
              : incidentInfo.incidentDate
                ? new Date(incidentInfo.incidentDate)
                : undefined,
        }
      : undefined;

    const blob = await generatePDF(
      React.createElement(ScorecardPDFDocument, {
        scorecard: scorecardData,
        rubric: rubricData,
        transcriptFilename,
        incidentInfo: incidentData,
      })
    );

    return {
      success: true,
      blob,
      size: blob.size,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";
    return {
      success: false,
      error: message,
    };
  }
}

/**
 * Generates a sanitized filename for PDF export
 *
 * @param baseFilename - Base filename (e.g., transcript filename)
 * @param suffix - Optional suffix to append (e.g., "transcript", "analysis")
 * @returns Sanitized filename suitable for download
 */
export function generatePDFFilename(
  baseFilename: string,
  suffix?: string
): string {
  // Remove file extension from base filename
  const nameWithoutExt = baseFilename.replace(/\.[^/.]+$/, "");

  // Sanitize filename (remove special characters, replace spaces)
  const sanitized = nameWithoutExt
    .replace(/[^a-zA-Z0-9-_\s]/g, "")
    .replace(/\s+/g, "-")
    .toLowerCase();

  // Add suffix if provided
  const withSuffix = suffix ? `${sanitized}-${suffix}` : sanitized;

  // Add .pdf extension
  return `${withSuffix}.pdf`;
}

/**
 * Exports a transcript to PDF and triggers download
 *
 * Convenience function that combines PDF generation and download trigger.
 *
 * @param transcript - The transcript to export
 * @param options - Export options
 * @returns Promise resolving to export result
 */
export async function exportAndDownloadTranscript(
  transcript: Transcript,
  options: TranscriptPDFOptions = {}
): Promise<PDFExportResult> {
  const result = await exportTranscriptToPDF(transcript, options);

  if (result.success && result.blob) {
    const filename = generatePDFFilename(transcript.filename, "transcript");
    triggerPDFDownload(result.blob, filename);
  }

  return result;
}

/**
 * Exports analysis results to PDF and triggers download
 *
 * Convenience function that combines PDF generation and download trigger.
 *
 * @param analysis - The analysis results to export
 * @param transcript - The source transcript
 * @param options - Export options
 * @returns Promise resolving to export result
 */
export async function exportAndDownloadAnalysis(
  analysis: Analysis,
  transcript: Transcript,
  options: AnalysisPDFOptions = {}
): Promise<PDFExportResult> {
  const result = await exportAnalysisToPDF(analysis, transcript, options);

  if (result.success && result.blob) {
    const filename = generatePDFFilename(transcript.filename, "analysis");
    triggerPDFDownload(result.blob, filename);
  }

  return result;
}

/**
 * Exports a scorecard to PDF and triggers download
 *
 * Convenience function that combines PDF generation and download trigger.
 *
 * @param scorecard - The scorecard to export
 * @param options - Export options
 * @returns Promise resolving to export result
 */
export async function exportAndDownloadScorecard(
  scorecard: RtassScorecard,
  options: ScorecardPDFOptions = {}
): Promise<PDFExportResult> {
  const result = await exportScorecardToPDF(scorecard, options);

  if (result.success && result.blob) {
    const base = options.transcriptFilename ?? `rtass-scorecard-${scorecard.id.slice(0, 8)}`;
    const suffix = options.transcriptFilename ? "scorecard" : undefined;
    const filename = generatePDFFilename(base, suffix);
    triggerPDFDownload(result.blob, filename);
  }

  return result;
}

/**
 * Estimates the size of a PDF before generation (rough approximation)
 *
 * @param transcript - The transcript to estimate
 * @returns Estimated size in bytes
 */
export function estimateTranscriptPDFSize(transcript: Transcript): number {
  // Very rough estimation: ~1KB per segment + base overhead
  const baseOverhead = 50000; // 50KB base
  const perSegment = 1024; // 1KB per segment
  const textSize = transcript.text.length * 0.5; // Text compression factor

  return baseOverhead + (transcript.segments.length * perSegment) + textSize;
}

/**
 * Estimates the size of an analysis PDF before generation
 *
 * @param analysis - The analysis to estimate
 * @returns Estimated size in bytes
 */
export function estimateAnalysisPDFSize(analysis: Analysis): number {
  // Very rough estimation
  const baseOverhead = 60000; // 60KB base
  const perSection = 2048; // 2KB per section
  const perEvidence = 512; // 512 bytes per evidence
  const perActionItem = 256; // 256 bytes per action item

  let totalSize = baseOverhead;
  totalSize += analysis.results.sections.length * perSection;

  // Add evidence
  analysis.results.sections.forEach((section) => {
    totalSize += (section.evidence?.length || 0) * perEvidence;
  });

  // Add action items
  if (analysis.results.actionItems) {
    totalSize += analysis.results.actionItems.length * perActionItem;
  }

  // Add decisions
  if (analysis.results.decisions) {
    totalSize += analysis.results.decisions.length * perActionItem;
  }

  // Add quotes
  if (analysis.results.quotes) {
    totalSize += analysis.results.quotes.length * perActionItem;
  }

  return totalSize;
}

/**
 * Type guard to check if PDF export is supported in the current environment
 *
 * @returns True if PDF export is supported, false otherwise
 */
export function isPDFExportSupported(): boolean {
  // Check if we're in a browser environment
  if (typeof window === "undefined" || typeof document === "undefined") {
    return false;
  }

  // Check if Blob is supported
  if (typeof Blob === "undefined") {
    return false;
  }

  // Check if URL.createObjectURL is supported
  if (typeof URL === "undefined" || typeof URL.createObjectURL !== "function") {
    return false;
  }

  return true;
}

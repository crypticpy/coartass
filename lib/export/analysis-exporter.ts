/**
 * Analysis Export Orchestrator
 *
 * Single entry point for exporting analysis results to various formats.
 * Handles PDF, DOCX, TXT, and JSON exports with customizable options.
 */

import type { Analysis, Transcript, Template } from "@/types";

/**
 * Export format options
 */
export type ExportFormat = "pdf" | "docx" | "txt" | "json";

/**
 * Options for customizing exports
 */
export interface ExportOptions {
  /** Include executive summary section */
  includeSummary?: boolean;
  /** Include analysis sections */
  includeSections?: boolean;
  /** Include evidence citations within sections */
  includeEvidence?: boolean;
  /** Include action items table */
  includeActionItems?: boolean;
  /** Include decisions timeline */
  includeDecisions?: boolean;
  /** Include notable quotes */
  includeQuotes?: boolean;
  /** Include document metadata */
  includeMetadata?: boolean;
  /** Include table of contents (PDF/DOCX only) */
  includeTOC?: boolean;
}

/**
 * Default export options
 */
export const DEFAULT_EXPORT_OPTIONS: Required<ExportOptions> = {
  includeSummary: true,
  includeSections: true,
  includeEvidence: true,
  includeActionItems: true,
  includeDecisions: true,
  includeQuotes: true,
  includeMetadata: true,
  includeTOC: true,
};

/**
 * Export result with metadata
 */
export interface ExportResult {
  /** The exported file as a Blob */
  blob: Blob;
  /** Suggested filename */
  filename: string;
  /** MIME type */
  mimeType: string;
  /** Estimated page count (for PDF/DOCX) */
  estimatedPages?: number;
}

/**
 * Generate a slugified filename from components
 */
function generateFilename(
  templateName: string,
  transcriptFilename: string,
  format: ExportFormat
): string {
  const templateSlug = templateName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  // Extract base name from transcript filename
  const baseName = transcriptFilename
    .replace(/\.[^/.]+$/, "") // Remove extension
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  const date = new Date().toISOString().split("T")[0];

  const extensions: Record<ExportFormat, string> = {
    pdf: "pdf",
    docx: "docx",
    txt: "txt",
    json: "json",
  };

  return `${templateSlug}-analysis-${baseName}-${date}.${extensions[format]}`;
}

/**
 * Format timestamp seconds to HH:MM:SS or MM:SS
 */
export function formatTimestamp(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}

/**
 * Format a date for display
 */
export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

/**
 * Get a short date string for filenames
 */
export function formatDateShort(date: Date): string {
  return date.toISOString().split("T")[0];
}

/**
 * Export analysis to the specified format
 *
 * @param analysis - The analysis results to export
 * @param transcript - The source transcript for context
 * @param template - The template used for analysis
 * @param format - The export format (pdf, docx, txt, json)
 * @param options - Optional customization options
 * @returns Promise resolving to the export result
 *
 * @example
 * ```typescript
 * const result = await exportAnalysis(analysis, transcript, template, 'pdf');
 * // Download the file
 * const url = URL.createObjectURL(result.blob);
 * const a = document.createElement('a');
 * a.href = url;
 * a.download = result.filename;
 * a.click();
 * ```
 */
export async function exportAnalysis(
  analysis: Analysis,
  transcript: Transcript,
  template: Template,
  format: ExportFormat,
  options: ExportOptions = {}
): Promise<ExportResult> {
  const mergedOptions = { ...DEFAULT_EXPORT_OPTIONS, ...options };
  const filename = generateFilename(template.name, transcript.filename, format);

  switch (format) {
    case "pdf": {
      const { generateAnalysisPdf } = await import("./analysis-pdf-export");
      const blob = await generateAnalysisPdf(
        analysis,
        transcript,
        template,
        mergedOptions
      );
      return {
        blob,
        filename,
        mimeType: "application/pdf",
        estimatedPages: estimatePageCount(analysis, mergedOptions),
      };
    }

    case "docx": {
      const { generateAnalysisDocx } = await import("./analysis-docx");
      const blob = await generateAnalysisDocx(
        analysis,
        transcript,
        template,
        mergedOptions
      );
      return {
        blob,
        filename,
        mimeType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        estimatedPages: estimatePageCount(analysis, mergedOptions),
      };
    }

    case "txt": {
      const { generateAnalysisText } = await import("./analysis-text");
      const text = generateAnalysisText(
        analysis,
        transcript,
        template,
        mergedOptions
      );
      const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
      return {
        blob,
        filename,
        mimeType: "text/plain",
      };
    }

    case "json": {
      const { generateAnalysisJson } = await import("./analysis-json");
      const json = generateAnalysisJson(
        analysis,
        transcript,
        template,
        mergedOptions
      );
      const blob = new Blob([json], { type: "application/json;charset=utf-8" });
      return {
        blob,
        filename,
        mimeType: "application/json",
      };
    }

    default:
      throw new Error(`Unsupported export format: ${format}`);
  }
}

/**
 * Filter evidence to only include items with valid data
 * Prevents NaN values when evidence was disabled during analysis
 */
function filterValidEvidence(evidence: Analysis["results"]["sections"][0]["evidence"]) {
  return evidence?.filter(
    (e) =>
      e.text &&
      typeof e.start === "number" &&
      !isNaN(e.start) &&
      typeof e.end === "number" &&
      !isNaN(e.end) &&
      typeof e.relevance === "number" &&
      !isNaN(e.relevance)
  );
}

/**
 * Estimate page count for PDF/DOCX exports
 */
function estimatePageCount(
  analysis: Analysis,
  options: Required<ExportOptions>
): number {
  let contentLength = 0;

  if (options.includeSummary && analysis.results.summary) {
    contentLength += analysis.results.summary.length;
  }

  if (options.includeSections) {
    for (const section of analysis.results.sections) {
      contentLength += section.name.length + section.content.length;
      // Only count valid evidence
      const validEvidence = filterValidEvidence(section.evidence);
      if (options.includeEvidence && validEvidence) {
        for (const evidence of validEvidence) {
          contentLength += evidence.text.length + 50; // timestamp overhead
        }
      }
    }
  }

  if (options.includeActionItems && analysis.results.actionItems) {
    contentLength += analysis.results.actionItems.length * 100; // avg action item length
  }

  if (options.includeDecisions && analysis.results.decisions) {
    contentLength += analysis.results.decisions.length * 150; // avg decision length
  }

  if (options.includeQuotes && analysis.results.quotes) {
    contentLength += analysis.results.quotes.length * 100; // avg quote length
  }

  // Rough estimate: ~3000 characters per page
  return Math.max(1, Math.ceil(contentLength / 3000));
}

/**
 * Get file size estimate for the export
 */
export function estimateExportSize(
  analysis: Analysis,
  format: ExportFormat,
  options: ExportOptions = {}
): string {
  const mergedOptions = { ...DEFAULT_EXPORT_OPTIONS, ...options };
  const pageCount = estimatePageCount(analysis, mergedOptions);

  // Rough size estimates per format
  const bytesPerPage: Record<ExportFormat, number> = {
    pdf: 15000, // ~15KB per page for PDF
    docx: 8000, // ~8KB per page for DOCX
    txt: 3000, // ~3KB per page for plain text
    json: 5000, // ~5KB per page for JSON
  };

  const estimatedBytes = pageCount * bytesPerPage[format];

  if (estimatedBytes < 1024) {
    return `${estimatedBytes} B`;
  } else if (estimatedBytes < 1024 * 1024) {
    return `${Math.round(estimatedBytes / 1024)} KB`;
  } else {
    return `${(estimatedBytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}

/**
 * Download the exported file
 */
export function downloadExport(result: ExportResult): void {
  const url = URL.createObjectURL(result.blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = result.filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Get available export formats with descriptions
 */
export function getExportFormats(): Array<{
  format: ExportFormat;
  label: string;
  description: string;
  extension: string;
}> {
  return [
    {
      format: "pdf",
      label: "PDF Document",
      description: "Professional reports, printing, archival",
      extension: ".pdf",
    },
    {
      format: "docx",
      label: "Word Document",
      description: "Editable documents, Word compatibility",
      extension: ".docx",
    },
    {
      format: "txt",
      label: "Plain Text",
      description: "Simple text, email body, accessibility",
      extension: ".txt",
    },
    {
      format: "json",
      label: "JSON Data",
      description: "Data interchange, integrations, backup",
      extension: ".json",
    },
  ];
}

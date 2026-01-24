/**
 * Supplemental Material Type Definitions
 *
 * Types for handling supplemental source materials (Word, PDF, PowerPoint, text)
 * that can be uploaded alongside transcripts to provide additional context
 * for analysis.
 */

import type { VisinetReport } from "@/lib/visinet-parser";

/**
 * Supported document types for supplemental materials.
 */
export type SupplementalDocumentType =
  | "docx"
  | "pdf"
  | "pptx"
  | "txt"
  | "pasted";

/**
 * Document classification for different types of supplemental content.
 * Used to apply appropriate parsing and formatting for analysis.
 */
export type SupplementalDocumentCategory =
  | "visinet" // CAD/dispatch report from Visinet
  | "sop" // Standard Operating Procedure
  | "policy" // Department policy document
  | "training" // Training material
  | "report" // Incident report or after-action review
  | "other"; // Uncategorized

/**
 * Processing status for a supplemental document.
 */
export type SupplementalDocumentStatus = "parsing" | "ready" | "error";

/**
 * Represents a parsed supplemental document with extracted text.
 */
export interface SupplementalDocument {
  /** Unique identifier for this document */
  id: string;

  /** Original filename (or 'Pasted Text' for pasted content) */
  filename: string;

  /** Document type */
  type: SupplementalDocumentType;

  /** Document category for specialized parsing/formatting */
  category?: SupplementalDocumentCategory;

  /** Extracted text content */
  text: string;

  /** Estimated token count of the extracted text */
  tokenCount: number;

  /** Current processing status */
  status: SupplementalDocumentStatus;

  /** Error message if parsing failed */
  error?: string;

  /** Non-fatal warnings (e.g., "Some content may be images") */
  warnings?: string[];

  /** Original file size in bytes (for uploaded files) */
  fileSize?: number;

  /** Timestamp when document was added */
  addedAt: Date;

  /** Whether to include this document in analysis (default: true) */
  includeInAnalysis?: boolean;

  /** Parsed Visinet report data (only for category='visinet') */
  visinetData?: VisinetReport;
}

/**
 * Represents a supplemental document persisted to IndexedDB.
 * Extends SupplementalDocument with a link to the parent transcript.
 *
 * Used for managing supplemental documents attached to incidents,
 * which are automatically included in subsequent analyses.
 */
export interface PersistedSupplementalDocument extends SupplementalDocument {
  /** ID of the parent transcript this document is attached to */
  transcriptId: string;
}

/**
 * Result of parsing a document.
 */
export interface ParseResult {
  /** Extracted text content */
  text: string;

  /** Estimated token count */
  tokenCount: number;

  /** Non-fatal warnings during parsing */
  warnings?: string[];
}

/**
 * State for the supplemental upload feature.
 */
export interface SupplementalState {
  /** Uploaded/parsed documents */
  documents: SupplementalDocument[];

  /** Pasted text content */
  pastedText: string;

  /** Token count for pasted text */
  pastedTextTokens: number;

  /** Combined token count of all supplemental materials */
  totalTokens: number;

  /** Whether any document is currently being parsed */
  isProcessing: boolean;
}

/**
 * Limits and thresholds for supplemental materials.
 */
export const SUPPLEMENTAL_LIMITS = {
  /** Maximum file size in bytes (browser safety, not content limit) */
  MAX_FILE_SIZE_BYTES: 100 * 1024 * 1024, // 100MB

  /** Maximum tokens per individual document */
  MAX_TOKENS_PER_DOCUMENT: 50_000,

  /** Maximum combined tokens for all supplemental materials */
  MAX_TOTAL_SUPPLEMENTAL_TOKENS: 100_000,

  /** Percentage of context at which to show warning */
  WARNING_THRESHOLD_PERCENT: 80,

  /** Supported file extensions */
  SUPPORTED_EXTENSIONS: [".docx", ".pdf", ".pptx", ".txt"] as const,

  /** MIME types for supported formats */
  SUPPORTED_MIME_TYPES: [
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
    "application/pdf", // .pdf
    "application/vnd.openxmlformats-officedocument.presentationml.presentation", // .pptx
    "text/plain", // .txt
  ] as const,
} as const;

/**
 * Type guard to check if a file extension is supported.
 */
export function isSupportedExtension(
  ext: string,
): ext is (typeof SUPPLEMENTAL_LIMITS.SUPPORTED_EXTENSIONS)[number] {
  return SUPPLEMENTAL_LIMITS.SUPPORTED_EXTENSIONS.includes(
    ext.toLowerCase() as (typeof SUPPLEMENTAL_LIMITS.SUPPORTED_EXTENSIONS)[number],
  );
}

/**
 * Get document type from file extension.
 */
export function getDocumentTypeFromExtension(
  filename: string,
): SupplementalDocumentType | null {
  const ext = filename.toLowerCase().split(".").pop();
  switch (ext) {
    case "docx":
      return "docx";
    case "pdf":
      return "pdf";
    case "pptx":
      return "pptx";
    case "txt":
      return "txt";
    default:
      return null;
  }
}

/**
 * Get human-readable document type label.
 */
export function getDocumentTypeLabel(type: SupplementalDocumentType): string {
  switch (type) {
    case "docx":
      return "Word Document";
    case "pdf":
      return "PDF";
    case "pptx":
      return "PowerPoint";
    case "txt":
      return "Text File";
    case "pasted":
      return "Pasted Text";
    default:
      return "Document";
  }
}

/**
 * Initial/empty state for supplemental uploads.
 */
export const EMPTY_SUPPLEMENTAL_STATE: SupplementalState = {
  documents: [],
  pastedText: "",
  pastedTextTokens: 0,
  totalTokens: 0,
  isProcessing: false,
};

/**
 * Detect document category based on filename and content.
 * Returns 'other' if no specific category is detected.
 */
export function detectDocumentCategory(
  filename: string,
  text: string,
): SupplementalDocumentCategory {
  const lowerFilename = filename.toLowerCase();
  const lowerText = text.toLowerCase();

  // Check for Visinet report indicators
  const visinetIndicators = [
    "incident detail report",
    "data source: data warehouse",
    "resources assigned",
    "personnel assigned",
    "visinet",
  ];
  const visinetMatches = visinetIndicators.filter((ind) =>
    lowerText.includes(ind),
  ).length;
  if (visinetMatches >= 2) {
    return "visinet";
  }

  // Check for SOP indicators
  if (
    lowerFilename.includes("sop") ||
    lowerText.includes("standard operating procedure") ||
    lowerText.includes("operational guideline")
  ) {
    return "sop";
  }

  // Check for policy indicators
  if (
    lowerFilename.includes("policy") ||
    lowerText.includes("department policy") ||
    lowerText.includes("administrative directive")
  ) {
    return "policy";
  }

  // Check for training material indicators
  if (
    lowerFilename.includes("training") ||
    lowerFilename.includes("curriculum") ||
    lowerText.includes("learning objectives")
  ) {
    return "training";
  }

  // Check for report indicators
  if (
    lowerFilename.includes("report") ||
    lowerFilename.includes("aar") ||
    lowerText.includes("after action") ||
    lowerText.includes("incident report")
  ) {
    return "report";
  }

  return "other";
}

/**
 * Get human-readable category label.
 */
export function getCategoryLabel(
  category: SupplementalDocumentCategory,
): string {
  switch (category) {
    case "visinet":
      return "CAD Report";
    case "sop":
      return "SOP";
    case "policy":
      return "Policy";
    case "training":
      return "Training";
    case "report":
      return "Report";
    case "other":
    default:
      return "Document";
  }
}

/**
 * Supplemental Material Type Definitions
 *
 * Types for handling supplemental source materials (Word, PDF, PowerPoint, text)
 * that can be uploaded alongside transcripts to provide additional context
 * for analysis.
 */

/**
 * Supported document types for supplemental materials.
 */
export type SupplementalDocumentType = 'docx' | 'pdf' | 'pptx' | 'txt' | 'pasted';

/**
 * Processing status for a supplemental document.
 */
export type SupplementalDocumentStatus = 'parsing' | 'ready' | 'error';

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
  SUPPORTED_EXTENSIONS: ['.docx', '.pdf', '.pptx', '.txt'] as const,

  /** MIME types for supported formats */
  SUPPORTED_MIME_TYPES: [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
    'application/pdf', // .pdf
    'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
    'text/plain', // .txt
  ] as const,
} as const;

/**
 * Type guard to check if a file extension is supported.
 */
export function isSupportedExtension(
  ext: string
): ext is (typeof SUPPLEMENTAL_LIMITS.SUPPORTED_EXTENSIONS)[number] {
  return SUPPLEMENTAL_LIMITS.SUPPORTED_EXTENSIONS.includes(
    ext.toLowerCase() as (typeof SUPPLEMENTAL_LIMITS.SUPPORTED_EXTENSIONS)[number]
  );
}

/**
 * Get document type from file extension.
 */
export function getDocumentTypeFromExtension(
  filename: string
): SupplementalDocumentType | null {
  const ext = filename.toLowerCase().split('.').pop();
  switch (ext) {
    case 'docx':
      return 'docx';
    case 'pdf':
      return 'pdf';
    case 'pptx':
      return 'pptx';
    case 'txt':
      return 'txt';
    default:
      return null;
  }
}

/**
 * Get human-readable document type label.
 */
export function getDocumentTypeLabel(type: SupplementalDocumentType): string {
  switch (type) {
    case 'docx':
      return 'Word Document';
    case 'pdf':
      return 'PDF';
    case 'pptx':
      return 'PowerPoint';
    case 'txt':
      return 'Text File';
    case 'pasted':
      return 'Pasted Text';
    default:
      return 'Document';
  }
}

/**
 * Initial/empty state for supplemental uploads.
 */
export const EMPTY_SUPPLEMENTAL_STATE: SupplementalState = {
  documents: [],
  pastedText: '',
  pastedTextTokens: 0,
  totalTokens: 0,
  isProcessing: false,
};

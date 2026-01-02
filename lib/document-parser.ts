/**
 * Document Parser Module
 *
 * Provides text extraction from various document formats:
 * - Word (.docx) via mammoth
 * - PDF via pdfjs-dist
 * - PowerPoint (.pptx) via jszip + XML parsing
 * - Plain text (.txt) via native FileReader
 *
 * All parsing happens client-side in the browser.
 */

'use client';

import { estimateTokens } from '@/lib/token-utils';
import type { ParseResult } from '@/types/supplemental';
import { getDocumentTypeFromExtension, SUPPLEMENTAL_LIMITS } from '@/types/supplemental';

type PdfJsTextContent = {
  items: unknown[];
};

type PdfJsPage = {
  getTextContent: () => Promise<PdfJsTextContent>;
};

type PdfJsDocument = {
  numPages: number;
  getPage: (pageNum: number) => Promise<PdfJsPage>;
};

type PdfJsLoadingTask = {
  promise: Promise<PdfJsDocument>;
};

function isPdfJsTextItem(item: unknown): item is { str: string } {
  if (!item || typeof item !== 'object') return false;
  const record = item as Record<string, unknown>;
  return typeof record.str === 'string';
}

/**
 * Parse a document file and extract text content.
 *
 * @param file - File to parse
 * @returns Promise with extracted text, token count, and any warnings
 * @throws Error if file type is not supported or parsing fails
 */
export async function parseDocument(file: File): Promise<ParseResult> {
  // Check file size
  if (file.size > SUPPLEMENTAL_LIMITS.MAX_FILE_SIZE_BYTES) {
    throw new Error(
      `File size exceeds ${SUPPLEMENTAL_LIMITS.MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB limit`
    );
  }

  // Determine document type
  const docType = getDocumentTypeFromExtension(file.name);

  if (!docType) {
    throw new Error(
      `Unsupported file type. Supported formats: ${SUPPLEMENTAL_LIMITS.SUPPORTED_EXTENSIONS.join(', ')}`
    );
  }

  // Route to appropriate parser
  switch (docType) {
    case 'docx':
      return parseDocx(file);
    case 'pdf':
      return parsePdf(file);
    case 'pptx':
      return parsePptx(file);
    case 'txt':
      return parseTxt(file);
    default:
      throw new Error(`Unsupported document type: ${docType}`);
  }
}

/**
 * Parse a Word document (.docx) and extract text.
 * Uses the mammoth library for reliable DOCX parsing.
 */
export async function parseDocx(file: File): Promise<ParseResult> {
  // Dynamic import to avoid loading mammoth until needed
  const mammoth = await import('mammoth');

  const arrayBuffer = await file.arrayBuffer();

  try {
    const result = await mammoth.extractRawText({ arrayBuffer });
    const text = result.value.trim();
    const warnings: string[] = [];

    // Check for messages from mammoth (usually about unsupported features)
    if (result.messages && result.messages.length > 0) {
      const warningMessages = result.messages
        .filter((msg) => msg.type === 'warning')
        .map((msg) => msg.message);
      if (warningMessages.length > 0) {
        warnings.push(`Word parsing notes: ${warningMessages.join('; ')}`);
      }
    }

    if (!text || text.length === 0) {
      warnings.push('No text content extracted from document');
    }

    const tokenCount = estimateTokens(text);

    if (tokenCount > SUPPLEMENTAL_LIMITS.MAX_TOKENS_PER_DOCUMENT) {
      warnings.push(
        `Document is very large (~${tokenCount.toLocaleString()} tokens). Consider using a shorter excerpt.`
      );
    }

    return { text, tokenCount, warnings: warnings.length > 0 ? warnings : undefined };
  } catch (error) {
    throw new Error(
      `Failed to parse Word document: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Parse a PDF document and extract text.
 * Uses pdfjs-dist (Mozilla's PDF.js) for reliable PDF parsing.
 */
export async function parsePdf(file: File): Promise<ParseResult> {
  const arrayBuffer = await file.arrayBuffer();
  const warnings: string[] = [];

  try {
    // Dynamic import PDF.js.
    // Note: depending on bundler settings, the module may be exposed as named exports
    // or via a default export. Handle both.
    const pdfjsModule = await import('pdfjs-dist');

    const pdfjsLib = (() => {
      const moduleRecord = pdfjsModule as unknown as Record<string, unknown>;
      if (typeof moduleRecord.getDocument === 'function') return moduleRecord;

      const defaultExport = moduleRecord.default as unknown;
      if (defaultExport && typeof defaultExport === 'object') {
        const defaultRecord = defaultExport as Record<string, unknown>;
        if (typeof defaultRecord.getDocument === 'function') return defaultRecord;
      }

      throw new Error('PDF parser failed to load (missing getDocument export)');
    })();

    // Configure worker source (required for pdfjs-dist v5+ in many bundlers).
    // We ship the worker from /public/workers via scripts/copy-pdf-worker.mjs.
    const globalWorkerOptions = pdfjsLib.GlobalWorkerOptions as unknown;
    if (globalWorkerOptions && (typeof globalWorkerOptions === 'function' || typeof globalWorkerOptions === 'object')) {
      (globalWorkerOptions as { workerSrc?: unknown }).workerSrc = '/workers/pdf.worker.min.mjs';
    }

    // Load the PDF document
    const getDocument = pdfjsLib.getDocument as (src: unknown) => PdfJsLoadingTask;
    const loadingTask = getDocument({
      data: arrayBuffer,
      useWorkerFetch: false,
    });
    const pdf = await loadingTask.promise;

    const textParts: string[] = [];
    const numPages = pdf.numPages;

    // Extract text from each page
    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      try {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();

        // Combine text items with proper spacing
        const pageText = textContent.items
          .map((item) => (isPdfJsTextItem(item) ? item.str : ''))
          .join(' ');

        if (pageText.trim()) {
          textParts.push(pageText.trim());
        }
      } catch (_pageError) {
        warnings.push(`Could not extract text from page ${pageNum}`);
      }
    }

    const text = textParts.join('\n\n').trim();

    // Check if we extracted any meaningful text
    if (!text || text.length < 10) {
      warnings.push(
        'No text extracted from PDF. The document may contain only images or scanned content.'
      );
    }

    const tokenCount = estimateTokens(text);

    // Warn about large documents
    if (tokenCount > SUPPLEMENTAL_LIMITS.MAX_TOKENS_PER_DOCUMENT) {
      warnings.push(
        `PDF is very large (~${tokenCount.toLocaleString()} tokens). Consider using specific pages or a shorter excerpt.`
      );
    }

    return { text, tokenCount, warnings: warnings.length > 0 ? warnings : undefined };
  } catch (error) {
    // Handle specific PDF.js errors
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    if (errorMessage.includes('password')) {
      throw new Error('PDF is password-protected. Please unlock the PDF and try again.');
    }

    if (errorMessage.includes('Invalid PDF')) {
      throw new Error('Invalid or corrupted PDF file.');
    }

    if (errorMessage.includes('Object.defineProperty called on non-object')) {
      throw new Error(
        'Failed to parse PDF: PDF worker failed to initialize. Please refresh and try again.'
      );
    }

    throw new Error(`Failed to parse PDF: ${errorMessage}`);
  }
}

/**
 * Parse a PowerPoint document (.pptx) and extract text.
 * PPTX files are ZIP archives containing XML files.
 * We extract text from the slide XML files.
 */
export async function parsePptx(file: File): Promise<ParseResult> {
  // Dynamic import JSZip
  const JSZip = (await import('jszip')).default;

  const arrayBuffer = await file.arrayBuffer();
  const warnings: string[] = [];

  try {
    const zip = await JSZip.loadAsync(arrayBuffer);

    // Find all slide XML files
    const slideFiles = Object.keys(zip.files)
      .filter((name) => name.match(/ppt\/slides\/slide\d+\.xml$/))
      .sort((a, b) => {
        // Sort slides numerically
        const numA = parseInt(a.match(/slide(\d+)/)?.[1] || '0', 10);
        const numB = parseInt(b.match(/slide(\d+)/)?.[1] || '0', 10);
        return numA - numB;
      });

    if (slideFiles.length === 0) {
      throw new Error('No slides found in PowerPoint file');
    }

    const textParts: string[] = [];

    for (const slideFile of slideFiles) {
      try {
        const content = await zip.file(slideFile)?.async('text');
        if (content) {
          // Extract text from XML
          // PowerPoint text is in <a:t> elements
          const textMatches = content.match(/<a:t>([^<]*)<\/a:t>/g);
          if (textMatches) {
            const slideText = textMatches
              .map((match) => {
                // Remove the XML tags
                const text = match.replace(/<\/?a:t>/g, '');
                // Decode XML entities
                return decodeXmlEntities(text);
              })
              .filter((t) => t.trim())
              .join(' ');

            if (slideText.trim()) {
              const slideNum = slideFile.match(/slide(\d+)/)?.[1] || '?';
              textParts.push(`[Slide ${slideNum}]\n${slideText.trim()}`);
            }
          }
        }
      } catch (_slideError) {
        const slideNum = slideFile.match(/slide(\d+)/)?.[1] || '?';
        warnings.push(`Could not extract text from slide ${slideNum}`);
      }
    }

    // Also try to extract from notes if available
    const noteFiles = Object.keys(zip.files).filter((name) =>
      name.match(/ppt\/notesSlides\/notesSlide\d+\.xml$/)
    );

    if (noteFiles.length > 0) {
      const notesText: string[] = [];

      for (const noteFile of noteFiles) {
        try {
          const content = await zip.file(noteFile)?.async('text');
          if (content) {
            const textMatches = content.match(/<a:t>([^<]*)<\/a:t>/g);
            if (textMatches) {
              const noteText = textMatches
                .map((match) => decodeXmlEntities(match.replace(/<\/?a:t>/g, '')))
                .filter((t) => t.trim())
                .join(' ');
              if (noteText.trim()) {
                notesText.push(noteText.trim());
              }
            }
          }
        } catch {
          // Ignore errors in notes extraction
        }
      }

      if (notesText.length > 0) {
        textParts.push('\n[Speaker Notes]\n' + notesText.join('\n'));
      }
    }

    const text = textParts.join('\n\n').trim();

    if (!text || text.length === 0) {
      warnings.push('No text content extracted from PowerPoint. Slides may contain only images.');
    }

    const tokenCount = estimateTokens(text);

    if (tokenCount > SUPPLEMENTAL_LIMITS.MAX_TOKENS_PER_DOCUMENT) {
      warnings.push(
        `PowerPoint is very large (~${tokenCount.toLocaleString()} tokens). Consider using fewer slides.`
      );
    }

    return { text, tokenCount, warnings: warnings.length > 0 ? warnings : undefined };
  } catch (error) {
    if (error instanceof Error && error.message.includes('No slides found')) {
      throw error;
    }
    throw new Error(
      `Failed to parse PowerPoint: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Parse a plain text file.
 */
export async function parseTxt(file: File): Promise<ParseResult> {
  const warnings: string[] = [];

  try {
    const text = await file.text();

    if (!text || text.trim().length === 0) {
      warnings.push('Text file is empty');
    }

    const tokenCount = estimateTokens(text.trim());

    if (tokenCount > SUPPLEMENTAL_LIMITS.MAX_TOKENS_PER_DOCUMENT) {
      warnings.push(
        `Text file is very large (~${tokenCount.toLocaleString()} tokens). Consider using a shorter excerpt.`
      );
    }

    return { text: text.trim(), tokenCount, warnings: warnings.length > 0 ? warnings : undefined };
  } catch (error) {
    throw new Error(
      `Failed to read text file: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Parse pasted text content.
 * This is simple but included for consistency with the API.
 */
export function parsePastedText(text: string): ParseResult {
  const trimmedText = text.trim();
  const tokenCount = estimateTokens(trimmedText);
  const warnings: string[] = [];

  if (tokenCount > SUPPLEMENTAL_LIMITS.MAX_TOKENS_PER_DOCUMENT) {
    warnings.push(
      `Pasted text is very large (~${tokenCount.toLocaleString()} tokens). Consider using a shorter excerpt.`
    );
  }

  return {
    text: trimmedText,
    tokenCount,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

/**
 * Decode common XML entities.
 */
function decodeXmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, code) => String.fromCharCode(parseInt(code, 16)));
}

/**
 * Get a human-readable file type from MIME type or extension.
 */
export function getFileTypeDescription(file: File): string {
  const docType = getDocumentTypeFromExtension(file.name);
  switch (docType) {
    case 'docx':
      return 'Word Document';
    case 'pdf':
      return 'PDF';
    case 'pptx':
      return 'PowerPoint';
    case 'txt':
      return 'Text File';
    default:
      return 'Document';
  }
}

/**
 * Validate a file before parsing.
 * Returns null if valid, or an error message if invalid.
 */
export function validateFile(file: File): string | null {
  // Check file size
  if (file.size > SUPPLEMENTAL_LIMITS.MAX_FILE_SIZE_BYTES) {
    const maxMB = SUPPLEMENTAL_LIMITS.MAX_FILE_SIZE_BYTES / (1024 * 1024);
    const fileMB = (file.size / (1024 * 1024)).toFixed(1);
    return `File is too large (${fileMB}MB). Maximum size is ${maxMB}MB.`;
  }

  // Check file type
  const docType = getDocumentTypeFromExtension(file.name);
  if (!docType) {
    return `Unsupported file type. Supported formats: ${SUPPLEMENTAL_LIMITS.SUPPORTED_EXTENSIONS.join(', ')}`;
  }

  return null;
}

/**
 * Check if a file is a supported document type.
 */
export function isSupportedDocumentFile(file: File): boolean {
  return getDocumentTypeFromExtension(file.name) !== null;
}

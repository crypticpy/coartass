/**
 * Download Helper Utilities
 *
 * Provides utilities for creating blobs and triggering file downloads
 * in the browser with proper cleanup and error handling.
 */

/**
 * MIME type mappings for different export formats
 */
export const MIME_TYPES = {
  txt: 'text/plain;charset=utf-8',
  json: 'application/json;charset=utf-8',
  srt: 'text/plain;charset=utf-8',  // SRT files are plain text
  vtt: 'text/vtt;charset=utf-8',
  pdf: 'application/pdf',
} as const;

/**
 * Export format type
 */
export type ExportFormat = keyof typeof MIME_TYPES;

/**
 * Creates a Blob from content with the appropriate MIME type.
 *
 * @param content - String content to convert to blob
 * @param mimeType - MIME type for the blob
 * @returns Blob containing the content
 *
 * @example
 * const blob = createDownloadBlob('Hello World', 'text/plain;charset=utf-8');
 */
export function createDownloadBlob(content: string, mimeType: string): Blob {
  // Add BOM (Byte Order Mark) for UTF-8 encoding to ensure proper character display
  const bom = '\uFEFF';
  const blobContent = bom + content;

  return new Blob([blobContent], { type: mimeType });
}

/**
 * Generates a sanitized filename for export.
 *
 * @param originalFilename - Original file name
 * @param format - Export format extension
 * @param includeTimestamp - Whether to include timestamp in filename
 * @returns Sanitized filename with appropriate extension
 *
 * @example
 * generateFilename('meeting.mp3', 'txt', true)
 * // Returns: "meeting_2024-11-17_143045.txt"
 */
export function generateFilename(
  originalFilename: string,
  format: ExportFormat,
  includeTimestamp: boolean = true
): string {
  // Remove file extension from original filename
  const nameWithoutExt = originalFilename.replace(/\.[^/.]+$/, '');

  // Sanitize filename: replace spaces and special characters
  const sanitized = nameWithoutExt
    .replace(/[^a-zA-Z0-9-_]/g, '_')  // Replace special chars with underscore
    .replace(/_+/g, '_')              // Collapse multiple underscores
    .replace(/^_|_$/g, '');           // Remove leading/trailing underscores

  // Generate timestamp if requested
  let filename = sanitized;
  if (includeTimestamp) {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');

    const timestamp = `${year}-${month}-${day}_${hours}${minutes}${seconds}`;
    filename = `${sanitized}_${timestamp}`;
  }

  return `${filename}.${format}`;
}

/**
 * Triggers a file download in the browser.
 *
 * Creates a temporary anchor element, triggers a click, and cleans up
 * the object URL to prevent memory leaks.
 *
 * @param blob - Blob to download
 * @param filename - Suggested filename for the download
 * @throws Error if download cannot be triggered
 *
 * @example
 * const blob = new Blob(['content'], { type: 'text/plain' });
 * triggerDownload(blob, 'example.txt');
 */
export function triggerDownload(blob: Blob, filename: string): void {
  try {
    // Create object URL for the blob
    const url = URL.createObjectURL(blob);

    // Create temporary anchor element
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.style.display = 'none';

    // Append to body, click, and remove
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);

    // Clean up object URL after a short delay to ensure download started
    // We use setTimeout to avoid revoking the URL before the browser processes it
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 100);
  } catch (error) {
    // Clean up on error
    throw new Error(
      `Failed to trigger download: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Downloads content as a file with automatic blob creation and cleanup.
 *
 * This is a convenience function that combines blob creation and download triggering.
 *
 * @param content - String content to download
 * @param format - Export format (determines MIME type and extension)
 * @param originalFilename - Original filename to base the export filename on
 * @param includeTimestamp - Whether to include timestamp in filename (default: true)
 * @throws Error if download fails
 *
 * @example
 * downloadFile('Hello World', 'txt', 'meeting.mp3');
 * // Downloads file as: meeting_2024-11-17_143045.txt
 */
export function downloadFile(
  content: string,
  format: ExportFormat,
  originalFilename: string,
  includeTimestamp: boolean = true
): void {
  // Get appropriate MIME type
  const mimeType = MIME_TYPES[format];

  // Create blob
  const blob = createDownloadBlob(content, mimeType);

  // Generate filename
  const filename = generateFilename(originalFilename, format, includeTimestamp);

  // Trigger download
  triggerDownload(blob, filename);
}

/**
 * Checks if the browser supports the File Download API.
 *
 * @returns true if browser supports file downloads
 */
export function isBrowserCompatible(): boolean {
  try {
    // Check for required APIs
    return (
      typeof Blob !== 'undefined' &&
      typeof URL !== 'undefined' &&
      typeof URL.createObjectURL === 'function' &&
      typeof document !== 'undefined' &&
      typeof document.createElement === 'function'
    );
  } catch {
    return false;
  }
}

/**
 * Validates content before download.
 *
 * @param content - Content to validate
 * @throws Error if content is invalid
 */
export function validateContent(content: string): void {
  if (typeof content !== 'string') {
    throw new Error('Content must be a string');
  }

  if (content.length === 0) {
    throw new Error('Content cannot be empty');
  }

  // Check for reasonable size limit (100MB in characters)
  const maxSize = 100 * 1024 * 1024;
  if (content.length > maxSize) {
    throw new Error(`Content exceeds maximum size of ${maxSize} characters`);
  }
}

/**
 * Safe download wrapper with validation and error handling.
 *
 * @param content - Content to download
 * @param format - Export format
 * @param originalFilename - Original filename
 * @param includeTimestamp - Whether to include timestamp
 * @returns Success status and error message if failed
 */
export function safeDownload(
  content: string,
  format: ExportFormat,
  originalFilename: string,
  includeTimestamp: boolean = true
): { success: boolean; error?: string } {
  try {
    // Check browser compatibility
    if (!isBrowserCompatible()) {
      return {
        success: false,
        error: 'Your browser does not support file downloads. Please try a modern browser.',
      };
    }

    // Validate content
    validateContent(content);

    // Attempt download
    downloadFile(content, format, originalFilename, includeTimestamp);

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred during download',
    };
  }
}

/**
 * Input Sanitization Utilities
 *
 * Provides sanitization functions for user input, HTML content, URLs, and filenames.
 * These utilities help prevent XSS attacks and ensure data integrity.
 */

/**
 * HTML Entity Map for encoding special characters
 */
const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
};

/**
 * Reverse HTML Entity Map for decoding
 */
const HTML_ENTITIES_DECODE: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#x27;': "'",
  '&#x2F;': '/',
  '&#39;': "'",
};

/**
 * Sanitize HTML content by escaping special characters
 *
 * This prevents XSS attacks by converting HTML special characters to their
 * entity equivalents. Use this when displaying user-provided content.
 *
 * @param input - String that may contain HTML special characters
 * @returns Sanitized string with HTML entities escaped
 *
 * @example
 * ```typescript
 * const userInput = '<script>alert("XSS")</script>';
 * const safe = sanitizeHtml(userInput);
 * console.log(safe); // &lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;
 * ```
 */
export function sanitizeHtml(input: string): string {
  if (!input) return '';

  return input.replace(/[&<>"'/]/g, (char) => HTML_ENTITIES[char] || char);
}

/**
 * Decode HTML entities back to their original characters
 *
 * Use this when you need to convert sanitized HTML back to plain text,
 * for example when editing previously sanitized content.
 *
 * @param input - String with HTML entities
 * @returns String with entities decoded
 *
 * @example
 * ```typescript
 * const encoded = '&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;';
 * const decoded = decodeHtmlEntities(encoded);
 * console.log(decoded); // <script>alert("XSS")</script>
 * ```
 */
export function decodeHtmlEntities(input: string): string {
  if (!input) return '';

  return input.replace(/&[#\w]+;/g, (entity) => HTML_ENTITIES_DECODE[entity] || entity);
}

/**
 * Sanitize text for display by removing control characters and trimming
 *
 * This removes invisible control characters, normalizes whitespace,
 * and trims leading/trailing spaces.
 *
 * @param input - Text input to sanitize
 * @returns Sanitized text
 *
 * @example
 * ```typescript
 * const text = '  Hello\x00World\r\n  ';
 * const clean = sanitizeText(text);
 * console.log(clean); // 'Hello World'
 * ```
 */
export function sanitizeText(input: string): string {
  if (!input) return '';

  return input
    // Remove null bytes and other control characters (except common whitespace)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    // Normalize line breaks to spaces
    .replace(/[\r\n\t]+/g, ' ')
    // Collapse multiple spaces
    .replace(/\s+/g, ' ')
    // Trim
    .trim();
}

/**
 * Sanitize filename by removing or replacing dangerous characters
 *
 * Removes path separators, null bytes, and other characters that could
 * be used for directory traversal or file system attacks.
 *
 * @param filename - Original filename
 * @returns Sanitized filename safe for file system operations
 *
 * @example
 * ```typescript
 * const dangerous = '../../../etc/passwd';
 * const safe = sanitizeFilename(dangerous);
 * console.log(safe); // 'etc_passwd'
 *
 * const withSpaces = 'my audio file.mp3';
 * const normalized = sanitizeFilename(withSpaces);
 * console.log(normalized); // 'my_audio_file.mp3'
 * ```
 */
export function sanitizeFilename(filename: string): string {
  if (!filename) return 'unnamed';

  return filename
    // Remove null bytes
    .replace(/\x00/g, '')
    // Remove or replace path separators
    .replace(/[/\\]/g, '')
    // Remove other dangerous characters
    .replace(/[<>:"|?*]/g, '')
    // Replace spaces with underscores (optional, for cleaner URLs)
    .replace(/\s+/g, '_')
    // Remove leading/trailing dots and spaces
    .replace(/^[.\s]+|[.\s]+$/g, '')
    // Limit length
    .substring(0, 255)
    // Fallback if empty after sanitization
    || 'unnamed';
}

/**
 * Validate and sanitize URL
 *
 * Checks if a URL is valid and uses an allowed protocol (http/https).
 * Returns null if the URL is invalid or uses a disallowed protocol.
 *
 * @param url - URL string to validate
 * @param allowedProtocols - Allowed protocols (default: http, https)
 * @returns Sanitized URL or null if invalid
 *
 * @example
 * ```typescript
 * const url1 = sanitizeUrl('https://example.com/path');
 * console.log(url1); // 'https://example.com/path'
 *
 * const url2 = sanitizeUrl('javascript:alert("XSS")');
 * console.log(url2); // null
 *
 * const url3 = sanitizeUrl('blob:http://localhost/abc-123');
 * console.log(url3); // null (blob not in default allowed protocols)
 * ```
 */
export function sanitizeUrl(
  url: string,
  allowedProtocols: string[] = ['http:', 'https:']
): string | null {
  if (!url) return null;

  try {
    const parsed = new URL(url);

    // Check if protocol is allowed
    if (!allowedProtocols.includes(parsed.protocol)) {
      return null;
    }

    // Return the validated URL
    return parsed.href;
  } catch {
    // Invalid URL
    return null;
  }
}

/**
 * Sanitize object URL (blob: or data: URLs)
 *
 * Validates that the URL is a proper blob or data URL.
 * These are commonly used for local file previews.
 *
 * @param url - Object URL to validate
 * @returns Sanitized URL or null if invalid
 *
 * @example
 * ```typescript
 * const blobUrl = 'blob:http://localhost:3000/abc-123';
 * const valid = sanitizeObjectUrl(blobUrl);
 * console.log(valid); // 'blob:http://localhost:3000/abc-123'
 * ```
 */
export function sanitizeObjectUrl(url: string): string | null {
  if (!url) return null;

  try {
    const parsed = new URL(url);

    // Only allow blob: and data: protocols
    if (parsed.protocol !== 'blob:' && parsed.protocol !== 'data:') {
      return null;
    }

    return parsed.href;
  } catch {
    return null;
  }
}

/**
 * Sanitize JSON input by parsing and re-stringifying
 *
 * This ensures the JSON is valid and removes any functions or
 * potentially dangerous content.
 *
 * @param json - JSON string to sanitize
 * @returns Sanitized JSON string or null if invalid
 *
 * @example
 * ```typescript
 * const userJson = '{"name": "John", "age": 30}';
 * const sanitized = sanitizeJson(userJson);
 * console.log(sanitized); // '{"name":"John","age":30}'
 * ```
 */
export function sanitizeJson(json: string): string | null {
  try {
    const parsed = JSON.parse(json);
    return JSON.stringify(parsed);
  } catch {
    return null;
  }
}

/**
 * Strip HTML tags from a string, leaving only text content
 *
 * This is useful when you want to extract plain text from HTML,
 * such as for search indexing or previews.
 *
 * @param html - HTML string
 * @returns Plain text with HTML tags removed
 *
 * @example
 * ```typescript
 * const html = '<p>Hello <strong>world</strong>!</p>';
 * const text = stripHtmlTags(html);
 * console.log(text); // 'Hello world!'
 * ```
 */
export function stripHtmlTags(html: string): string {
  if (!html) return '';

  return html
    // Remove HTML tags
    .replace(/<[^>]*>/g, '')
    // Decode HTML entities
    .replace(/&[#\w]+;/g, (entity) => HTML_ENTITIES_DECODE[entity] || entity)
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Sanitize email address
 *
 * Validates and normalizes email addresses. Returns null if invalid.
 *
 * @param email - Email address to sanitize
 * @returns Sanitized email or null if invalid
 *
 * @example
 * ```typescript
 * const email1 = sanitizeEmail('  USER@EXAMPLE.COM  ');
 * console.log(email1); // 'user@example.com'
 *
 * const email2 = sanitizeEmail('invalid-email');
 * console.log(email2); // null
 * ```
 */
export function sanitizeEmail(email: string): string | null {
  if (!email) return null;

  const trimmed = email.trim().toLowerCase();

  // Basic email validation regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailRegex.test(trimmed)) {
    return null;
  }

  return trimmed;
}

/**
 * Sanitize speaker name or identifier
 *
 * Removes dangerous characters while preserving readable names.
 *
 * @param speaker - Speaker name or identifier
 * @returns Sanitized speaker name
 *
 * @example
 * ```typescript
 * const name = sanitizeSpeaker('  John <Doe>  ');
 * console.log(name); // 'John Doe'
 * ```
 */
export function sanitizeSpeaker(speaker: string): string {
  if (!speaker) return 'Unknown';

  return speaker
    // Remove HTML tags
    .replace(/<[^>]*>/g, '')
    // Remove control characters
    .replace(/[\x00-\x1F\x7F]/g, '')
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 100) // Limit length
    || 'Unknown';
}

/**
 * Sanitize numeric input
 *
 * Converts input to a number and validates it's within acceptable range.
 *
 * @param input - Input to convert to number
 * @param min - Minimum allowed value
 * @param max - Maximum allowed value
 * @returns Sanitized number or null if invalid
 *
 * @example
 * ```typescript
 * const num1 = sanitizeNumber('42', 0, 100);
 * console.log(num1); // 42
 *
 * const num2 = sanitizeNumber('999', 0, 100);
 * console.log(num2); // null (out of range)
 * ```
 */
export function sanitizeNumber(
  input: string | number,
  min: number = -Infinity,
  max: number = Infinity
): number | null {
  const num = typeof input === 'string' ? parseFloat(input) : input;

  if (isNaN(num) || !isFinite(num)) {
    return null;
  }

  if (num < min || num > max) {
    return null;
  }

  return num;
}

/**
 * Sanitize prompt text for AI models
 *
 * Removes excessive whitespace and control characters while preserving
 * formatting that's useful for prompts.
 *
 * @param prompt - Prompt text to sanitize
 * @returns Sanitized prompt
 *
 * @example
 * ```typescript
 * const prompt = sanitizePrompt(`
 *   Extract key points from the following:
 *
 *
 *   - Point 1
 *   - Point 2
 * `);
 * // Returns normalized version with single line breaks
 * ```
 */
export function sanitizePrompt(prompt: string): string {
  if (!prompt) return '';

  return prompt
    // Remove null bytes and other dangerous control characters
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    // Normalize line breaks
    .replace(/\r\n/g, '\n')
    // Remove excessive blank lines (more than 2 consecutive)
    .replace(/\n{3,}/g, '\n\n')
    // Trim
    .trim()
    // Limit length for safety
    .substring(0, 10000);
}

/**
 * Sanitize search query
 *
 * Prepares user search input for safe use in search operations.
 *
 * @param query - Search query to sanitize
 * @returns Sanitized query
 *
 * @example
 * ```typescript
 * const query = sanitizeSearchQuery('  hello  world  ');
 * console.log(query); // 'hello world'
 * ```
 */
export function sanitizeSearchQuery(query: string): string {
  if (!query) return '';

  return query
    // Remove control characters
    .replace(/[\x00-\x1F\x7F]/g, '')
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    .trim()
    // Limit length
    .substring(0, 200);
}

/**
 * Create a safe ID from a string
 *
 * Converts a string into a safe identifier suitable for use as
 * an HTML ID, CSS class, or database key.
 *
 * @param input - Input string
 * @returns Safe identifier
 *
 * @example
 * ```typescript
 * const id1 = createSafeId('Meeting Notes #1');
 * console.log(id1); // 'meeting-notes-1'
 *
 * const id2 = createSafeId('User@Email.com');
 * console.log(id2); // 'user-email-com'
 * ```
 */
export function createSafeId(input: string): string {
  if (!input) return 'id';

  return input
    .toLowerCase()
    // Remove special characters
    .replace(/[^a-z0-9\s-]/g, '')
    // Replace spaces with hyphens
    .replace(/\s+/g, '-')
    // Remove multiple consecutive hyphens
    .replace(/-+/g, '-')
    // Remove leading/trailing hyphens
    .replace(/^-+|-+$/g, '')
    // Limit length
    .substring(0, 100)
    || 'id';
}

/**
 * Sanitize and validate a timestamp
 *
 * Ensures a timestamp is a valid number in seconds and within reasonable bounds.
 *
 * @param timestamp - Timestamp in seconds
 * @param maxDuration - Maximum allowed duration (default: 4 hours)
 * @returns Sanitized timestamp or null if invalid
 *
 * @example
 * ```typescript
 * const ts1 = sanitizeTimestamp(123.45);
 * console.log(ts1); // 123.45
 *
 * const ts2 = sanitizeTimestamp(-5);
 * console.log(ts2); // null (negative)
 * ```
 */
export function sanitizeTimestamp(
  timestamp: number,
  maxDuration: number = 4 * 60 * 60 // 4 hours
): number | null {
  if (typeof timestamp !== 'number' || isNaN(timestamp) || !isFinite(timestamp)) {
    return null;
  }

  if (timestamp < 0 || timestamp > maxDuration) {
    return null;
  }

  return timestamp;
}

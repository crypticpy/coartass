/**
 * Retry Utilities
 *
 * Shared retry logic with exponential backoff for network resilience.
 * Used by both client-side hooks and can be extended for server-side use.
 */

/**
 * Known user cancellation error messages.
 * These should never be retried as they represent intentional user actions.
 */
const USER_CANCELLATION_PATTERNS = [
  'transcription cancelled',
  'the user aborted a request',
  'user cancelled',
  'request was cancelled',
  'operation was aborted',
  'aborted by user',
];

/**
 * Check if an error represents a user-initiated cancellation.
 * These errors should NOT be retried.
 *
 * @param error - Error to check
 * @returns True if this is a user cancellation
 */
export function isUserCancellation(error: unknown): boolean {
  const message =
    error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

  return USER_CANCELLATION_PATTERNS.some(pattern => message.includes(pattern));
}

/**
 * Check if an error is retryable (transient network/server issues).
 *
 * Retryable errors include:
 * - Network errors (connection issues, DNS failures)
 * - Timeout errors
 * - Server errors (502, 503, 504)
 *
 * Non-retryable errors include:
 * - User cancellations
 * - Client errors (400, 401, 403, 404)
 * - Validation errors
 *
 * @param error - Error to check
 * @returns True if the error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  // User cancellations are never retryable
  if (isUserCancellation(error)) {
    return false;
  }

  const message =
    error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

  // Check for retryable error patterns
  return (
    message.includes('network') ||
    message.includes('timeout') ||
    message.includes('timed out') ||
    message.includes('econnreset') ||
    message.includes('econnrefused') ||
    message.includes('etimedout') ||
    message.includes('503') ||
    message.includes('502') ||
    message.includes('504')
  );
}

/**
 * Options for retry behavior
 */
export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;
  /** Base delay in ms between retries (default: 2000) */
  baseDelay?: number;
  /** Optional callback when a retry is about to happen */
  onRetry?: (attempt: number, error: Error, delay: number) => void;
}

/**
 * Retry wrapper with exponential backoff for network resilience.
 *
 * Automatically retries failed operations for transient network errors,
 * timeouts, and server errors (502, 503, 504). Non-retryable errors
 * (validation, auth, user cancellation) are thrown immediately.
 *
 * @param fn - Async function to retry
 * @param options - Retry configuration options
 * @returns Result of the function or throws the last error
 *
 * @example
 * ```typescript
 * import { withRetry } from '@/lib/retry';
 *
 * const result = await withRetry(
 *   () => fetch('/api/transcribe'),
 *   { maxRetries: 3, baseDelay: 2000 }
 * );
 * ```
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const { maxRetries = 3, baseDelay = 2000, onRetry } = options;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry non-retryable errors or on last attempt
      if (!isRetryableError(lastError) || attempt === maxRetries - 1) {
        throw lastError;
      }

      // Exponential backoff: 2s, 4s, 8s
      const delay = baseDelay * Math.pow(2, attempt);
      onRetry?.(attempt + 1, lastError, delay);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

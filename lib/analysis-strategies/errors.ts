/**
 * Analysis Strategy Error Types
 *
 * Provides a comprehensive error hierarchy for the analysis strategy system.
 * Each error type includes:
 * - Descriptive message
 * - Error code for programmatic handling
 * - Metadata (strategy, section name, partial results if any)
 * - `isRetryable` property for automatic retry decisions
 */

import type { AnalysisResults } from '@/types';
import type { AnalysisStrategy } from '@/lib/analysis-strategy';

/**
 * Error codes for programmatic handling.
 * Grouped by category for easier switch/case handling.
 */
export enum AnalysisErrorCode {
  // Network and API errors (1xx)
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT = 'TIMEOUT',
  RATE_LIMITED = 'RATE_LIMITED',
  API_ERROR = 'API_ERROR',

  // Content errors (2xx)
  CONTENT_FILTER = 'CONTENT_FILTER',
  RESPONSE_TRUNCATED = 'RESPONSE_TRUNCATED',
  EMPTY_RESPONSE = 'EMPTY_RESPONSE',
  INVALID_JSON = 'INVALID_JSON',
  INVALID_STRUCTURE = 'INVALID_STRUCTURE',

  // Strategy errors (3xx)
  STRATEGY_FAILED = 'STRATEGY_FAILED',
  ALL_STRATEGIES_FAILED = 'ALL_STRATEGIES_FAILED',
  CIRCULAR_DEPENDENCY = 'CIRCULAR_DEPENDENCY',
  INVALID_TEMPLATE = 'INVALID_TEMPLATE',

  // Section processing errors (4xx)
  SECTION_FAILED = 'SECTION_FAILED',
  SECTION_TIMEOUT = 'SECTION_TIMEOUT',
  BATCH_FAILED = 'BATCH_FAILED',

  // Partial completion (5xx)
  PARTIAL_RESULTS = 'PARTIAL_RESULTS',
  EVALUATION_FAILED = 'EVALUATION_FAILED',

  // Unknown (9xx)
  UNKNOWN = 'UNKNOWN',
}

/**
 * Metadata attached to analysis errors for debugging and recovery.
 */
export interface AnalysisErrorMetadata {
  /** The strategy that was being executed when the error occurred */
  strategy?: AnalysisStrategy;

  /** Name of the section being processed (if applicable) */
  sectionName?: string;

  /** Index of the section being processed (if applicable) */
  sectionIndex?: number;

  /** Total number of sections in the template */
  totalSections?: number;

  /** Batch name for hybrid strategy (if applicable) */
  batchName?: string;

  /** Partial results that were successfully extracted before failure */
  partialResults?: Partial<AnalysisResults>;

  /** Number of sections that completed successfully */
  completedSections?: number;

  /** Names of sections that failed */
  failedSections?: string[];

  /** Original error that caused this failure */
  cause?: Error;

  /** Number of retry attempts made */
  retryAttempts?: number;

  /** Time elapsed before failure (in milliseconds) */
  elapsedMs?: number;

  /** HTTP status code (if from API response) */
  httpStatus?: number;

  /** Additional context for debugging */
  context?: Record<string, unknown>;
}

/**
 * Base class for all analysis-related errors.
 *
 * Provides structured error information including:
 * - Error code for programmatic handling
 * - Metadata for debugging and recovery
 * - Retryable flag for automatic retry decisions
 */
export class AnalysisError extends Error {
  /** Error code for programmatic handling */
  readonly code: AnalysisErrorCode;

  /** Metadata for debugging and recovery */
  readonly metadata: AnalysisErrorMetadata;

  /** Whether this error can potentially be recovered by retrying */
  readonly isRetryable: boolean;

  /** Timestamp when the error occurred */
  readonly timestamp: Date;

  constructor(
    message: string,
    code: AnalysisErrorCode = AnalysisErrorCode.UNKNOWN,
    metadata: AnalysisErrorMetadata = {},
    isRetryable = false
  ) {
    super(message);
    this.name = 'AnalysisError';
    this.code = code;
    this.metadata = metadata;
    this.isRetryable = isRetryable;
    this.timestamp = new Date();

    // Maintain proper stack trace in V8 environments (Node.js, Chrome)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Create a human-readable summary of the error.
   */
  toSummary(): string {
    const parts = [
      `[${this.code}] ${this.message}`,
    ];

    if (this.metadata.strategy) {
      parts.push(`Strategy: ${this.metadata.strategy}`);
    }

    if (this.metadata.sectionName) {
      parts.push(`Section: ${this.metadata.sectionName}`);
    }

    if (this.metadata.completedSections !== undefined && this.metadata.totalSections !== undefined) {
      parts.push(`Progress: ${this.metadata.completedSections}/${this.metadata.totalSections} sections`);
    }

    if (this.isRetryable) {
      parts.push('(retryable)');
    }

    return parts.join(' | ');
  }

  /**
   * Serialize the error for logging or transmission.
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      isRetryable: this.isRetryable,
      timestamp: this.timestamp.toISOString(),
      metadata: {
        ...this.metadata,
        // Exclude cause from serialization to avoid circular references
        cause: this.metadata.cause?.message,
      },
    };
  }
}

/**
 * Error thrown when a specific analysis strategy fails.
 *
 * Use this when a single strategy (basic, hybrid, or advanced) fails
 * and you want to potentially fall back to a different strategy.
 */
export class StrategyError extends AnalysisError {
  constructor(
    strategy: AnalysisStrategy,
    message: string,
    code: AnalysisErrorCode = AnalysisErrorCode.STRATEGY_FAILED,
    metadata: Omit<AnalysisErrorMetadata, 'strategy'> = {},
    isRetryable = true
  ) {
    super(
      `Strategy '${strategy}' failed: ${message}`,
      code,
      { ...metadata, strategy },
      isRetryable
    );
    this.name = 'StrategyError';
  }
}

/**
 * Error thrown when processing an individual section fails.
 *
 * Used in advanced strategy where sections are processed one at a time.
 * Includes partial results from successfully processed sections.
 */
export class SectionProcessingError extends AnalysisError {
  constructor(
    sectionName: string,
    sectionIndex: number,
    totalSections: number,
    message: string,
    code: AnalysisErrorCode = AnalysisErrorCode.SECTION_FAILED,
    metadata: Omit<AnalysisErrorMetadata, 'sectionName' | 'sectionIndex' | 'totalSections'> = {},
    isRetryable = true
  ) {
    super(
      `Section '${sectionName}' (${sectionIndex + 1}/${totalSections}) failed: ${message}`,
      code,
      { ...metadata, sectionName, sectionIndex, totalSections },
      isRetryable
    );
    this.name = 'SectionProcessingError';
  }
}

/**
 * Error indicating analysis partially completed with some results.
 *
 * This is a recoverable error that includes whatever results were
 * successfully extracted before the failure occurred.
 */
export class PartialResultsError extends AnalysisError {
  /** The partial results that were successfully extracted */
  readonly partialResults: Partial<AnalysisResults>;

  /** Whether the partial results should be considered usable */
  readonly resultsUsable: boolean;

  constructor(
    message: string,
    partialResults: Partial<AnalysisResults>,
    metadata: Omit<AnalysisErrorMetadata, 'partialResults'> = {},
    resultsUsable = true
  ) {
    super(
      message,
      AnalysisErrorCode.PARTIAL_RESULTS,
      { ...metadata, partialResults },
      false // Partial results are the recovery, not a retry
    );
    this.name = 'PartialResultsError';
    this.partialResults = partialResults;
    this.resultsUsable = resultsUsable;
  }

  /**
   * Get the number of successfully completed sections.
   */
  get completedSectionCount(): number {
    return this.partialResults.sections?.length ?? 0;
  }

  /**
   * Check if enough results were extracted to be useful.
   * Considers analysis usable if at least 50% of expected sections completed.
   */
  hasMinimumViableResults(expectedSections: number): boolean {
    const completed = this.completedSectionCount;
    return completed >= Math.ceil(expectedSections * 0.5);
  }
}

/**
 * Error thrown when an operation times out.
 *
 * Includes information about what partial results were available
 * at the time of timeout.
 */
export class TimeoutError extends AnalysisError {
  /** How long we waited before timing out (in milliseconds) */
  readonly timeoutMs: number;

  constructor(
    operation: string,
    timeoutMs: number,
    metadata: AnalysisErrorMetadata = {}
  ) {
    super(
      `Operation '${operation}' timed out after ${timeoutMs}ms`,
      AnalysisErrorCode.TIMEOUT,
      { ...metadata, elapsedMs: timeoutMs },
      true // Timeouts are typically retryable with longer timeout
    );
    this.name = 'TimeoutError';
    this.timeoutMs = timeoutMs;
  }
}

/**
 * Error thrown when hitting API rate limits.
 *
 * Includes retry-after information when available.
 */
export class RateLimitError extends AnalysisError {
  /** Suggested wait time before retrying (in milliseconds) */
  readonly retryAfterMs?: number;

  constructor(
    message: string,
    retryAfterMs?: number,
    metadata: AnalysisErrorMetadata = {}
  ) {
    super(
      message,
      AnalysisErrorCode.RATE_LIMITED,
      metadata,
      true // Rate limits are always retryable after waiting
    );
    this.name = 'RateLimitError';
    this.retryAfterMs = retryAfterMs;
  }

  /**
   * Get the recommended delay before retrying.
   * Returns the retry-after value if available, otherwise a default.
   */
  getRecommendedDelay(defaultMs = 10000): number {
    return this.retryAfterMs ?? defaultMs;
  }
}

/**
 * Error thrown when content filter blocks the request.
 *
 * Usually a false positive that resolves on retry.
 */
export class ContentFilterError extends AnalysisError {
  constructor(
    message: string = 'Content filter triggered',
    metadata: AnalysisErrorMetadata = {}
  ) {
    super(
      message,
      AnalysisErrorCode.CONTENT_FILTER,
      metadata,
      true // Content filter is typically a false positive, so retryable
    );
    this.name = 'ContentFilterError';
  }
}

/**
 * Error thrown when response is truncated due to token limits.
 */
export class ResponseTruncatedError extends AnalysisError {
  constructor(
    message: string = 'Response truncated due to token limit',
    metadata: AnalysisErrorMetadata = {}
  ) {
    super(
      message,
      AnalysisErrorCode.RESPONSE_TRUNCATED,
      metadata,
      false // Truncation won't be fixed by retrying with same input
    );
    this.name = 'ResponseTruncatedError';
  }
}

/**
 * Error thrown when JSON parsing fails.
 */
export class InvalidJsonError extends AnalysisError {
  /** Preview of the content that failed to parse */
  readonly contentPreview: string;

  constructor(
    contentPreview: string,
    metadata: AnalysisErrorMetadata = {}
  ) {
    super(
      'Failed to parse JSON response from API',
      AnalysisErrorCode.INVALID_JSON,
      metadata,
      true // JSON parsing failures may succeed on retry
    );
    this.name = 'InvalidJsonError';
    this.contentPreview = contentPreview.substring(0, 500);
  }
}

/**
 * Error thrown when response structure doesn't match expected schema.
 */
export class InvalidStructureError extends AnalysisError {
  constructor(
    expectedType: string,
    metadata: AnalysisErrorMetadata = {}
  ) {
    super(
      `Response does not match expected ${expectedType} structure`,
      AnalysisErrorCode.INVALID_STRUCTURE,
      metadata,
      true // Structure errors may succeed on retry
    );
    this.name = 'InvalidStructureError';
  }
}

/**
 * Error thrown when all strategy fallbacks have been exhausted.
 */
export class AllStrategiesFailedError extends AnalysisError {
  /** Array of errors from each attempted strategy */
  readonly strategyErrors: Array<{ strategy: AnalysisStrategy; error: Error }>;

  constructor(
    strategyErrors: Array<{ strategy: AnalysisStrategy; error: Error }>,
    partialResults?: Partial<AnalysisResults>
  ) {
    const strategies = strategyErrors.map(e => e.strategy).join(' -> ');
    super(
      `All analysis strategies failed: ${strategies}`,
      AnalysisErrorCode.ALL_STRATEGIES_FAILED,
      { partialResults },
      false // All fallbacks exhausted, no point retrying
    );
    this.name = 'AllStrategiesFailedError';
    this.strategyErrors = strategyErrors;
  }

  /**
   * Get the last (most simplified) strategy's error.
   */
  getLastError(): Error | undefined {
    return this.strategyErrors[this.strategyErrors.length - 1]?.error;
  }

  /**
   * Check if any strategy produced partial results.
   */
  hasPartialResults(): boolean {
    return this.metadata.partialResults !== undefined &&
      (this.metadata.partialResults.sections?.length ?? 0) > 0;
  }
}

/**
 * Type guard to check if an error is an AnalysisError.
 */
export function isAnalysisError(error: unknown): error is AnalysisError {
  return error instanceof AnalysisError;
}

/**
 * Type guard to check if an error indicates partial results are available.
 */
export function hasPartialResults(
  error: unknown
): error is PartialResultsError | AllStrategiesFailedError {
  if (error instanceof PartialResultsError) {
    return true;
  }
  if (error instanceof AllStrategiesFailedError) {
    return error.hasPartialResults();
  }
  return false;
}

/**
 * Determine if an error should trigger a retry.
 */
export function shouldRetry(error: unknown): boolean {
  if (isAnalysisError(error)) {
    return error.isRetryable;
  }

  // Check for common transient error indicators in unknown errors
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    const transientIndicators = [
      'network',
      'timeout',
      'econnreset',
      'econnrefused',
      'socket hang up',
      'etimedout',
      'rate limit',
      '429',
      '503',
      '502',
      'retry',
    ];
    return transientIndicators.some(indicator => message.includes(indicator));
  }

  return false;
}

/**
 * Extract error code from any error.
 */
export function getErrorCode(error: unknown): AnalysisErrorCode {
  if (isAnalysisError(error)) {
    return error.code;
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    if (message.includes('rate limit') || message.includes('429')) {
      return AnalysisErrorCode.RATE_LIMITED;
    }
    if (message.includes('timeout') || message.includes('etimedout')) {
      return AnalysisErrorCode.TIMEOUT;
    }
    if (message.includes('network') || message.includes('econnreset')) {
      return AnalysisErrorCode.NETWORK_ERROR;
    }
    if (message.includes('content_filter')) {
      return AnalysisErrorCode.CONTENT_FILTER;
    }
    if (message.includes('json')) {
      return AnalysisErrorCode.INVALID_JSON;
    }
  }

  return AnalysisErrorCode.UNKNOWN;
}

/**
 * Wrap an unknown error in an AnalysisError for consistent handling.
 */
export function wrapError(
  error: unknown,
  metadata: AnalysisErrorMetadata = {}
): AnalysisError {
  if (isAnalysisError(error)) {
    // Merge metadata if needed
    if (Object.keys(metadata).length > 0) {
      return new AnalysisError(
        error.message,
        error.code,
        { ...error.metadata, ...metadata },
        error.isRetryable
      );
    }
    return error;
  }

  const cause = error instanceof Error ? error : new Error(String(error));
  const code = getErrorCode(cause);
  const isRetryable = shouldRetry(cause);

  return new AnalysisError(
    cause.message,
    code,
    { ...metadata, cause },
    isRetryable
  );
}

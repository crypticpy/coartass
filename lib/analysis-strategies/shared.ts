/**
 * Shared Analysis Strategy Utilities
 *
 * Common functions and types used across all analysis strategies.
 * Includes validation, formatting, retry logic, and utility helpers.
 */

import type { AnalysisResults, OutputFormat, TranscriptSegment } from "@/types";
import type { AnalysisStrategy } from "@/lib/analysis-strategy";
import type { Template } from "@/types/template";
import type { TranscriptAnnotation } from "@/types/annotation";
import { estimateTokens } from "@/lib/token-utils";
import { buildChatCompletionParams } from "@/lib/openai-chat-params";
import {
  AnalysisError,
  AnalysisErrorCode,
  TimeoutError,
  RateLimitError,
  wrapError,
  shouldRetry,
  type AnalysisErrorMetadata,
} from "./errors";

/**
 * Format seconds to MM:SS or HH:MM:SS string
 */
function formatTimestampMarker(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}

/**
 * Format transcript text with timestamp markers for LLM context
 *
 * Adds [MM:SS] markers at the start of each segment so the LLM can
 * accurately reference timestamps when extracting action items, decisions, etc.
 *
 * @param segments - Transcript segments with timing information
 * @returns Formatted transcript string with timestamp markers
 *
 * @example
 * // Input segments:
 * // [{ start: 0, text: "Hello everyone" }, { start: 15, text: "Let's start" }]
 * // Output:
 * // "[0:00] Hello everyone\n[0:15] Let's start"
 */
export function formatTranscriptWithTimestamps(
  segments: TranscriptSegment[],
): string {
  return segments
    .map((seg) => {
      const timestamp = formatTimestampMarker(seg.start);
      const speaker = seg.speaker ? `${seg.speaker}: ` : "";
      return `[${timestamp}] ${speaker}${seg.text}`;
    })
    .join("\n");
}

/**
 * Format trainer annotations for inclusion in analysis prompts.
 *
 * Annotations are timestamp-based notes from training officers observing
 * face-to-face interactions or other events not captured in the audio.
 * They should be considered alongside the transcript for context.
 *
 * @param annotations - Array of annotations to format
 * @returns Formatted string for prompt inclusion, or undefined if empty
 *
 * @example
 * // Input annotations:
 * // [{ timestamp: 330, text: "BC and section chief discussed staging" }]
 * // Output:
 * // "[5:30] BC and section chief discussed staging"
 */
export function formatAnnotationsForPrompt(
  annotations: TranscriptAnnotation[] | undefined,
): string | undefined {
  if (!annotations || annotations.length === 0) {
    return undefined;
  }

  // Sort by timestamp
  const sorted = [...annotations].sort((a, b) => a.timestamp - b.timestamp);

  const lines = sorted.map((ann) => {
    const timestamp = formatTimestampMarker(ann.timestamp);
    return `[${timestamp}] ${ann.text}`;
  });

  return lines.join("\n");
}

/**
 * Build the trainer annotations section for analysis prompts.
 *
 * @param annotations - Array of annotations
 * @returns Formatted prompt section or empty string if no annotations
 */
export function buildAnnotationsPromptSection(
  annotations: TranscriptAnnotation[] | undefined,
): string {
  const formatted = formatAnnotationsForPrompt(annotations);
  if (!formatted) {
    return "";
  }

  return `## Trainer Annotations

These are timestamped notes from the training officer during video review.
The trainer observed face-to-face interactions or events not captured in the radio audio.
Consider this context when evaluating the relevant moments in the transcript.
NOTE: Annotations HAVE timestamps that correspond to the transcript timeline.

${formatted}

---

`;
}

/**
 * Instruction text to add to prompts explaining timestamp format
 */
export const TIMESTAMP_INSTRUCTION = `
## TIMESTAMP EXTRACTION (CRITICAL)

The transcript has [MM:SS] or [H:MM:SS] markers at the START of EVERY segment.
You MUST extract accurate timestamps for ALL action items, decisions, and quotes.

### How to Extract Timestamps:
1. Find the [MM:SS] marker at the beginning of the line containing the content
2. Convert to total seconds using this formula: (minutes × 60) + seconds

### Conversion Examples:
- [0:15] → 15 seconds (0 × 60 + 15)
- [1:30] → 90 seconds (1 × 60 + 30)
- [5:00] → 300 seconds (5 × 60 + 0)
- [12:45] → 765 seconds (12 × 60 + 45)
- [1:05:30] → 3930 seconds (1 × 3600 + 5 × 60 + 30)

### Rules:
- NEVER use timestamp: 0 unless the content is actually at [0:00]
- If the exact line doesn't have a marker, use the NEAREST PRECEDING marker
- Every extracted item MUST have a non-zero timestamp (unless truly at [0:00])
`;

/**
 * Constants for analysis configuration
 */
export const ANALYSIS_CONSTANTS = {
  MAX_BULLET_POINTS: 10,
  MAX_BULLET_WORDS: 15,
  MAX_PARAGRAPH_WORDS: 200,
  MAX_INPUT_TOKENS_WARNING: 200000, // Leave buffer for response
  BASIC_TEMPERATURE: 0.3,
  HYBRID_TEMPERATURE: 0.3,
  ADVANCED_TEMPERATURE: 0.2,
  EVALUATION_TEMPERATURE: 0.3, // Slightly higher than advanced for improvement creativity
  // Keep this high for capable deployments, but we cap per-deployment below to avoid slow responses/timeouts.
  MAX_COMPLETION_TOKENS: 32000,
  /** Per-section timeout for Advanced mode (45 seconds) - prevents hung API calls */
  ADVANCED_SECTION_TIMEOUT_MS: 45000,
  /** Overall analysis timeout to prevent 504 errors (210 seconds - leaves buffer before 240s gateway timeout) */
  ANALYSIS_OVERALL_TIMEOUT_MS: 210000,
} as const;

/**
 * Conservative default output-token caps by deployment name.
 *
 * Azure deployment names are user-defined, but in this repo we typically name
 * them after the model (e.g. "gpt-5", "gpt-41", "gpt-4o"). When names don't
 * match this convention, the fallback is intentionally conservative to avoid
 * hard failures from exceeding model output limits.
 */
export function getDefaultMaxOutputTokens(deployment: string): number {
  const name = deployment.toLowerCase();

  // GPT-5 / reasoning-style deployments: allow large outputs.
  if (name.includes("gpt-5") || name.includes("o1") || name.includes("o3")) {
    // Default: cap to 8k to reduce latency and avoid gateway timeouts in ACA.
    // Can be overridden via ANALYSIS_MAX_OUTPUT_TOKENS / AZURE_OPENAI_MAX_OUTPUT_TOKENS.
    return 8192;
  }

  // GPT-4.1 / "gpt-41" extended-context deployments: allow medium-large outputs.
  if (
    name.includes("gpt-41") ||
    name.includes("gpt-4.1") ||
    name.includes("4.1")
  ) {
    return 16000;
  }

  // Default: keep small enough to be broadly compatible (e.g. gpt-4o).
  return 4096;
}

/**
 * Module-level reasoning effort override.
 * Set via setAnalysisReasoningEffort() before analysis execution.
 */
let reasoningEffortOverride: "low" | "medium" | "high" | null = null;

/**
 * Set the reasoning effort for the current analysis run.
 * This overrides the server-side environment variable.
 */
export function setAnalysisReasoningEffort(
  effort: "low" | "medium" | "high" | null,
): void {
  reasoningEffortOverride = effort;
}

/**
 * Get the current reasoning effort (user override or env var).
 */
export function getAnalysisReasoningEffort(): "low" | "medium" | "high" {
  if (reasoningEffortOverride) {
    return reasoningEffortOverride;
  }

  const envEffortRaw =
    process.env.AZURE_OPENAI_REASONING_EFFORT ||
    process.env.OPENAI_REASONING_EFFORT ||
    process.env.NEXT_PUBLIC_REASONING_EFFORT;

  return envEffortRaw === "low" ||
    envEffortRaw === "high" ||
    envEffortRaw === "medium"
    ? envEffortRaw
    : "medium";
}

export function buildAnalysisChatCompletionParams(
  deployment: string,
  temperature?: number,
): ReturnType<typeof buildChatCompletionParams> {
  const reasoningEffort = getAnalysisReasoningEffort();

  const envMaxRaw =
    process.env.ANALYSIS_MAX_OUTPUT_TOKENS ||
    process.env.AZURE_OPENAI_MAX_OUTPUT_TOKENS ||
    process.env.NEXT_PUBLIC_ANALYSIS_MAX_OUTPUT_TOKENS;

  const parsedMax = envMaxRaw ? Number.parseInt(envMaxRaw, 10) : NaN;
  const configuredMax = Number.isFinite(parsedMax)
    ? Math.max(256, Math.min(parsedMax, 32000))
    : null;

  return buildChatCompletionParams(
    deployment,
    configuredMax ?? getDefaultMaxOutputTokens(deployment),
    temperature,
    reasoningEffort,
  );
}

/**
 * Format output type description for prompts
 */
export function formatOutputType(format: OutputFormat): string {
  switch (format) {
    case "bullet_points":
      return `Bulleted list (MUST use "-" character ONLY, NOT numbered lists 1,2,3 or other bullets •,*,+, max ${ANALYSIS_CONSTANTS.MAX_BULLET_POINTS} items, ${ANALYSIS_CONSTANTS.MAX_BULLET_WORDS} words each)`;
    case "paragraph":
      return `Paragraph format (continuous prose, 100-${ANALYSIS_CONSTANTS.MAX_PARAGRAPH_WORDS} words)`;
    case "table":
      return "Table format (use markdown table syntax if needed, or structured bullets)";
  }
}

/**
 * Validation result structure
 */
export interface ValidationResult {
  valid: boolean;
  warnings: string[];
  errors: string[];
}

/**
 * Validate that all relationship IDs reference existing entities
 *
 * Ensures data integrity by checking that all cross-references
 * between entities (agenda items, decisions, action items) are valid.
 *
 * @param results - Analysis results to validate
 * @returns Validation result with warnings and errors
 */
export function validateRelationshipIds(
  results: AnalysisResults,
): ValidationResult {
  const warnings: string[] = [];
  const errors: string[] = [];

  const agendaIds = new Set(results.agendaItems?.map((a) => a.id) || []);
  const decisionIds = new Set(results.decisions?.map((d) => d.id) || []);

  // Validate decision -> agenda links
  results.decisions?.forEach((decision) => {
    decision.agendaItemIds?.forEach((id) => {
      if (!agendaIds.has(id)) {
        warnings.push(
          `Decision "${decision.id}" references non-existent agenda item "${id}"`,
        );
      }
    });
  });

  // Validate action -> agenda and action -> decision links
  results.actionItems?.forEach((action) => {
    action.agendaItemIds?.forEach((id) => {
      if (!agendaIds.has(id)) {
        warnings.push(
          `Action "${action.id}" references non-existent agenda item "${id}"`,
        );
      }
    });
    action.decisionIds?.forEach((id) => {
      if (!decisionIds.has(id)) {
        warnings.push(
          `Action "${action.id}" references non-existent decision "${id}"`,
        );
      }
    });
  });

  return {
    valid: warnings.length === 0 && errors.length === 0,
    warnings,
    errors,
  };
}

/**
 * Ensure unique IDs within entity collections
 *
 * Detects and fixes duplicate IDs by reassigning them sequentially.
 * Logs warnings when duplicates are found.
 *
 * @param items - Array of items with id property
 * @param prefix - ID prefix for regenerated IDs
 * @returns Array with guaranteed unique IDs
 */
export function ensureUniqueIds<T extends { id: string }>(
  items: T[] | undefined,
  prefix: string,
): T[] | undefined {
  if (!items || items.length === 0) return items;

  const seen = new Set<string>();
  let counter = 1;

  return items.map((item) => {
    if (seen.has(item.id)) {
      // Duplicate detected - assign new ID
      let newId: string;
      do {
        newId = `${prefix}-${counter++}`;
      } while (seen.has(newId)); // Ensure the new ID is also unique

      console.warn(
        `[ID Deduplication] Duplicate ID "${item.id}" changed to "${newId}"`,
      );
      seen.add(newId);
      return { ...item, id: newId };
    }
    seen.add(item.id);
    return item;
  });
}

/**
 * Validate token limits before making API calls
 *
 * Checks if transcript + prompt will exceed safe token limits
 * and returns warnings if approaching capacity.
 *
 * @param transcript - Full transcript text
 * @param prompt - Generated prompt text
 * @param strategyName - Name of strategy (for logging)
 * @returns Validation result
 */
export function validateTokenLimits(
  transcript: string,
  prompt: string,
  strategyName: string,
): ValidationResult {
  const warnings: string[] = [];
  const errors: string[] = [];

  const transcriptTokens = estimateTokens(transcript);
  const promptTokens = estimateTokens(prompt);
  const totalInputTokens = transcriptTokens + promptTokens;

  if (totalInputTokens > ANALYSIS_CONSTANTS.MAX_INPUT_TOKENS_WARNING) {
    warnings.push(
      `[${strategyName}] Input tokens (${totalInputTokens.toLocaleString()}) ` +
        "approaching context limit. Consider using a different strategy.",
    );
  }

  // Error if definitely over limit (256K for standard, 1M for extended)
  if (totalInputTokens > 250000) {
    errors.push(
      `[${strategyName}] Input tokens (${totalInputTokens.toLocaleString()}) ` +
        "exceed safe context limit (250K). Analysis will likely fail.",
    );
  }

  return {
    valid: errors.length === 0,
    warnings,
    errors,
  };
}

/**
 * Configuration for retry behavior.
 */
export interface RetryConfig {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;

  /** Base delay in milliseconds (default: 1000) */
  baseDelay?: number;

  /** Maximum delay in milliseconds (default: 30000) */
  maxDelay?: number;

  /** Timeout for each attempt in milliseconds (default: 120000) */
  timeoutMs?: number;

  /** Jitter factor (0-1) to add randomness to delays (default: 0.1) */
  jitter?: number;

  /** Strategy name for logging context */
  strategyName?: string;

  /** Section name for logging context */
  sectionName?: string;

  /** Callback invoked on each retry */
  onRetry?: (attempt: number, error: Error, delayMs: number) => void;
}

/**
 * Result from retry operation with metadata.
 */
export interface RetryResult<T> {
  /** The successful result */
  result: T;

  /** Number of attempts made (1 = success on first try) */
  attempts: number;

  /** Total time elapsed across all attempts in milliseconds */
  totalElapsedMs: number;

  /** Whether any retries occurred */
  hadRetries: boolean;
}

/**
 * Enhanced retry function with exponential backoff.
 *
 * Features:
 * - Configurable retry behavior
 * - Per-attempt timeout support
 * - Jitter to avoid thundering herd
 * - Structured error handling with typed errors
 * - Retry metadata in result
 *
 * @param fn - Async function to retry
 * @param config - Retry configuration
 * @returns Result with retry metadata
 *
 * @example
 * ```typescript
 * const { result, attempts } = await retryWithBackoff(
 *   () => openaiClient.chat.completions.create({ ... }),
 *   { maxRetries: 3, timeoutMs: 60000, strategyName: 'advanced' }
 * );
 * ```
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  config: RetryConfig | number = {},
  legacyBaseDelay?: number,
): Promise<T> {
  // Handle legacy signature: retryWithBackoff(fn, maxRetries, baseDelay)
  const normalizedConfig: RetryConfig =
    typeof config === "number"
      ? { maxRetries: config, baseDelay: legacyBaseDelay }
      : config;

  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 30000,
    timeoutMs,
    jitter = 0.1,
    strategyName,
    sectionName,
    onRetry,
  } = normalizedConfig;

  const startTime = Date.now();
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Wrap with timeout if configured
      const result = timeoutMs
        ? await withTimeout(fn, timeoutMs, `Attempt ${attempt}`)
        : await fn();

      return result;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const isLastAttempt = attempt === maxRetries;

      // Check if error is retryable
      if (!shouldRetry(lastError) && !isLastAttempt) {
        // Not retryable - throw immediately
        throw wrapError(lastError, {
          strategy: strategyName as AnalysisStrategy | undefined,
          sectionName,
          retryAttempts: attempt,
        });
      }

      if (isLastAttempt) {
        // Last attempt failed - throw with full context
        throw wrapError(lastError, {
          strategy: strategyName as AnalysisStrategy | undefined,
          sectionName,
          retryAttempts: attempt,
          elapsedMs: Date.now() - startTime,
        });
      }

      // Calculate delay with exponential backoff and jitter
      let delay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);

      // Special handling for rate limits
      if (lastError instanceof RateLimitError && lastError.retryAfterMs) {
        delay = Math.max(delay, lastError.retryAfterMs);
      }

      // Add jitter
      const jitterAmount = delay * jitter * (Math.random() * 2 - 1);
      delay = Math.max(0, Math.round(delay + jitterAmount));

      // Log retry
      const logContext = [
        `Attempt ${attempt}/${maxRetries} failed`,
        strategyName ? `[${strategyName}]` : "",
        sectionName ? `Section: ${sectionName}` : "",
        `Retrying in ${delay}ms...`,
      ]
        .filter(Boolean)
        .join(" ");

      logger.warn("Retry", logContext, { error: lastError.message });

      // Invoke callback if provided
      if (onRetry) {
        onRetry(attempt, lastError, delay);
      }

      // Wait before retry
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // Should never reach here, but TypeScript needs this
  throw lastError || new Error("Retry failed with no error captured");
}

/**
 * Enhanced retry that returns metadata about the retry process.
 *
 * @param fn - Async function to retry
 * @param config - Retry configuration
 * @returns Result with metadata about retries
 */
export async function retryWithBackoffDetailed<T>(
  fn: () => Promise<T>,
  config: RetryConfig = {},
): Promise<RetryResult<T>> {
  const startTime = Date.now();
  let attempts = 0;

  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 30000,
    timeoutMs,
    jitter = 0.1,
    strategyName,
    sectionName,
    onRetry,
  } = config;

  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    attempts = attempt;

    try {
      const result = timeoutMs
        ? await withTimeout(fn, timeoutMs, `Attempt ${attempt}`)
        : await fn();

      return {
        result,
        attempts,
        totalElapsedMs: Date.now() - startTime,
        hadRetries: attempts > 1,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const isLastAttempt = attempt === maxRetries;

      if (!shouldRetry(lastError) || isLastAttempt) {
        throw wrapError(lastError, {
          strategy: strategyName as AnalysisStrategy | undefined,
          sectionName,
          retryAttempts: attempt,
          elapsedMs: Date.now() - startTime,
        });
      }

      // Calculate delay
      let delay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
      if (lastError instanceof RateLimitError && lastError.retryAfterMs) {
        delay = Math.max(delay, lastError.retryAfterMs);
      }
      const jitterAmount = delay * jitter * (Math.random() * 2 - 1);
      delay = Math.max(0, Math.round(delay + jitterAmount));

      logger.warn(
        "Retry",
        `Attempt ${attempt}/${maxRetries} failed, retrying in ${delay}ms`,
        {
          error: lastError.message,
          strategyName,
          sectionName,
        },
      );

      if (onRetry) {
        onRetry(attempt, lastError, delay);
      }

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError || new Error("Retry failed with no error captured");
}

/**
 * Wrap an async operation with a timeout.
 *
 * @param fn - Async function to wrap
 * @param timeoutMs - Timeout in milliseconds
 * @param operation - Operation name for error message
 * @returns Result of the function or throws TimeoutError
 *
 * @example
 * ```typescript
 * const result = await withTimeout(
 *   () => longRunningOperation(),
 *   30000,
 *   'API call'
 * );
 * ```
 */
export async function withTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number,
  operation = "Operation",
): Promise<T> {
  let timeoutId: NodeJS.Timeout | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new TimeoutError(operation, timeoutMs));
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([fn(), timeoutPromise]);
    return result;
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

/**
 * Result from safe execution.
 */
export type SafeExecuteResult<T> =
  | { success: true; result: T; error: null }
  | { success: false; result: null; error: AnalysisError };

/**
 * Safely execute an async operation with consistent error handling.
 *
 * Catches all errors and transforms them to typed AnalysisErrors.
 * Never throws - always returns a result object.
 *
 * @param fn - Async function to execute
 * @param metadata - Context metadata for errors
 * @returns Success result or error result
 *
 * @example
 * ```typescript
 * const result = await safeExecute(
 *   () => analyzeSection(section),
 *   { strategyName: 'advanced', sectionName: 'Summary' }
 * );
 *
 * if (result.success) {
 *   console.log('Got:', result.result);
 * } else {
 *   console.log('Error:', result.error.message);
 *   if (result.error.isRetryable) {
 *     // Maybe retry
 *   }
 * }
 * ```
 */
export async function safeExecute<T>(
  fn: () => Promise<T>,
  metadata: AnalysisErrorMetadata = {},
): Promise<SafeExecuteResult<T>> {
  try {
    const result = await fn();
    return { success: true, result, error: null };
  } catch (error) {
    const analysisError = wrapError(error, metadata);
    logger.error(
      metadata.strategy || "Analysis",
      analysisError.message,
      analysisError.toJSON(),
    );
    return { success: false, result: null, error: analysisError };
  }
}

/**
 * Execute multiple operations and collect results, even if some fail.
 *
 * Unlike Promise.all, this continues executing even after failures,
 * collecting as many successful results as possible.
 *
 * @param operations - Array of async operations to execute
 * @param metadata - Context metadata for errors
 * @returns Object with successful results and any errors
 */
export async function executeAllSettled<T>(
  operations: Array<() => Promise<T>>,
  metadata: AnalysisErrorMetadata = {},
): Promise<{
  results: T[];
  errors: AnalysisError[];
  allSucceeded: boolean;
  successCount: number;
  failureCount: number;
}> {
  const settled = await Promise.allSettled(operations.map((op) => op()));

  const results: T[] = [];
  const errors: AnalysisError[] = [];

  for (const outcome of settled) {
    if (outcome.status === "fulfilled") {
      results.push(outcome.value);
    } else {
      errors.push(wrapError(outcome.reason, metadata));
    }
  }

  return {
    results,
    errors,
    allSucceeded: errors.length === 0,
    successCount: results.length,
    failureCount: errors.length,
  };
}

/**
 * Classify an error for appropriate handling.
 *
 * @param error - Error to classify
 * @returns Classification details
 */
export function classifyError(error: unknown): {
  code: AnalysisErrorCode;
  isRetryable: boolean;
  isRateLimit: boolean;
  isTimeout: boolean;
  isContentFilter: boolean;
  isTruncated: boolean;
  suggestedAction: "retry" | "fallback" | "abort" | "partial";
} {
  const analysisError =
    error instanceof AnalysisError ? error : wrapError(error);

  const isRateLimit = analysisError.code === AnalysisErrorCode.RATE_LIMITED;
  const isTimeout = analysisError.code === AnalysisErrorCode.TIMEOUT;
  const isContentFilter =
    analysisError.code === AnalysisErrorCode.CONTENT_FILTER;
  const isTruncated =
    analysisError.code === AnalysisErrorCode.RESPONSE_TRUNCATED;
  const isPartial = analysisError.code === AnalysisErrorCode.PARTIAL_RESULTS;

  let suggestedAction: "retry" | "fallback" | "abort" | "partial";

  if (isPartial) {
    suggestedAction = "partial";
  } else if (isTruncated) {
    suggestedAction = "fallback"; // Need simpler strategy
  } else if (analysisError.isRetryable) {
    suggestedAction = "retry";
  } else if (analysisError.code === AnalysisErrorCode.ALL_STRATEGIES_FAILED) {
    suggestedAction = "abort";
  } else {
    suggestedAction = "fallback";
  }

  return {
    code: analysisError.code,
    isRetryable: analysisError.isRetryable,
    isRateLimit,
    isTimeout,
    isContentFilter,
    isTruncated,
    suggestedAction,
  };
}

/**
 * Check if a value is a valid timestamp
 */
function isValidTimestamp(value: unknown): value is number {
  return typeof value === "number" && !isNaN(value) && value >= 0;
}

/**
 * Validate that all items have required timestamps
 *
 * @param results - Analysis results to validate
 * @param transcriptDurationSeconds - Optional max duration to check against
 * @returns Array of warning messages for missing or invalid timestamps
 */
export function validateTimestamps(
  results: AnalysisResults,
  transcriptDurationSeconds?: number,
): string[] {
  const warnings: string[] = [];

  // Helper to validate a single timestamp
  const checkTimestamp = (
    timestamp: number | undefined,
    itemType: string,
    index: number,
    preview: string,
  ) => {
    const truncatedPreview =
      preview.length > 30 ? `${preview.substring(0, 30)}...` : preview;

    if (!isValidTimestamp(timestamp)) {
      warnings.push(
        `${itemType} ${index + 1} ("${truncatedPreview}") missing timestamp`,
      );
    } else if (timestamp === 0) {
      // timestamp=0 is suspicious - likely unset by LLM
      warnings.push(
        `${itemType} ${index + 1} ("${truncatedPreview}") has timestamp=0 (possibly unset)`,
      );
    } else if (
      transcriptDurationSeconds &&
      timestamp > transcriptDurationSeconds
    ) {
      warnings.push(
        `${itemType} ${index + 1} ("${truncatedPreview}") timestamp ${timestamp}s exceeds duration ${transcriptDurationSeconds}s`,
      );
    }
  };

  // Check action items
  results.actionItems?.forEach((item, i) => {
    checkTimestamp(item.timestamp, "Action item", i, item.task);
  });

  // Check benchmark observations (timestamp optional)
  results.benchmarks?.forEach((b, i) => {
    if (b.timestamp !== undefined) {
      checkTimestamp(b.timestamp, "Benchmark", i, b.benchmark);
    }
  });

  // Check radio reports
  results.radioReports?.forEach((r, i) => {
    checkTimestamp(r.timestamp, "Radio report", i, r.type);
  });

  // Check safety events
  results.safetyEvents?.forEach((e, i) => {
    checkTimestamp(e.timestamp, "Safety event", i, e.details);
  });

  // Check decisions
  results.decisions?.forEach((dec, i) => {
    checkTimestamp(dec.timestamp, "Decision", i, dec.decision);
  });

  // Check quotes
  results.quotes?.forEach((quote, i) => {
    checkTimestamp(quote.timestamp, "Quote", i, quote.text);
  });

  return warnings;
}

/**
 * Apply all post-processing validations and fixes to analysis results
 *
 * Ensures data integrity by:
 * 1. Enforcing unique IDs
 * 2. Validating relationship references
 * 3. Validating timestamps
 * 4. Logging warnings and errors
 *
 * @param results - Raw analysis results
 * @param strategyName - Name of strategy (for logging)
 * @param transcriptDurationSeconds - Optional max duration to validate timestamps against
 * @returns Cleaned and validated results
 */
export function postProcessResults(
  results: AnalysisResults,
  strategyName: string,
  transcriptDurationSeconds?: number,
): AnalysisResults {
  logger.info(strategyName, "Post-processing results");

  // 1. Ensure unique IDs
  const processedResults: AnalysisResults = {
    ...results,
    agendaItems: ensureUniqueIds(results.agendaItems, "agenda"),
    benchmarks: ensureUniqueIds(results.benchmarks, "benchmark"),
    radioReports: ensureUniqueIds(results.radioReports, "report"),
    safetyEvents: ensureUniqueIds(results.safetyEvents, "safety"),
    actionItems: ensureUniqueIds(results.actionItems, "action"),
    decisions: ensureUniqueIds(results.decisions, "decision"),
  };

  // 2. Validate relationship IDs
  const validation = validateRelationshipIds(processedResults);

  if (!validation.valid) {
    logger.warn(
      strategyName,
      "Relationship validation warnings",
      validation.warnings,
    );
  }

  if (validation.errors.length > 0) {
    logger.error(
      strategyName,
      "Relationship validation errors",
      validation.errors,
    );
  }

  // 3. Validate timestamps (with optional duration check)
  const timestampWarnings = validateTimestamps(
    processedResults,
    transcriptDurationSeconds,
  );
  if (timestampWarnings.length > 0) {
    logger.warn(
      strategyName,
      "Timestamp validation warnings",
      timestampWarnings,
    );
  }

  // 4. Log statistics
  const stats = {
    agendaItemCount: processedResults.agendaItems?.length || 0,
    benchmarkCount: processedResults.benchmarks?.length || 0,
    radioReportCount: processedResults.radioReports?.length || 0,
    safetyEventCount: processedResults.safetyEvents?.length || 0,
    actionItemCount: processedResults.actionItems?.length || 0,
    decisionCount: processedResults.decisions?.length || 0,
    validationWarnings: validation.warnings.length,
    timestampWarnings: timestampWarnings.length,
    validationErrors: validation.errors.length,
  };

  logger.info(strategyName, "Post-processing complete", stats);

  return processedResults;
}

/**
 * Prune outputs that are not requested by the template (or not appropriate for content type).
 *
 * For radio-traffic templates we also strip meeting-oriented artifacts (action items,
 * decisions, quotes) even if the model returned them.
 */
export function pruneResultsForTemplate(
  results: AnalysisResults,
  _template: Template,
): AnalysisResults {
  const pruned: AnalysisResults = { ...results };

  // Retired meeting-era outputs (fireground platform now uses structured logs instead)
  delete pruned.actionItems;
  delete pruned.decisions;
  delete pruned.quotes;
  delete pruned.agendaItems;

  return pruned;
}

/**
 * Normalize common JSON key variants produced by LLMs into the app's canonical shapes.
 *
 * In practice some models will output snake_case keys even when the prompt examples
 * use camelCase. Our parsers/validators expect camelCase, so we map known variants
 * before validating.
 */
export function normalizeAnalysisJsonKeys<T>(data: T): T {
  if (!data || typeof data !== "object") return data;

  const obj = data as Record<string, unknown>;
  const normalized: Record<string, unknown> = { ...obj };

  const mapArrayKey = (from: string, to: string) => {
    if (normalized[to] !== undefined) return;
    const value = obj[from];
    if (Array.isArray(value)) {
      normalized[to] = value;
    }
  };

  const mapObjectKey = (from: string, to: string) => {
    if (normalized[to] !== undefined) return;
    const value = obj[from];
    if (value && typeof value === "object" && !Array.isArray(value)) {
      normalized[to] = value;
    }
  };

  // Fireground outputs
  mapArrayKey("radio_reports", "radioReports");
  mapArrayKey("safety_events", "safetyEvents");

  // Legacy meeting outputs (still normalized for robustness; later pruned)
  mapArrayKey("agenda_items", "agendaItems");
  mapArrayKey("action_items", "actionItems");

  // Evaluation wrapper keys
  mapObjectKey("final_results", "finalResults");

  // If finalResults exists, normalize inside it as well.
  if (normalized.finalResults && typeof normalized.finalResults === "object") {
    normalized.finalResults = normalizeAnalysisJsonKeys(
      normalized.finalResults,
    );
  }

  return normalized as T;
}

/**
 * Structured logger for consistent logging across strategies
 */
export const logger = {
  info: (strategy: string, message: string, meta?: unknown) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${strategy}]`, message, meta || "");
  },

  warn: (strategy: string, message: string, meta?: unknown) => {
    const timestamp = new Date().toISOString();
    console.warn(`[${timestamp}] [${strategy}] WARNING:`, message, meta || "");
  },

  error: (strategy: string, message: string, error?: unknown) => {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] [${strategy}] ERROR:`, message, error);
  },

  debug: (strategy: string, message: string, meta?: unknown) => {
    const timestamp = new Date().toISOString();
    console.debug(`[${timestamp}] [${strategy}] DEBUG:`, message, meta || "");
  },
};

/**
 * Repair timestamps in final results using draft results as reference
 *
 * When the evaluation pass returns invalid timestamps (undefined, null, NaN),
 * this function attempts to recover them from the draft results by matching
 * items by their ID.
 *
 * @param finalResults - Results from evaluation pass (may have broken timestamps)
 * @param draftResults - Original draft results (should have valid timestamps)
 * @returns Results with repaired timestamps
 */
export function repairTimestamps(
  finalResults: AnalysisResults,
  draftResults: AnalysisResults,
): AnalysisResults {
  let repairCount = 0;

  // Helper to check if timestamp is invalid
  const needsRepair = (ts: number | undefined): boolean => {
    return (
      ts === undefined || ts === null || (typeof ts === "number" && isNaN(ts))
    );
  };

  // Repair action items
  const repairedActionItems = finalResults.actionItems?.map((item) => {
    if (needsRepair(item.timestamp)) {
      const draftItem = draftResults.actionItems?.find((d) => d.id === item.id);
      if (draftItem && !needsRepair(draftItem.timestamp)) {
        repairCount++;
        logger.warn(
          "Timestamp Repair",
          `Action item "${item.id}" timestamp repaired: ${item.timestamp} → ${draftItem.timestamp}`,
        );
        return { ...item, timestamp: draftItem.timestamp };
      }
      // No match found - log warning but keep invalid value
      logger.warn(
        "Timestamp Repair",
        `Action item "${item.id}" has invalid timestamp ${item.timestamp} but no draft match found`,
      );
    }
    return item;
  });

  // Repair benchmark observations (timestamp optional)
  const repairedBenchmarks = finalResults.benchmarks?.map((item) => {
    if (item.timestamp !== undefined && needsRepair(item.timestamp)) {
      const draftItem = draftResults.benchmarks?.find((d) => d.id === item.id);
      if (
        draftItem &&
        draftItem.timestamp !== undefined &&
        !needsRepair(draftItem.timestamp)
      ) {
        repairCount++;
        logger.warn(
          "Timestamp Repair",
          `Benchmark "${item.id}" timestamp repaired: ${item.timestamp} → ${draftItem.timestamp}`,
        );
        return { ...item, timestamp: draftItem.timestamp };
      }
      logger.warn(
        "Timestamp Repair",
        `Benchmark "${item.id}" has invalid timestamp ${item.timestamp} but no draft match found`,
      );
    }
    return item;
  });

  // Repair radio reports
  const repairedRadioReports = finalResults.radioReports?.map((item) => {
    if (needsRepair(item.timestamp)) {
      const draftItem = draftResults.radioReports?.find(
        (d) => d.id === item.id,
      );
      if (draftItem && !needsRepair(draftItem.timestamp)) {
        repairCount++;
        logger.warn(
          "Timestamp Repair",
          `Radio report "${item.id}" timestamp repaired: ${item.timestamp} → ${draftItem.timestamp}`,
        );
        return { ...item, timestamp: draftItem.timestamp };
      }
      logger.warn(
        "Timestamp Repair",
        `Radio report "${item.id}" has invalid timestamp ${item.timestamp} but no draft match found`,
      );
    }
    return item;
  });

  // Repair safety events
  const repairedSafetyEvents = finalResults.safetyEvents?.map((item) => {
    if (needsRepair(item.timestamp)) {
      const draftItem = draftResults.safetyEvents?.find(
        (d) => d.id === item.id,
      );
      if (draftItem && !needsRepair(draftItem.timestamp)) {
        repairCount++;
        logger.warn(
          "Timestamp Repair",
          `Safety event "${item.id}" timestamp repaired: ${item.timestamp} → ${draftItem.timestamp}`,
        );
        return { ...item, timestamp: draftItem.timestamp };
      }
      logger.warn(
        "Timestamp Repair",
        `Safety event "${item.id}" has invalid timestamp ${item.timestamp} but no draft match found`,
      );
    }
    return item;
  });

  // Repair decisions
  const repairedDecisions = finalResults.decisions?.map((item) => {
    if (needsRepair(item.timestamp)) {
      const draftItem = draftResults.decisions?.find((d) => d.id === item.id);
      if (draftItem && !needsRepair(draftItem.timestamp)) {
        repairCount++;
        logger.warn(
          "Timestamp Repair",
          `Decision "${item.id}" timestamp repaired: ${item.timestamp} → ${draftItem.timestamp}`,
        );
        return { ...item, timestamp: draftItem.timestamp };
      }
      logger.warn(
        "Timestamp Repair",
        `Decision "${item.id}" has invalid timestamp ${item.timestamp} but no draft match found`,
      );
    }
    return item;
  });

  // Repair quotes (match by text since quotes don't have IDs)
  const repairedQuotes = finalResults.quotes?.map((item) => {
    if (needsRepair(item.timestamp)) {
      // Try to find matching quote by text
      const draftItem = draftResults.quotes?.find(
        (d) =>
          d.text === item.text || d.text.includes(item.text.substring(0, 30)),
      );
      if (draftItem && !needsRepair(draftItem.timestamp)) {
        repairCount++;
        logger.warn(
          "Timestamp Repair",
          `Quote timestamp repaired: ${item.timestamp} → ${draftItem.timestamp}`,
        );
        return { ...item, timestamp: draftItem.timestamp };
      }
      logger.warn(
        "Timestamp Repair",
        `Quote has invalid timestamp ${item.timestamp} but no draft match found`,
      );
    }
    return item;
  });

  if (repairCount > 0) {
    logger.info(
      "Timestamp Repair",
      `Repaired ${repairCount} timestamps from draft results`,
    );
  }

  return {
    ...finalResults,
    actionItems: repairedActionItems,
    benchmarks: repairedBenchmarks,
    radioReports: repairedRadioReports,
    safetyEvents: repairedSafetyEvents,
    decisions: repairedDecisions,
    quotes: repairedQuotes,
  };
}

/**
 * Repair malformed evidence arrays in analysis sections
 *
 * The AI may return:
 * - Missing evidence field (undefined)
 * - Null evidence field
 * - Evidence array with malformed objects (missing text, start, end, relevance)
 *
 * This function normalizes all evidence to valid Evidence[] arrays.
 *
 * @param results - Analysis results that may have malformed evidence
 * @returns Results with repaired evidence arrays
 */
export function repairEvidence(results: AnalysisResults): AnalysisResults {
  let repairCount = 0;
  let removeCount = 0;

  const repairedSections = results.sections.map((section) => {
    // Handle missing or null evidence array
    if (!section.evidence || !Array.isArray(section.evidence)) {
      if (section.evidence !== undefined) {
        repairCount++;
        logger.warn(
          "Evidence Repair",
          `Section "${section.name}" had invalid evidence (${typeof section.evidence}), defaulting to []`,
        );
      }
      return { ...section, evidence: [] };
    }

    // Filter and normalize evidence objects
    const repairedEvidence = section.evidence
      .map((ev) => {
        // Skip completely invalid evidence
        if (!ev || typeof ev !== "object") {
          removeCount++;
          return null;
        }

        // Normalize fields with defaults
        const text = typeof ev.text === "string" ? ev.text : "";
        const start =
          typeof ev.start === "number" && !isNaN(ev.start) ? ev.start : 0;
        const end = typeof ev.end === "number" && !isNaN(ev.end) ? ev.end : 0;
        const relevance =
          typeof ev.relevance === "number" && !isNaN(ev.relevance)
            ? Math.max(0, Math.min(1, ev.relevance))
            : 0.5;

        // Skip evidence with empty text (not useful)
        if (text.trim() === "") {
          removeCount++;
          return null;
        }

        // Track if we needed to repair anything
        if (
          ev.text !== text ||
          ev.start !== start ||
          ev.end !== end ||
          ev.relevance !== relevance
        ) {
          repairCount++;
        }

        return { text, start, end, relevance };
      })
      .filter((ev): ev is NonNullable<typeof ev> => ev !== null);

    return { ...section, evidence: repairedEvidence };
  });

  if (repairCount > 0 || removeCount > 0) {
    logger.info(
      "Evidence Repair",
      `Repaired ${repairCount} evidence fields, removed ${removeCount} invalid entries`,
    );
  }

  return {
    ...results,
    sections: repairedSections,
  };
}

/**
 * Track performance metrics for strategy execution
 *
 * @param strategyName - Name of strategy
 * @param estimatedSeconds - Estimated processing time in seconds
 * @param actualMs - Actual processing time in milliseconds
 */
export function logPerformanceMetrics(
  strategyName: string,
  estimatedSeconds: string,
  actualMs: number,
): void {
  const actualSeconds = (actualMs / 1000).toFixed(1);
  const [minEst, maxEst] = estimatedSeconds.split("-").map((s) => parseInt(s));
  const avgEst = (minEst + maxEst) / 2;
  const withinEstimate = actualMs / 1000 <= maxEst;

  logger.info(strategyName, "Performance metrics", {
    estimated: estimatedSeconds,
    actual: `${actualSeconds}s`,
    withinEstimate,
    variance: `${(((actualMs / 1000 - avgEst) / avgEst) * 100).toFixed(1)}%`,
  });
}

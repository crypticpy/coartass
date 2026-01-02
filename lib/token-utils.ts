/**
 * Token Estimation and Deployment Selection Utilities
 *
 * This module provides utilities for estimating token counts and selecting
 * the appropriate Azure OpenAI deployment based on transcript length.
 *
 * Deployment Strategy:
 * - Transcripts < 256k tokens → gpt-5 (standard context)
 * - Transcripts ≥ 256k tokens → gpt-41 (extended context, up to 1M tokens)
 */

/**
 * Token threshold for switching to extended context deployment
 */
export const EXTENDED_CONTEXT_TOKEN_THRESHOLD = 256000; // 256k tokens

/**
 * Maximum token limits for each deployment type
 */
export const TOKEN_LIMITS = {
  standard: 256000,   // gpt-5 standard context limit
  extended: 1000000,  // gpt-41 extended context limit (1M tokens)
} as const;

/**
 * Estimate token count for text
 *
 * Uses a rough approximation of 1 token ≈ 4 characters.
 * This is conservative for English text and provides a good buffer.
 *
 * For more accurate counting, consider using the tiktoken library,
 * but this estimation is fast and sufficient for deployment selection.
 *
 * @param text - Text to estimate tokens for
 * @returns Estimated token count
 *
 * @example
 * ```typescript
 * const text = "Hello, world!";
 * const tokens = estimateTokens(text); // ~3 tokens
 * ```
 */
export function estimateTokens(text: string): number {
  if (!text || text.length === 0) {
    return 0;
  }

  // Rough approximation: 1 token ≈ 4 characters
  // This is conservative and works well for English text
  return Math.ceil(text.length / 4);
}

/**
 * Select the appropriate GPT deployment based on estimated token count
 *
 * Automatically chooses between:
 * - Standard deployment (gpt-5) for transcripts < 256k tokens
 * - Extended deployment (gpt-41) for transcripts ≥ 256k tokens
 *
 * @param estimatedTokens - Estimated token count
 * @returns Deployment name to use
 *
 * @example
 * ```typescript
 * const tokens = estimateTokens(transcript.text);
 * const deployment = selectDeploymentByTokens(tokens);
 * // Returns 'gpt-5' or 'gpt-41' based on token count
 * ```
 */
export function selectDeploymentByTokens(estimatedTokens: number): string {
  if (estimatedTokens >= EXTENDED_CONTEXT_TOKEN_THRESHOLD) {
    // Use extended context deployment (gpt-41)
    const extendedDeployment = process.env.AZURE_OPENAI_EXTENDED_GPT_DEPLOYMENT;

    if (!extendedDeployment) {
      console.warn(
        `[Token Utils] Warning: Transcript has ${estimatedTokens.toLocaleString()} tokens ` +
        `(>= ${EXTENDED_CONTEXT_TOKEN_THRESHOLD.toLocaleString()}), but ` +
        'AZURE_OPENAI_EXTENDED_GPT_DEPLOYMENT is not configured. ' +
        'Falling back to standard deployment, which may fail or be truncated.'
      );
      return (
        process.env.AZURE_OPENAI_GPT5_DEPLOYMENT ??
        process.env.AZURE_OPENAI_GPT4_DEPLOYMENT ??
        'gpt-5'
      );
    }

    console.log(
      `[Token Utils] Using extended context deployment '${extendedDeployment}' ` +
      `for ${estimatedTokens.toLocaleString()} token transcript ` +
      `(${((estimatedTokens / TOKEN_LIMITS.extended) * 100).toFixed(1)}% of 1M limit)`
    );
    return extendedDeployment;
  } else {
    // Use standard deployment (gpt-5)
    const standardDeployment =
      process.env.AZURE_OPENAI_GPT5_DEPLOYMENT ??
      process.env.AZURE_OPENAI_GPT4_DEPLOYMENT ??
      'gpt-5';
    console.log(
      `[Token Utils] Using standard deployment '${standardDeployment}' ` +
      `for ${estimatedTokens.toLocaleString()} token transcript ` +
      `(${((estimatedTokens / TOKEN_LIMITS.standard) * 100).toFixed(1)}% of 256k limit)`
    );
    return standardDeployment;
  }
}

/**
 * Deployment information for a transcript
 */
export interface DeploymentInfo {
  /** Deployment name to use */
  deployment: string;
  /** Maximum token limit for this deployment */
  tokenLimit: number;
  /** Whether extended context deployment is being used */
  isExtended: boolean;
  /** Percentage of token limit being utilized */
  utilizationPercentage: number;
  /** Estimated token count */
  estimatedTokens: number;
  /** Whether utilization is high (>80%) */
  isHighUtilization: boolean;
  /** Whether utilization is critical (>90%) */
  isCriticalUtilization: boolean;
}

/**
 * Get comprehensive deployment information for a transcript
 *
 * Provides detailed information about which deployment will be used,
 * token limits, and utilization metrics.
 *
 * @param estimatedTokens - Estimated token count
 * @returns Deployment information object
 *
 * @example
 * ```typescript
 * const tokens = estimateTokens(transcript.text);
 * const info = getDeploymentInfo(tokens);
 *
 * console.log(`Using ${info.deployment}`);
 * console.log(`Utilization: ${info.utilizationPercentage}%`);
 *
 * if (info.isCriticalUtilization) {
 *   console.warn('High token usage - may exceed limit!');
 * }
 * ```
 */
export function getDeploymentInfo(estimatedTokens: number): DeploymentInfo {
  const isExtended = estimatedTokens >= EXTENDED_CONTEXT_TOKEN_THRESHOLD;
  const deployment = selectDeploymentByTokens(estimatedTokens);
  const tokenLimit = isExtended ? TOKEN_LIMITS.extended : TOKEN_LIMITS.standard;
  const utilizationPercentage = Math.round((estimatedTokens / tokenLimit) * 100);
  const isHighUtilization = utilizationPercentage > 80;
  const isCriticalUtilization = utilizationPercentage > 90;

  // Warn if approaching limits
  if (isCriticalUtilization) {
    console.warn(
      `[Token Utils] CRITICAL: Transcript is using ${utilizationPercentage}% of token limit. ` +
      'May exceed limit when including analysis prompt and response. ' +
      'Consider preprocessing or chunking the transcript.'
    );
  } else if (isHighUtilization) {
    console.warn(
      `[Token Utils] Warning: Transcript is using ${utilizationPercentage}% of token limit. ` +
      'Monitor for potential token limit issues.'
    );
  }

  return {
    deployment,
    tokenLimit,
    isExtended,
    utilizationPercentage,
    estimatedTokens,
    isHighUtilization,
    isCriticalUtilization,
  };
}

/**
 * Format token count for display
 *
 * @param tokens - Token count
 * @returns Formatted string (e.g., "150,000 tokens")
 *
 * @example
 * ```typescript
 * formatTokenCount(150000); // "150,000 tokens"
 * formatTokenCount(1500);   // "1,500 tokens"
 * ```
 */
export function formatTokenCount(tokens: number): string {
  return `${tokens.toLocaleString()} token${tokens === 1 ? '' : 's'}`;
}

/**
 * Format utilization percentage with color coding hint
 *
 * @param percentage - Utilization percentage (0-100)
 * @returns Object with formatted string and severity level
 *
 * @example
 * ```typescript
 * const util = formatUtilization(95);
 * console.log(util.text);      // "95%"
 * console.log(util.severity);  // "critical"
 * ```
 */
export function formatUtilization(percentage: number): {
  text: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
} {
  let severity: 'low' | 'medium' | 'high' | 'critical';

  if (percentage > 90) {
    severity = 'critical';
  } else if (percentage > 80) {
    severity = 'high';
  } else if (percentage > 60) {
    severity = 'medium';
  } else {
    severity = 'low';
  }

  return {
    text: `${percentage}%`,
    severity,
  };
}

/**
 * Check if extended context deployment is configured
 *
 * @returns true if AZURE_OPENAI_EXTENDED_GPT_DEPLOYMENT is set
 */
export function hasExtendedDeployment(): boolean {
  return !!process.env.AZURE_OPENAI_EXTENDED_GPT_DEPLOYMENT;
}

/**
 * Get deployment name directly from environment
 *
 * @param type - Deployment type
 * @returns Deployment name or undefined
 */
export function getDeploymentName(type: 'standard' | 'extended' | 'whisper'): string | undefined {
  switch (type) {
    case 'standard':
      return (
        process.env.AZURE_OPENAI_GPT5_DEPLOYMENT ??
        process.env.AZURE_OPENAI_GPT4_DEPLOYMENT
      );
    case 'extended':
      return process.env.AZURE_OPENAI_EXTENDED_GPT_DEPLOYMENT;
    case 'whisper':
      return process.env.AZURE_OPENAI_WHISPER_DEPLOYMENT;
    default:
      return undefined;
  }
}

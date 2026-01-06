/**
 * Model-appropriate chat completion parameter helpers.
 *
 * IMPORTANT: This module is intentionally dependency-free so it can be safely
 * imported from both server and client bundles.
 */

/**
 * Reasoning effort level for reasoning models (o1, o3, gpt-5.2)
 */
export type ReasoningEffort = "low" | "medium" | "high";

/**
 * Check if a model/deployment requires GPT-5 style parameters
 * (max_completion_tokens instead of max_tokens, no temperature)
 */
function isGPT5StyleModel(deployment: string): boolean {
  const lowerDeployment = deployment.toLowerCase();
  return (
    lowerDeployment.includes("gpt-5") ||
    lowerDeployment.includes("o1") ||
    lowerDeployment.includes("o3")
  );
}

/**
 * Check if a model/deployment supports reasoning_effort parameter
 * (o1, o3, and gpt-5.2+ reasoning models)
 */
function supportsReasoningEffort(deployment: string): boolean {
  const lowerDeployment = deployment.toLowerCase();
  return (
    lowerDeployment.includes("o1") ||
    lowerDeployment.includes("o3") ||
    // GPT-5 family deployments may support reasoning_effort as well.
    // Azure deployment names are user-defined; we key off common naming patterns.
    lowerDeployment.includes("gpt-5") ||
    lowerDeployment.includes("gpt-5.2")
  );
}

/**
 * Build model-appropriate chat completion parameters.
 *
 * GPT-5 and reasoning models (o1, o3, gpt-5.2) have different parameter requirements:
 * - Use max_completion_tokens instead of max_tokens
 * - Do not support temperature parameter
 * - Reasoning models support reasoning_effort parameter
 */
export function buildChatCompletionParams(
  deployment: string,
  maxTokens?: number,
  temperature?: number,
  reasoningEffort: ReasoningEffort = "medium"
): {
  max_completion_tokens?: number;
  max_tokens?: number;
  temperature?: number;
  reasoning_effort?: ReasoningEffort;
} {
  if (isGPT5StyleModel(deployment)) {
    const params: {
      max_completion_tokens?: number;
      reasoning_effort?: ReasoningEffort;
    } = {};
    if (maxTokens) params.max_completion_tokens = maxTokens;
    if (supportsReasoningEffort(deployment)) {
      params.reasoning_effort = reasoningEffort;
    }
    return params;
  }

  const params: { max_tokens?: number; temperature?: number } = {};
  if (maxTokens) params.max_tokens = maxTokens;
  if (temperature !== undefined) params.temperature = temperature;
  return params;
}

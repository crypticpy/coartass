/**
 * Azure OpenAI Configuration and Client Setup
 *
 * This module provides a properly configured OpenAI client with support for:
 * - Azure OpenAI Service (primary)
 * - Standard OpenAI API (fallback)
 * - Environment variable validation with Zod
 * - Type-safe configuration access
 */

import OpenAI, { AzureOpenAI } from 'openai';
import { z } from 'zod';
import {
  validateEnvironmentVariables as validateEnvVars,
  buildOpenAIConfig,
  formatValidationError,
  loadEnvironmentVariablesAsync,
  type OpenAIConfig,
  type EnvironmentVariables,
} from './validations/config';
import { isKeyVaultAvailable, getKeyVaultSummary } from './azure-key-vault';
import { buildChatCompletionParams, type ReasoningEffort } from './openai-chat-params';

/**
 * Configuration Error Class
 */
export class OpenAIConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OpenAIConfigError';
  }
}

// Re-export types for convenience
export type { OpenAIConfig, EnvironmentVariables };

/**
 * Cached client instance (singleton pattern)
 */
let clientInstance: OpenAI | null = null;

/**
 * Cached transcription client instance (separate API version)
 */
let transcriptionClientInstance: OpenAI | null = null;

/**
 * Cached citations client instance (separate API version / deployment)
 */
let citationsClientInstance: OpenAI | null = null;

/**
 * Cached configuration
 */
let configCache: OpenAIConfig | null = null;

/**
 * Validate and build configuration from environment variables
 *
 * Uses Zod schemas to validate all environment variables and build
 * a properly typed configuration object.
 */
function buildConfiguration(): OpenAIConfig {
  try {
    // Validate environment variables using Zod schema
    const env = validateEnvVars(process.env as Record<string, string | undefined>);

    // Build and validate OpenAI configuration
    const config = buildOpenAIConfig(env);

    return config;
  } catch (error) {
    if (error instanceof z.ZodError) {
      // Format Zod validation errors for better readability
      const formattedError = formatValidationError(error);
      throw new OpenAIConfigError(
        `Environment variable validation failed:\n${formattedError}\n\n` +
        'Please check your .env.local file and ensure all required variables are set correctly.\n' +
        'See .env.local.example for the correct format.'
      );
    }
    throw error;
  }
}

/**
 * Get the current OpenAI configuration
 *
 * @returns OpenAI configuration object
 * @throws {OpenAIConfigError} If configuration is invalid or missing
 */
export function getConfiguration(): OpenAIConfig {
  if (!configCache) {
    configCache = buildConfiguration();
  }
  return configCache;
}

/**
 * Check if using Azure OpenAI service
 *
 * @returns true if Azure OpenAI is configured, false if using standard OpenAI
 */
export function isAzureOpenAI(): boolean {
  const config = getConfiguration();
  return config.provider === 'azure';
}

/**
 * Get the configured OpenAI client
 *
 * This function returns a singleton instance of the OpenAI client,
 * properly configured for either Azure OpenAI or standard OpenAI API.
 *
 * @returns Configured OpenAI client instance
 * @throws {OpenAIConfigError} If configuration is invalid or missing
 *
 * @example
 * ```typescript
 * const client = getOpenAIClient();
 * const response = await client.chat.completions.create({
 *   model: getGPT4Deployment(),
 *   messages: [{ role: 'user', content: 'Hello!' }],
 * });
 * ```
 */
export function getOpenAIClient(): OpenAI {
  if (clientInstance) {
    return clientInstance;
  }

  const config = getConfiguration();

  try {
    if (config.provider === 'azure') {
      // Use Azure-specific client so deployment routing is handled automatically
      clientInstance = new AzureOpenAI({
        apiKey: config.apiKey,
        endpoint: config.endpoint,
        apiVersion: config.apiVersion,
      });

      if (process.env.NODE_ENV === 'development') {
        console.log('[OpenAI] Initialized Azure OpenAI client', {
          endpoint: config.endpoint,
          apiVersion: config.apiVersion,
        });
      }
    } else {
      // Configure standard OpenAI client
      clientInstance = new OpenAI({
        apiKey: config.apiKey,
        organization: config.organizationId,
      });

      if (process.env.NODE_ENV === 'development') {
        console.log('[OpenAI] Initialized standard OpenAI client');
      }
    }

    return clientInstance;
  } catch (error) {
    throw new OpenAIConfigError(
      `Failed to initialize OpenAI client: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Get the configured OpenAI client for transcription
 *
 * This function returns a singleton instance of the OpenAI client
 * configured specifically for transcription with API version 2025-03-01-preview.
 * Azure OpenAI's GPT-4o transcription endpoint requires this newer API version.
 *
 * @returns Configured OpenAI client instance for transcription
 * @throws {OpenAIConfigError} If configuration is invalid or missing
 *
 * @example
 * ```typescript
 * const client = getTranscriptionClient();
 * const response = await client.audio.transcriptions.create({
 *   model: getWhisperDeployment(),
 *   file: audioFile,
 * });
 * ```
 */
export function getTranscriptionClient(): OpenAI {
  if (transcriptionClientInstance) {
    return transcriptionClientInstance;
  }

  const config = getConfiguration();

  try {
    if (config.provider === 'azure') {
      // Configure Azure OpenAI client with transcription API version
      transcriptionClientInstance = new AzureOpenAI({
        apiKey: config.apiKey,
        endpoint: config.endpoint,
        apiVersion: '2025-03-01-preview',
        deployment: config.whisperDeployment,
      });

      if (process.env.NODE_ENV === 'development') {
        console.log('[OpenAI] Initialized Azure OpenAI transcription client', {
          endpoint: config.endpoint,
          apiVersion: '2025-03-01-preview',
        });
      }
    } else {
      // For standard OpenAI, use the regular client
      transcriptionClientInstance = getOpenAIClient();
    }

    return transcriptionClientInstance;
  } catch (error) {
    throw new OpenAIConfigError(
      `Failed to initialize transcription client: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Get the configured OpenAI client for citations/evidence selection.
 *
 * Uses the same credentials as the main client but allows an independent
 * Azure API version via `AZURE_OPENAI_CITATIONS_API_VERSION`.
 */
export function getCitationsClient(): OpenAI {
  if (citationsClientInstance) {
    return citationsClientInstance;
  }

  const config = getConfiguration();

  try {
    if (config.provider === 'azure') {
      const apiVersion = process.env.AZURE_OPENAI_CITATIONS_API_VERSION || '2024-12-01-preview';
      citationsClientInstance = new AzureOpenAI({
        apiKey: config.apiKey,
        endpoint: config.endpoint,
        apiVersion,
      });

      if (process.env.NODE_ENV === 'development') {
        console.log('[OpenAI] Initialized Azure OpenAI citations client', {
          endpoint: config.endpoint,
          apiVersion,
        });
      }
    } else {
      // For standard OpenAI, reuse the main client.
      citationsClientInstance = getOpenAIClient();
    }

    return citationsClientInstance;
  } catch (error) {
    throw new OpenAIConfigError(
      `Failed to initialize citations client: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Get the citations model/deployment name.
 *
 * For Azure OpenAI this should be a deployment name (e.g. "gpt-4.1-mini").
 */
export function getCitationsDeployment(): string {
  const config = getConfiguration();

  if (config.provider === 'azure') {
    // Use citations deployment if set, otherwise fall back to analysis deployment
    return process.env.AZURE_OPENAI_CITATIONS_DEPLOYMENT || config.gpt4Deployment || 'gpt-5';
  }

  return process.env.OPENAI_CITATIONS_MODEL || 'gpt-4o-mini';
}

/**
 * Get the Whisper deployment/model name
 *
 * For Azure OpenAI, this returns the deployment name.
 * For standard OpenAI, this returns the model identifier.
 *
 * @returns Whisper deployment or model name
 * @throws {OpenAIConfigError} If configuration is invalid
 *
 * @example
 * ```typescript
 * const deployment = getWhisperDeployment();
 * const transcription = await client.audio.transcriptions.create({
 *   model: deployment,
 *   file: audioFile,
 * });
 * ```
 */
export function getWhisperDeployment(): string {
  const config = getConfiguration();

  if (config.provider === 'azure') {
    if (!config.whisperDeployment) {
      throw new OpenAIConfigError(
        'AZURE_OPENAI_WHISPER_DEPLOYMENT is not configured. ' +
        'Please set this environment variable to your Whisper deployment name.'
      );
    }
    return config.whisperDeployment;
  }

  // Standard OpenAI uses model name directly
  return 'whisper-1';
}

/**
 * Get the GPT analysis deployment/model name.
 *
 * For Azure OpenAI, this returns the analysis deployment name (expected to be GPT-5
 * or GPT-41 for extended context). For standard OpenAI, this returns the default
 * GPT-5 model identifier.
 *
 * @returns Analysis deployment or model name
 * @throws {OpenAIConfigError} If configuration is invalid
 */
export function getGPTAnalysisDeployment(): string {
  const config = getConfiguration();

  if (config.provider === 'azure') {
    if (!config.gpt4Deployment) {
      throw new OpenAIConfigError(
        'Azure analysis deployment is not configured. Set AZURE_OPENAI_GPT5_DEPLOYMENT ' +
        '(or legacy AZURE_OPENAI_GPT4_DEPLOYMENT) to your GPT-5 deployment name.'
      );
    }
    return config.gpt4Deployment;
  }

  // Standard OpenAI uses model name directly; default to GPT-5
  return 'gpt-5';
}

// Backward compatibility export
export const getGPT4Deployment = getGPTAnalysisDeployment;

/**
 * Validate that all required environment variables are set
 *
 * This function should be called during application startup to ensure
 * proper configuration before attempting to use the OpenAI client.
 * Now uses Zod schemas for comprehensive validation.
 *
 * @throws {OpenAIConfigError} If required variables are missing or invalid
 *
 * @example
 * ```typescript
 * // In your app startup or API route
 * try {
 *   validateEnvironment();
 *   console.log('OpenAI configuration is valid');
 * } catch (error) {
 *   console.error('Configuration error:', error.message);
 *   process.exit(1);
 * }
 * ```
 */
export function validateEnvironment(): void {
  try {
    // This will throw if validation fails
    const config = getConfiguration();

    // Additional warnings for optional but recommended fields
    if (config.provider === 'azure') {
      if (!config.whisperDeployment) {
        console.warn(
          '[OpenAI] Warning: AZURE_OPENAI_WHISPER_DEPLOYMENT not set. ' +
          'Whisper transcription will not work without this.'
        );
      }
      if (!config.gpt4Deployment) {
        console.warn(
          '[OpenAI] Warning: AZURE_OPENAI_GPT5_DEPLOYMENT (or legacy AZURE_OPENAI_GPT4_DEPLOYMENT) not set. ' +
          'GPT-5 analysis completions will not work without this.'
        );
      }
    }

    console.log('[OpenAI] Environment variables validated successfully');
  } catch (error) {
    if (error instanceof OpenAIConfigError) {
      throw error;
    }
    if (error instanceof z.ZodError) {
      const formattedError = formatValidationError(error);
      throw new OpenAIConfigError(
        `Environment validation failed:\n${formattedError}`
      );
    }
    throw new OpenAIConfigError(
      `Validation failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

// Keep the old function name for backward compatibility
export const validateEnvironmentVariables = validateEnvironment;

/**
 * Reset the cached client and configuration
 *
 * This is useful for testing or when environment variables change at runtime.
 * In production, the configuration should be set once and not changed.
 */
export function resetClient(): void {
  clientInstance = null;
  transcriptionClientInstance = null;
  citationsClientInstance = null;
  configCache = null;
  console.log('[OpenAI] Client and configuration cache cleared');
}

/**
 * Get a summary of the current configuration (safe for logging)
 *
 * @returns Object with non-sensitive configuration details
 */
export function getConfigurationSummary(): {
  provider: 'azure' | 'openai';
  endpoint?: string;
  apiVersion?: string;
  hasWhisperDeployment: boolean;
  hasGPT4Deployment: boolean;
} {
  const config = getConfiguration();

  return {
    provider: config.provider,
    endpoint: config.provider === 'azure' ? config.endpoint : undefined,
    apiVersion: config.provider === 'azure' ? config.apiVersion : undefined,
    hasWhisperDeployment: config.provider === 'azure' ? !!config.whisperDeployment : false,
    hasGPT4Deployment: config.provider === 'azure' ? !!config.gpt4Deployment : false,
  };
}

/**
 * Initialize configuration asynchronously with Key Vault support
 *
 * This function should be called during application startup to load
 * secrets from Azure Key Vault (if configured) before other services
 * attempt to use the OpenAI client.
 *
 * If Key Vault is not configured or unavailable, falls back to
 * environment variables automatically.
 *
 * @throws {OpenAIConfigError} If configuration is invalid
 *
 * @example
 * ```typescript
 * // In your app startup
 * await initializeConfiguration();
 * const client = getOpenAIClient();
 * ```
 */
export async function initializeConfiguration(): Promise<OpenAIConfig> {
  try {
    // Check Key Vault availability
    const keyVaultEnabled = await isKeyVaultAvailable();

    if (keyVaultEnabled) {
      console.log('[OpenAI] Loading configuration from Key Vault...');

      // Load from Key Vault with env var fallback
      const env = await loadEnvironmentVariablesAsync();
      const config = buildOpenAIConfig(env);

      // Update cache
      configCache = config;

      console.log('[OpenAI] Configuration loaded from Key Vault', {
        provider: config.provider,
        keyVault: getKeyVaultSummary(),
      });

      return config;
    } else {
      console.log('[OpenAI] Key Vault not available, using environment variables');
      return getConfiguration();
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      const formattedError = formatValidationError(error);
      throw new OpenAIConfigError(
        `Configuration validation failed:\n${formattedError}\n\n` +
        'Please ensure all required secrets are configured in Key Vault or environment variables.'
      );
    }
    throw error;
  }
}

/**
 * Initialize configuration and validate (async version of validateEnvironment)
 *
 * This is the recommended way to initialize the OpenAI configuration
 * in applications using Azure Key Vault.
 *
 * @throws {OpenAIConfigError} If configuration is invalid
 */
export async function initializeAndValidate(): Promise<void> {
  const config = await initializeConfiguration();

  // Additional warnings for optional but recommended fields
  if (config.provider === 'azure') {
    if (!config.whisperDeployment) {
      console.warn(
        '[OpenAI] Warning: AZURE_OPENAI_WHISPER_DEPLOYMENT not set. ' +
        'Whisper transcription will not work without this.'
      );
    }
    if (!config.gpt4Deployment) {
      console.warn(
        '[OpenAI] Warning: Analysis deployment not set. ' +
        'GPT analysis will not work without this.'
      );
    }
  }

  console.log('[OpenAI] Configuration initialized and validated successfully', {
    provider: config.provider,
    keyVault: getKeyVaultSummary(),
  });
}

// Re-export for backwards compatibility (other modules import from '@/lib/openai')
export { buildChatCompletionParams, type ReasoningEffort };

/**
 * Get Azure credentials for direct REST API calls
 *
 * The OpenAI SDK doesn't support all Azure features (like diarized_json format).
 * This function returns the raw credentials needed for direct fetch() calls.
 *
 * @returns Object with endpoint, apiKey, and apiVersion
 * @throws {OpenAIConfigError} If not using Azure or configuration is invalid
 */
export function getAzureCredentials(): {
  endpoint: string;
  apiKey: string;
  apiVersion: string;
} {
  const config = getConfiguration();

  if (config.provider !== 'azure') {
    throw new OpenAIConfigError(
      'Azure credentials requested but not using Azure OpenAI provider'
    );
  }

  return {
    endpoint: config.endpoint!,
    apiKey: config.apiKey,
    apiVersion: '2025-03-01-preview', // Required for diarize models
  };
}

/**
 * Generate a brief summary of transcript text using GPT
 *
 * Creates a concise 1-2 sentence summary capturing the main topic
 * and key points of the transcript.
 *
 * @param transcriptText - The full transcript text (will be truncated if too long)
 * @returns Promise resolving to the generated summary string
 * @throws {Error} If the API call fails
 *
 * @example
 * ```typescript
 * const summary = await generateTranscriptSummary(transcript.text);
 * // "Team discussed Q4 marketing budget allocation and approved $50K for social media campaigns."
 * ```
 */
export async function generateTranscriptSummary(transcriptText: string): Promise<string> {
  const client = getOpenAIClient();
  const deployment = getGPTAnalysisDeployment();

  // Truncate text to first 4000 chars to keep tokens reasonable
  const truncatedText = transcriptText.slice(0, 4000);

  try {
    const response = await client.chat.completions.create({
      model: deployment,
      messages: [
        {
          role: 'system',
          content: `You are a concise summarizer. Generate a 1-2 sentence summary of the transcript that captures:
- The main topic or purpose of the discussion
- Key decisions or outcomes (if any)

Keep it brief and informative. Do not start with "This transcript..." or "The meeting...". Write in a direct, professional style.`,
        },
        {
          role: 'user',
          content: truncatedText,
        },
      ],
      ...buildChatCompletionParams(deployment, 150, 0.3),
    });

    const summary = response.choices[0]?.message?.content?.trim();

    if (!summary) {
      console.warn('[OpenAI] Summary generation returned empty response');
      return '';
    }

    console.log('[OpenAI] Generated transcript summary:', {
      inputLength: truncatedText.length,
      summaryLength: summary.length,
    });

    return summary;
  } catch (error) {
    console.error('[OpenAI] Failed to generate transcript summary:', error);
    // Return empty string instead of throwing - summary is optional
    return '';
  }
}

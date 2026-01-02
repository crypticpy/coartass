/**
 * Configuration Validation Schemas
 *
 * Zod schemas for validating environment variables and OpenAI configuration.
 * Provides runtime validation with detailed error messages.
 * Supports loading secrets from Azure Key Vault with environment variable fallback.
 */

import { z } from 'zod';
import { getEnvironmentWithKeyVault } from '../azure-key-vault';

/**
 * Azure OpenAI API Version Schema
 * Validates API version format (YYYY-MM-DD or YYYY-MM-DD-preview)
 */
const azureApiVersionSchema = z
  .string()
  .regex(
    /^\d{4}-\d{2}-\d{2}(-preview)?$/,
    'API version must be in format YYYY-MM-DD or YYYY-MM-DD-preview'
  )
  .describe('Azure OpenAI API version');

/**
 * Azure OpenAI Endpoint Schema
 * Validates endpoint URL format
 */
const azureEndpointSchema = z
  .string()
  .url('Endpoint must be a valid URL')
  .refine(
    (url) => url.startsWith('https://'),
    'Endpoint must use HTTPS protocol'
  )
  .refine(
    (url) => url.includes('.openai.azure.com'),
    'Endpoint must be an Azure OpenAI endpoint (*.openai.azure.com)'
  )
  .describe('Azure OpenAI endpoint URL');

/**
 * API Key Schema
 * Validates API key format and minimum length
 */
const apiKeySchema = z
  .string()
  .min(20, 'API key must be at least 20 characters long')
  .trim()
  .describe('OpenAI API key');

/**
 * Deployment Name Schema
 * Validates Azure deployment names
 */
const deploymentNameSchema = z
  .string()
  .min(1, 'Deployment name cannot be empty')
  .max(64, 'Deployment name must be 64 characters or less')
  .regex(
    /^[a-zA-Z0-9-_.]+$/,
    'Deployment name can only contain letters, numbers, hyphens, underscores, and periods'
  )
  .describe('Azure deployment name');

/**
 * Organization ID Schema
 * Validates OpenAI organization ID format
 */
const organizationIdSchema = z
  .string()
  .regex(/^org-[a-zA-Z0-9]+$/, 'Organization ID must start with "org-"')
  .describe('OpenAI organization ID');

/**
 * Azure OpenAI Configuration Schema
 */
export const azureOpenAIConfigSchema = z.object({
  provider: z.literal('azure'),
  apiKey: apiKeySchema,
  endpoint: azureEndpointSchema,
  apiVersion: azureApiVersionSchema.default('2024-12-01-preview'),
  whisperDeployment: deploymentNameSchema.optional(),
  gpt4Deployment: deploymentNameSchema.optional(),
});

/**
 * Standard OpenAI Configuration Schema
 */
export const standardOpenAIConfigSchema = z.object({
  provider: z.literal('openai'),
  apiKey: apiKeySchema,
  organizationId: organizationIdSchema.optional(),
});

/**
 * Unified OpenAI Configuration Schema
 * Discriminated union based on provider type
 */
export const openAIConfigSchema = z.discriminatedUnion('provider', [
  azureOpenAIConfigSchema,
  standardOpenAIConfigSchema,
]);

/**
 * Azure Environment Variables Schema
 * All fields are optional to allow for standard OpenAI fallback
 */
export const azureEnvSchema = z.object({
  AZURE_OPENAI_API_KEY: z.string().optional(),
  AZURE_OPENAI_ENDPOINT: z.string().optional(),
  AZURE_OPENAI_API_VERSION: z.string().optional(),
  AZURE_OPENAI_WHISPER_DEPLOYMENT: z.string().optional(),
  AZURE_OPENAI_GPT4_DEPLOYMENT: z.string().optional(),
  AZURE_OPENAI_GPT5_DEPLOYMENT: z.string().optional(),
});

/**
 * Standard OpenAI Environment Variables Schema
 * All fields are optional to allow for Azure fallback
 */
export const standardEnvSchema = z.object({
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_ORGANIZATION_ID: z.string().optional(),
});

/**
 * Complete Environment Variables Schema
 * Combines both Azure and standard OpenAI variables
 */
export const environmentVariablesSchema = z.intersection(
  azureEnvSchema,
  standardEnvSchema
);

/**
 * Environment Variables with At Least One Provider Schema
 * Ensures either Azure or standard OpenAI credentials are provided
 */
export const validEnvironmentSchema = environmentVariablesSchema.refine(
  (env) => {
    const hasAzure = !!(env.AZURE_OPENAI_API_KEY && env.AZURE_OPENAI_ENDPOINT);
    const hasOpenAI = !!env.OPENAI_API_KEY;
    return hasAzure || hasOpenAI;
  },
  {
    message:
      'Missing OpenAI configuration. Please set either:\n' +
      '  - Azure OpenAI: AZURE_OPENAI_API_KEY and AZURE_OPENAI_ENDPOINT\n' +
      '  - Standard OpenAI: OPENAI_API_KEY',
  }
);

/**
 * Type inference from schemas
 */
export type AzureOpenAIConfig = z.infer<typeof azureOpenAIConfigSchema>;
export type StandardOpenAIConfig = z.infer<typeof standardOpenAIConfigSchema>;
export type OpenAIConfig = z.infer<typeof openAIConfigSchema>;
export type EnvironmentVariables = z.infer<typeof environmentVariablesSchema>;

/**
 * Validate environment variables
 *
 * @param env - Environment variables object (typically process.env)
 * @returns Validated environment variables
 * @throws {z.ZodError} If validation fails with detailed error messages
 *
 * @example
 * ```typescript
 * try {
 *   const env = validateEnvironmentVariables(process.env);
 *   console.log('Environment variables are valid');
 * } catch (error) {
 *   if (error instanceof z.ZodError) {
 *     console.error('Validation errors:', error.format());
 *   }
 * }
 * ```
 */
export function validateEnvironmentVariables(
  env: Record<string, string | undefined>
): EnvironmentVariables {
  return validEnvironmentSchema.parse({
    AZURE_OPENAI_API_KEY: env.AZURE_OPENAI_API_KEY,
    AZURE_OPENAI_ENDPOINT: env.AZURE_OPENAI_ENDPOINT,
    AZURE_OPENAI_API_VERSION: env.AZURE_OPENAI_API_VERSION,
    AZURE_OPENAI_WHISPER_DEPLOYMENT: env.AZURE_OPENAI_WHISPER_DEPLOYMENT,
    AZURE_OPENAI_GPT4_DEPLOYMENT: env.AZURE_OPENAI_GPT4_DEPLOYMENT,
    AZURE_OPENAI_GPT5_DEPLOYMENT: env.AZURE_OPENAI_GPT5_DEPLOYMENT,
    OPENAI_API_KEY: env.OPENAI_API_KEY,
    OPENAI_ORGANIZATION_ID: env.OPENAI_ORGANIZATION_ID,
  });
}

/**
 * Build and validate OpenAI configuration from environment variables
 *
 * @param env - Validated environment variables
 * @returns Validated OpenAI configuration
 * @throws {z.ZodError} If configuration validation fails
 *
 * @example
 * ```typescript
 * const env = validateEnvironmentVariables(process.env);
 * const config = buildOpenAIConfig(env);
 *
 * if (config.provider === 'azure') {
 *   console.log('Using Azure OpenAI at:', config.endpoint);
 * }
 * ```
 */
export function buildOpenAIConfig(env: EnvironmentVariables): OpenAIConfig {
  const hasAzure = !!(env.AZURE_OPENAI_API_KEY && env.AZURE_OPENAI_ENDPOINT);

  if (hasAzure) {
    const analysisDeployment =
      env.AZURE_OPENAI_GPT5_DEPLOYMENT ?? env.AZURE_OPENAI_GPT4_DEPLOYMENT;

    // Build and validate Azure configuration
    return azureOpenAIConfigSchema.parse({
      provider: 'azure',
      apiKey: env.AZURE_OPENAI_API_KEY,
      endpoint: env.AZURE_OPENAI_ENDPOINT,
      apiVersion: env.AZURE_OPENAI_API_VERSION || '2024-12-01-preview',
      whisperDeployment: env.AZURE_OPENAI_WHISPER_DEPLOYMENT,
      gpt4Deployment: analysisDeployment,
    });
  }

  // Build and validate standard OpenAI configuration
  return standardOpenAIConfigSchema.parse({
    provider: 'openai',
    apiKey: env.OPENAI_API_KEY,
    organizationId: env.OPENAI_ORGANIZATION_ID,
  });
}

/**
 * Validate deployment name
 *
 * @param deploymentName - Deployment name to validate
 * @returns Validated deployment name
 * @throws {z.ZodError} If validation fails
 *
 * @example
 * ```typescript
 * try {
 *   const deployment = validateDeploymentName('whisper-1');
 *   console.log('Valid deployment:', deployment);
 * } catch (error) {
 *   console.error('Invalid deployment name');
 * }
 * ```
 */
export function validateDeploymentName(deploymentName: string): string {
  return deploymentNameSchema.parse(deploymentName);
}

/**
 * Validate Azure API version
 *
 * @param apiVersion - API version to validate
 * @returns Validated API version
 * @throws {z.ZodError} If validation fails
 *
 * @example
 * ```typescript
 * const version = validateApiVersion('2024-08-01-preview');
 * ```
 */
export function validateApiVersion(apiVersion: string): string {
  return azureApiVersionSchema.parse(apiVersion);
}

/**
 * Validate Azure endpoint URL
 *
 * @param endpoint - Endpoint URL to validate
 * @returns Validated endpoint URL
 * @throws {z.ZodError} If validation fails
 *
 * @example
 * ```typescript
 * const endpoint = validateEndpoint('https://my-resource.openai.azure.com');
 * ```
 */
export function validateEndpoint(endpoint: string): string {
  return azureEndpointSchema.parse(endpoint);
}

/**
 * Safe validation that returns success/error result instead of throwing
 *
 * @param env - Environment variables to validate
 * @returns Result object with success flag and data or error
 *
 * @example
 * ```typescript
 * const result = safeValidateEnvironment(process.env);
 * if (result.success) {
 *   console.log('Valid config:', result.data);
 * } else {
 *   console.error('Validation errors:', result.error.format());
 * }
 * ```
 */
export function safeValidateEnvironment(
  env: Record<string, string | undefined>
): { success: true; data: EnvironmentVariables } | { success: false; error: z.ZodError } {
  const result = validEnvironmentSchema.safeParse({
    AZURE_OPENAI_API_KEY: env.AZURE_OPENAI_API_KEY,
    AZURE_OPENAI_ENDPOINT: env.AZURE_OPENAI_ENDPOINT,
    AZURE_OPENAI_API_VERSION: env.AZURE_OPENAI_API_VERSION,
    AZURE_OPENAI_WHISPER_DEPLOYMENT: env.AZURE_OPENAI_WHISPER_DEPLOYMENT,
    AZURE_OPENAI_GPT4_DEPLOYMENT: env.AZURE_OPENAI_GPT4_DEPLOYMENT,
    AZURE_OPENAI_GPT5_DEPLOYMENT: env.AZURE_OPENAI_GPT5_DEPLOYMENT,
    OPENAI_API_KEY: env.OPENAI_API_KEY,
    OPENAI_ORGANIZATION_ID: env.OPENAI_ORGANIZATION_ID,
  });

  if (result.success) {
    return { success: true, data: result.data };
  } else {
    return { success: false, error: result.error };
  }
}

/**
 * Format validation errors for user-friendly display
 *
 * @param error - Zod validation error
 * @returns Formatted error message
 *
 * @example
 * ```typescript
 * try {
 *   validateEnvironmentVariables(process.env);
 * } catch (error) {
 *   if (error instanceof z.ZodError) {
 *     console.error(formatValidationError(error));
 *   }
 * }
 * ```
 */
export function formatValidationError(error: z.ZodError): string {
  const formatted = error.format();
  const messages: string[] = [];

  function extractMessages(obj: Record<string, unknown>, path: string = ''): void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const errors = (obj as any)._errors;
    if (errors && Array.isArray(errors) && errors.length > 0) {
      messages.push(`${path}: ${errors.join(', ')}`);
    }

    for (const key in obj) {
      if (key !== '_errors' && typeof obj[key] === 'object' && obj[key] !== null) {
        extractMessages(obj[key] as Record<string, unknown>, path ? `${path}.${key}` : key);
      }
    }
  }

  extractMessages(formatted as unknown as Record<string, unknown>);
  return messages.join('\n');
}

/**
 * List of environment variable names used for configuration
 */
const CONFIG_ENV_VARS = [
  'AZURE_OPENAI_API_KEY',
  'AZURE_OPENAI_ENDPOINT',
  'AZURE_OPENAI_API_VERSION',
  'AZURE_OPENAI_WHISPER_DEPLOYMENT',
  'AZURE_OPENAI_GPT4_DEPLOYMENT',
  'AZURE_OPENAI_GPT5_DEPLOYMENT',
  'OPENAI_API_KEY',
  'OPENAI_ORGANIZATION_ID',
];

/**
 * Load environment variables asynchronously with Key Vault support
 *
 * This function first tries to load secrets from Azure Key Vault,
 * then falls back to environment variables for any missing values.
 *
 * @returns Promise with validated environment variables
 * @throws {z.ZodError} If validation fails
 *
 * @example
 * ```typescript
 * const env = await loadEnvironmentVariablesAsync();
 * const config = buildOpenAIConfig(env);
 * ```
 */
export async function loadEnvironmentVariablesAsync(): Promise<EnvironmentVariables> {
  // Load from Key Vault (with env var fallback)
  const envWithKeyVault = await getEnvironmentWithKeyVault(CONFIG_ENV_VARS);

  // Validate the combined configuration
  return validEnvironmentSchema.parse(envWithKeyVault);
}

/**
 * Safe async validation that returns success/error result
 *
 * @returns Result object with success flag and data or error
 */
export async function safeLoadEnvironmentAsync(): Promise<
  { success: true; data: EnvironmentVariables } | { success: false; error: z.ZodError }
> {
  try {
    const envWithKeyVault = await getEnvironmentWithKeyVault(CONFIG_ENV_VARS);
    const result = validEnvironmentSchema.safeParse(envWithKeyVault);

    if (result.success) {
      return { success: true, data: result.data };
    } else {
      return { success: false, error: result.error };
    }
  } catch (error) {
    // Handle Key Vault connection errors
    console.warn('[Config] Key Vault unavailable, falling back to environment variables:', error);

    // Fall back to synchronous validation with process.env
    const result = safeValidateEnvironment(process.env as Record<string, string | undefined>);
    return result;
  }
}

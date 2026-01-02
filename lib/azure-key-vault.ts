/**
 * Azure Key Vault Integration
 *
 * Provides secure access to secrets stored in Azure Key Vault using Managed Identity
 * when running in Azure Container Apps, with automatic fallback to environment
 * variables for local development.
 *
 * Features:
 * - Singleton SecretClient with caching (5-minute TTL)
 * - ManagedIdentityCredential in production (Azure Container Apps)
 * - DefaultAzureCredential for local development (supports Azure CLI, VS Code, etc.)
 * - Graceful fallback to environment variables when Key Vault is unavailable
 * - Cache invalidation support for secret rotation
 */

import { SecretClient } from '@azure/keyvault-secrets';
import {
  DefaultAzureCredential,
  ManagedIdentityCredential,
} from '@azure/identity';

/**
 * Cache TTL in milliseconds (5 minutes)
 */
const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Mapping from environment variable names to Key Vault secret names
 * Key Vault secrets use lowercase with hyphens (Azure convention)
 */
export const ENV_TO_SECRET_MAP: Record<string, string> = {
  AZURE_OPENAI_API_KEY: 'azure-openai-api-key',
  AZURE_OPENAI_ENDPOINT: 'azure-openai-endpoint',
  AZURE_OPENAI_API_VERSION: 'azure-openai-api-version',
  AZURE_OPENAI_WHISPER_DEPLOYMENT: 'azure-openai-whisper-deployment',
  AZURE_OPENAI_GPT4_DEPLOYMENT: 'azure-openai-gpt4-deployment',
  AZURE_OPENAI_GPT5_DEPLOYMENT: 'azure-openai-gpt5-deployment',
  AZURE_OPENAI_EXTENDED_GPT_DEPLOYMENT: 'azure-openai-extended-gpt-deployment',
  OPENAI_API_KEY: 'openai-api-key',
  OPENAI_ORGANIZATION_ID: 'openai-organization-id',
};

/**
 * Cached secret with expiration
 */
interface CachedSecret {
  value: string;
  expiresAt: number;
}

/**
 * Secret cache storage
 */
const secretsCache = new Map<string, CachedSecret>();

/**
 * Singleton SecretClient instance
 */
let secretClientInstance: SecretClient | null = null;

/**
 * Flag to track if Key Vault is available
 */
let keyVaultAvailable: boolean | null = null;

/**
 * Get Key Vault URL from environment
 */
function getKeyVaultUrl(): string | undefined {
  return process.env.AZURE_KEY_VAULT_URL;
}

/**
 * Determine if running in Azure Container Apps (production)
 * Checks for WEBSITE_SITE_NAME which is set by Azure App Service/Container Apps
 */
function isRunningInAzure(): boolean {
  return !!(
    process.env.WEBSITE_SITE_NAME ||
    process.env.CONTAINER_APP_NAME ||
    process.env.AZURE_CLIENT_ID
  );
}

/**
 * Initialize the Secret Client
 *
 * Uses ManagedIdentityCredential in Azure, DefaultAzureCredential for local dev
 */
function getSecretClient(): SecretClient | null {
  if (secretClientInstance) {
    return secretClientInstance;
  }

  const vaultUrl = getKeyVaultUrl();
  if (!vaultUrl) {
    console.log('[KeyVault] AZURE_KEY_VAULT_URL not set, using environment variables only');
    return null;
  }

  try {
    // Use ManagedIdentityCredential in production for better security
    // Use DefaultAzureCredential for local development (supports Azure CLI, VS Code, etc.)
    const credential = isRunningInAzure()
      ? new ManagedIdentityCredential()
      : new DefaultAzureCredential();

    secretClientInstance = new SecretClient(vaultUrl, credential);

    console.log('[KeyVault] Initialized SecretClient', {
      vaultUrl,
      authMethod: isRunningInAzure() ? 'ManagedIdentity' : 'DefaultAzureCredential',
    });

    return secretClientInstance;
  } catch (error) {
    console.error('[KeyVault] Failed to initialize SecretClient:', error);
    return null;
  }
}

/**
 * Check if Key Vault is available and accessible
 *
 * @returns true if Key Vault is configured and accessible
 */
export async function isKeyVaultAvailable(): Promise<boolean> {
  // Return cached result if available
  if (keyVaultAvailable !== null) {
    return keyVaultAvailable;
  }

  const client = getSecretClient();
  if (!client) {
    keyVaultAvailable = false;
    return false;
  }

  try {
    // Try to list secrets (limited to 1) to verify access
    const iterator = client.listPropertiesOfSecrets();
    await iterator.next();
    keyVaultAvailable = true;
    console.log('[KeyVault] Key Vault is available and accessible');
    return true;
  } catch (error) {
    keyVaultAvailable = false;
    console.warn('[KeyVault] Key Vault is not accessible, falling back to environment variables:', error);
    return false;
  }
}

/**
 * Get a secret from Key Vault with caching
 *
 * Falls back to environment variable if Key Vault is unavailable
 *
 * @param secretName - The name of the secret in Key Vault
 * @returns The secret value, or undefined if not found
 */
export async function getSecret(secretName: string): Promise<string | undefined> {
  // Check cache first
  const cached = secretsCache.get(secretName);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const client = getSecretClient();

  if (client) {
    try {
      const secret = await client.getSecret(secretName);
      if (secret.value) {
        // Cache the secret
        secretsCache.set(secretName, {
          value: secret.value,
          expiresAt: Date.now() + CACHE_TTL_MS,
        });
        return secret.value;
      }
    } catch {
      // Secret not found or access denied - fall back to environment variable
      console.debug(`[KeyVault] Secret '${secretName}' not found in Key Vault, checking environment`);
    }
  }

  // Find the corresponding environment variable name
  const envVarName = Object.entries(ENV_TO_SECRET_MAP).find(
    ([, kvName]) => kvName === secretName
  )?.[0];

  if (envVarName) {
    return process.env[envVarName];
  }

  return undefined;
}

/**
 * Get multiple secrets from Key Vault with caching
 *
 * @param secretNames - Array of secret names to retrieve
 * @returns Object mapping secret names to their values
 */
export async function getSecrets(
  secretNames: string[]
): Promise<Record<string, string | undefined>> {
  const results: Record<string, string | undefined> = {};

  // Fetch all secrets in parallel
  await Promise.all(
    secretNames.map(async (name) => {
      results[name] = await getSecret(name);
    })
  );

  return results;
}

/**
 * Get environment variables with Key Vault override
 *
 * Attempts to load secrets from Key Vault first, falls back to environment variables.
 * This is the main function to use for loading configuration.
 *
 * @param envVarNames - Array of environment variable names to load
 * @returns Object mapping environment variable names to their values
 */
export async function getEnvironmentWithKeyVault(
  envVarNames: string[]
): Promise<Record<string, string | undefined>> {
  const results: Record<string, string | undefined> = {};

  await Promise.all(
    envVarNames.map(async (envVar) => {
      const secretName = ENV_TO_SECRET_MAP[envVar];
      if (secretName) {
        // Try Key Vault first
        const kvValue = await getSecret(secretName);
        if (kvValue) {
          results[envVar] = kvValue;
          return;
        }
      }
      // Fall back to environment variable
      results[envVar] = process.env[envVar];
    })
  );

  return results;
}

/**
 * Clear the secrets cache
 *
 * Useful for testing or when secrets are known to have been rotated
 */
export function clearSecretsCache(): void {
  secretsCache.clear();
  console.log('[KeyVault] Secrets cache cleared');
}

/**
 * Reset the Key Vault client
 *
 * Useful for testing or when the Key Vault URL changes
 */
export function resetKeyVaultClient(): void {
  secretClientInstance = null;
  keyVaultAvailable = null;
  clearSecretsCache();
  console.log('[KeyVault] Client reset');
}

/**
 * Get configuration summary (safe for logging)
 *
 * @returns Object with non-sensitive Key Vault configuration details
 */
export function getKeyVaultSummary(): {
  enabled: boolean;
  vaultUrl?: string;
  authMethod: 'ManagedIdentity' | 'DefaultAzureCredential' | 'none';
  cacheSize: number;
} {
  const vaultUrl = getKeyVaultUrl();

  return {
    enabled: !!vaultUrl,
    vaultUrl: vaultUrl ? new URL(vaultUrl).hostname : undefined,
    authMethod: vaultUrl
      ? isRunningInAzure()
        ? 'ManagedIdentity'
        : 'DefaultAzureCredential'
      : 'none',
    cacheSize: secretsCache.size,
  };
}

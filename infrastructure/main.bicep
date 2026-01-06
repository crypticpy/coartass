// ============================================================================
// Austin RTASS - Azure Infrastructure
// ============================================================================
// Main Bicep deployment template for Azure Container Apps
//
// Resources deployed:
// - Azure Container Registry (ACR)
// - Container Apps Environment
// - Container App (Austin RTASS)
// - Key Vault (optional, for secrets management)
// - Log Analytics Workspace (for monitoring)
//
// Usage:
//   az deployment group create \
//     --resource-group rg-aph-cognitive-sandbox-dev-scus-01 \
//     --template-file main.bicep \
//     --parameters parameters/prod.bicepparam
// ============================================================================

// Deploys to resource group scope (default)

// ============================================================================
// Parameters
// ============================================================================

@description('Environment name (dev, staging, prod)')
@allowed(['dev', 'staging', 'prod'])
param environment string = 'dev'

@description('Azure region for all resources (defaults to resource group location)')
param location string = resourceGroup().location

@description('Base name for all resources')
@minLength(3)
@maxLength(20)
param baseName string = 'austin-rtass'

@description('Container image tag to deploy')
param imageTag string = 'latest'

@description('Enable Key Vault integration')
param enableKeyVault bool = true

@description('Azure OpenAI endpoint URL')
@secure()
param azureOpenAIEndpoint string = ''

@description('Azure OpenAI API key')
@secure()
param azureOpenAIApiKey string = ''

@description('Azure OpenAI API version')
param azureOpenAIApiVersion string = '2024-12-01-preview'

@description('Azure OpenAI Whisper deployment name')
param azureOpenAIWhisperDeployment string = ''

@description('Azure OpenAI GPT deployment name')
param azureOpenAIGPTDeployment string = ''

@description('Azure OpenAI extended-context GPT deployment name (optional, for long transcripts)')
param azureOpenAIExtendedGPTDeployment string = ''

@description('Reasoning effort for analysis models that support it (low, medium, high)')
@allowed([
  'low'
  'medium'
  'high'
])
param analysisReasoningEffort string = 'medium'

@description('Max output tokens for analysis responses (used to reduce latency/timeouts)')
@minValue(256)
@maxValue(32000)
param analysisMaxOutputTokens int = 4096

@description('Tags to apply to all resources')
param tags object = {
  project: 'austin-rtass'
  environment: environment
  managedBy: 'bicep'
}

@description('CORS allowed origins for the Container App. Empty array disables CORS (recommended for production if accessed via same-origin). Set to specific domain(s) if cross-origin access is required.')
param corsAllowedOrigins array = []

@description('Whether the Container App should be publicly accessible (external ingress)')
param externalIngress bool = true

// ============================================================================
// Variables
// ============================================================================

var acrName = replace('acr${baseName}${environment}', '-', '')
// Key Vault names must be 3-24 characters. Use shorter environment suffix.
var envSuffix = environment == 'staging' ? 'stg' : environment == 'prod' ? 'prd' : 'dev'
var keyVaultName = 'kv-${take(baseName, 15)}-${envSuffix}'
var containerAppEnvName = 'cae-${baseName}-${environment}'
var containerAppName = 'ca-${baseName}-${environment}'
var logAnalyticsName = 'log-${baseName}-${environment}'

// ============================================================================
// Log Analytics Workspace
// ============================================================================

module logAnalytics 'modules/log-analytics.bicep' = {
  name: 'logAnalytics'
  params: {
    name: logAnalyticsName
    location: location
    tags: tags
  }
}

// ============================================================================
// Container Registry
// ============================================================================

module acr 'modules/container-registry.bicep' = {
  name: 'containerRegistry'
  params: {
    name: acrName
    location: location
    tags: tags
    sku: environment == 'prod' ? 'Standard' : 'Basic'
  }
}

// ============================================================================
// Key Vault (Optional)
// ============================================================================

module keyVault 'modules/key-vault.bicep' = if (enableKeyVault) {
  name: 'keyVault'
  params: {
    name: keyVaultName
    location: location
    tags: tags
    // Secrets will be added after deployment via az keyvault secret set
  }
}

// ============================================================================
// Container Apps Environment
// ============================================================================

module containerAppEnv 'modules/container-app-environment.bicep' = {
  name: 'containerAppEnvironment'
  params: {
    name: containerAppEnvName
    location: location
    tags: tags
    logAnalyticsWorkspaceId: logAnalytics.outputs.workspaceId
    logAnalyticsWorkspaceKey: logAnalytics.outputs.workspaceKey
  }
}

// ============================================================================
// Container App
// ============================================================================

module containerApp 'modules/container-app.bicep' = {
  name: 'containerApp'
  params: {
    name: containerAppName
    location: location
    tags: tags
    containerAppEnvironmentId: containerAppEnv.outputs.environmentId
    containerRegistryName: acr.outputs.registryName
    containerRegistryLoginServer: acr.outputs.loginServer
    imageTag: imageTag
    keyVaultUri: enableKeyVault ? keyVault!.outputs.vaultUri : ''
    externalIngress: externalIngress

    // Environment variables (non-secrets go here)
    environmentVariables: [
      {
        name: 'NODE_ENV'
        value: 'production'
      }
      {
        name: 'AZURE_OPENAI_API_VERSION'
        value: azureOpenAIApiVersion
      }
      {
        name: 'AZURE_OPENAI_WHISPER_DEPLOYMENT'
        value: azureOpenAIWhisperDeployment
      }
      {
        name: 'AZURE_OPENAI_GPT4_DEPLOYMENT'
        value: azureOpenAIGPTDeployment
      }
      {
        name: 'AZURE_OPENAI_GPT5_DEPLOYMENT'
        value: azureOpenAIGPTDeployment
      }
      {
        name: 'AZURE_OPENAI_EXTENDED_GPT_DEPLOYMENT'
        value: azureOpenAIExtendedGPTDeployment
      }
      {
        name: 'AZURE_OPENAI_REASONING_EFFORT'
        value: analysisReasoningEffort
      }
      {
        name: 'ANALYSIS_MAX_OUTPUT_TOKENS'
        value: string(analysisMaxOutputTokens)
      }
    ]

    // Secret references (from Key Vault or direct)
    secrets: enableKeyVault ? [
      {
        name: 'azure-openai-api-key'
        keyVaultUrl: '${keyVault!.outputs.vaultUri}secrets/azure-openai-api-key'
        identity: 'system'
      }
      {
        name: 'azure-openai-endpoint'
        keyVaultUrl: '${keyVault!.outputs.vaultUri}secrets/azure-openai-endpoint'
        identity: 'system'
      }
    ] : [
      {
        name: 'azure-openai-api-key'
        value: azureOpenAIApiKey
      }
      {
        name: 'azure-openai-endpoint'
        value: azureOpenAIEndpoint
      }
    ]

    // Secret environment variable references
    secretEnvironmentVariables: [
      {
        name: 'AZURE_OPENAI_API_KEY'
        secretRef: 'azure-openai-api-key'
      }
      {
        name: 'AZURE_OPENAI_ENDPOINT'
        secretRef: 'azure-openai-endpoint'
      }
    ]

    // CORS configuration - defaults to disabled (empty array)
    // For production: leave empty if same-origin access only
    // If cross-origin needed: set to specific domains like ['https://example.com']
    corsAllowedOrigins: corsAllowedOrigins
  }
}

// ============================================================================
// Outputs
// ============================================================================

output resourceGroupName string = resourceGroup().name
output containerRegistryName string = acr.outputs.registryName
output containerRegistryLoginServer string = acr.outputs.loginServer
output containerAppName string = containerAppName
output containerAppFqdn string = containerApp.outputs.fqdn
output containerAppUrl string = 'https://${containerApp.outputs.fqdn}'
output keyVaultUri string = enableKeyVault ? keyVault!.outputs.vaultUri : ''

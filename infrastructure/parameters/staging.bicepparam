// ============================================================================
// Staging Environment Parameters
// ============================================================================
// Use this file for staging deployments:
//   az deployment group create \
//     --resource-group rg-aph-cognitive-sandbox-dev-scus-01 \
//     --template-file main.bicep \
//     --parameters parameters/staging.bicepparam
// ============================================================================

using '../main.bicep'

param environment = 'staging'
// Location defaults to resource group location (southcentralus)
param baseName = 'austin-rtass'
param imageTag = 'latest'
param enableKeyVault = true
param externalIngress = true

// Azure OpenAI Configuration
param azureOpenAIApiVersion = '2024-12-01-preview'
param azureOpenAIWhisperDeployment = 'gpt-4o-transcribe-diarize'
param azureOpenAIGPTDeployment = 'gpt-5'
param azureOpenAIExtendedGPTDeployment = ''
param analysisReasoningEffort = 'medium'
param analysisMaxOutputTokens = 4096

// Staging-specific tags
param tags = {
  project: 'austin-rtass'
  environment: 'staging'
  managedBy: 'bicep'
  criticality: 'medium'
}

// Note: After deployment, add secrets to Key Vault:
//   az keyvault secret set --vault-name kv-austin-rtass-stg \
//     --name azure-openai-api-key --value 'your-key'
//   az keyvault secret set --vault-name kv-austin-rtass-stg \
//     --name azure-openai-endpoint --value 'https://your-endpoint.openai.azure.com/'

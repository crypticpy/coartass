// ============================================================================
// Production Environment Parameters
// ============================================================================
// Use this file for production deployments:
//   az deployment group create \
//     --resource-group rg-aph-cognitive-sandbox-dev-scus-01 \
//     --template-file main.bicep \
//     --parameters parameters/prod.bicepparam
// ============================================================================

using '../main.bicep'

param environment = 'prod'
// Location defaults to resource group location (southcentralus)
param baseName = 'mtranscriber'
param imageTag = 'latest'
param enableKeyVault = true

// Azure OpenAI Configuration
param azureOpenAIApiVersion = '2024-08-01-preview'
param azureOpenAIWhisperDeployment = 'whisper-1'
param azureOpenAIGPTDeployment = 'gpt-4o'

// Production-specific tags
param tags = {
  project: 'meeting-transcriber'
  environment: 'prod'
  managedBy: 'bicep'
  criticality: 'high'
}

// Note: After deployment, add secrets to Key Vault:
//   az keyvault secret set --vault-name kv-mtranscriber-prd \
//     --name azure-openai-api-key --value 'your-key'
//   az keyvault secret set --vault-name kv-mtranscriber-prd \
//     --name azure-openai-endpoint --value 'https://your-endpoint.openai.azure.com/'

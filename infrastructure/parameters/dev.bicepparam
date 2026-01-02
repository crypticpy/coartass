// ============================================================================
// Development Environment Parameters
// ============================================================================
// Use this file for development deployments:
//   az deployment group create \
//     --resource-group rg-aph-cognitive-sandbox-dev-scus-01 \
//     --template-file main.bicep \
//     --parameters parameters/dev.bicepparam
// ============================================================================

using '../main.bicep'

param environment = 'dev'
// Location defaults to resource group location (southcentralus)
param baseName = 'mtranscriber'
param imageTag = 'latest'
param enableKeyVault = true

// Azure OpenAI Configuration
param azureOpenAIApiVersion = '2024-08-01-preview'
param azureOpenAIWhisperDeployment = 'whisper-1'
param azureOpenAIGPTDeployment = 'gpt-4o'

// Note: After deployment, add secrets to Key Vault:
//   az keyvault secret set --vault-name kv-mtranscriber-dev \
//     --name azure-openai-api-key --value 'your-key'
//   az keyvault secret set --vault-name kv-mtranscriber-dev \
//     --name azure-openai-endpoint --value 'https://your-endpoint.openai.azure.com/'

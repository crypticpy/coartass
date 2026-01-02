// ============================================================================
// Azure Container App Module
// ============================================================================
// Deploys the Meeting Transcriber application as a Container App
// ============================================================================

@description('Name of the Container App')
param name string

@description('Azure region')
param location string

@description('Resource tags')
param tags object = {}

@description('Container Apps Environment resource ID')
param containerAppEnvironmentId string

@description('Container Registry name')
param containerRegistryName string

@description('Container Registry login server')
param containerRegistryLoginServer string

@description('Image tag to deploy')
param imageTag string = 'latest'

@description('Key Vault URI for secrets (empty to disable)')
param keyVaultUri string = ''

@description('Environment variables (non-secret)')
param environmentVariables array = []

@description('Secrets configuration')
param secrets array = []

@description('Secret environment variable references')
param secretEnvironmentVariables array = []

@description('Minimum replicas')
@minValue(0)
@maxValue(30)
param minReplicas int = 1

@description('Maximum replicas')
@minValue(1)
@maxValue(30)
param maxReplicas int = 3

@description('CPU allocation')
param cpu string = '0.5'

@description('Memory allocation')
param memory string = '1Gi'

@description('Whether ingress is external (public) or internal (VNet only)')
param externalIngress bool = false

@description('CORS allowed origins. Use specific domains in production, empty array disables CORS.')
param corsAllowedOrigins array = []

// ============================================================================
// Variables
// ============================================================================

var imageName = '${containerRegistryLoginServer}/meeting-transcriber:${imageTag}'
var useKeyVault = !empty(keyVaultUri)

// CORS configuration: use provided origins or disable if empty
// In production, this should be set to the specific application domain(s)
var corsEnabled = !empty(corsAllowedOrigins)
var corsConfig = corsEnabled ? {
  allowedOrigins: corsAllowedOrigins
  allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
  maxAge: 86400
} : null

// Transform secret environment variables to proper format
var secretEnvVarsFormatted = [for secretEnvVar in secretEnvironmentVariables: {
  name: secretEnvVar.name
  secretRef: secretEnvVar.secretRef
}]

// Build combined environment variables
var allEnvVars = concat(environmentVariables, secretEnvVarsFormatted)

// ============================================================================
// Container App
// ============================================================================

resource containerApp 'Microsoft.App/containerApps@2023-05-01' = {
  name: name
  location: location
  tags: tags
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    managedEnvironmentId: containerAppEnvironmentId
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: {
        external: externalIngress
        targetPort: 3000
        transport: 'http'
        allowInsecure: false
        traffic: [
          {
            latestRevision: true
            weight: 100
          }
        ]
        // CORS policy: only applied if corsAllowedOrigins is provided
        // In production, pass specific domain(s) like ['https://transcriber.cityofaustin.gov']
        // Omitting corsPolicy or passing empty origins disables CORS (most restrictive)
        corsPolicy: corsConfig
      }
      registries: [
        {
          server: containerRegistryLoginServer
          identity: 'system'
        }
      ]
      secrets: secrets
    }
    template: {
      containers: [
        {
          name: 'meeting-transcriber'
          image: imageName
          resources: {
            cpu: json(cpu)
            memory: memory
          }
          env: allEnvVars
          probes: [
            {
              type: 'Liveness'
              httpGet: {
                path: '/api/health'
                port: 3000
                scheme: 'HTTP'
              }
              initialDelaySeconds: 30
              periodSeconds: 30
              timeoutSeconds: 5
              failureThreshold: 3
            }
            {
              type: 'Readiness'
              httpGet: {
                path: '/api/health'
                port: 3000
                scheme: 'HTTP'
              }
              initialDelaySeconds: 10
              periodSeconds: 10
              timeoutSeconds: 3
              failureThreshold: 3
            }
          ]
        }
      ]
      scale: {
        minReplicas: minReplicas
        maxReplicas: maxReplicas
        rules: [
          {
            name: 'http-scale-rule'
            http: {
              metadata: {
                concurrentRequests: '100'
              }
            }
          }
        ]
      }
    }
  }
}

// ============================================================================
// Role Assignments
// ============================================================================

// Grant Container App access to pull images from ACR
resource acrPullRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(containerApp.id, containerRegistryName, 'acrpull')
  scope: resourceGroup()
  properties: {
    principalId: containerApp.identity.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '7f951dda-4ed3-4680-a7ca-43fe172d538d') // AcrPull
  }
}

// Grant Container App access to Key Vault secrets (if enabled)
resource keyVaultSecretsUser 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (useKeyVault) {
  name: guid(containerApp.id, 'keyvault', 'secretsuser')
  scope: resourceGroup()
  properties: {
    principalId: containerApp.identity.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '4633458b-17de-408a-b874-0445c86b69e6') // Key Vault Secrets User
  }
}

// ============================================================================
// Outputs
// ============================================================================

output appId string = containerApp.id
output appName string = containerApp.name
output fqdn string = containerApp.properties.configuration.ingress.fqdn
output principalId string = containerApp.identity.principalId
output latestRevisionName string = containerApp.properties.latestRevisionName

// ============================================================================
// Azure Container Registry Module
// ============================================================================
// Provides a private container registry for storing Docker images
// ============================================================================

@description('Name of the container registry (must be globally unique)')
@minLength(5)
@maxLength(50)
param name string

@description('Azure region')
param location string

@description('Resource tags')
param tags object = {}

@description('SKU tier')
@allowed(['Basic', 'Standard', 'Premium'])
param sku string = 'Basic'

@description('Enable admin user for ACR')
param adminUserEnabled bool = true

// ============================================================================
// Container Registry
// ============================================================================

resource acr 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: name
  location: location
  tags: tags
  sku: {
    name: sku
  }
  properties: {
    adminUserEnabled: adminUserEnabled
    publicNetworkAccess: 'Enabled'
    policies: {
      retentionPolicy: {
        status: sku == 'Premium' ? 'enabled' : 'disabled'
        days: 30
      }
      trustPolicy: {
        status: 'disabled'
        type: 'Notary'
      }
    }
  }
}

// ============================================================================
// Outputs
// ============================================================================

output registryId string = acr.id
output registryName string = acr.name
output loginServer string = acr.properties.loginServer
output adminUsername string = adminUserEnabled ? acr.listCredentials().username : ''

// ============================================================================
// Log Analytics Workspace Module
// ============================================================================
// Provides centralized logging and monitoring for Container Apps
// ============================================================================

@description('Name of the Log Analytics workspace')
param name string

@description('Azure region')
param location string

@description('Resource tags')
param tags object = {}

@description('Log retention in days')
@minValue(30)
@maxValue(730)
param retentionInDays int = 30

@description('SKU name')
@allowed(['Free', 'PerGB2018', 'Standalone'])
param sku string = 'PerGB2018'

// ============================================================================
// Log Analytics Workspace
// ============================================================================

resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2022-10-01' = {
  name: name
  location: location
  tags: tags
  properties: {
    sku: {
      name: sku
    }
    retentionInDays: retentionInDays
    features: {
      enableLogAccessUsingOnlyResourcePermissions: true
    }
    workspaceCapping: {
      dailyQuotaGb: -1 // No cap
    }
  }
}

// ============================================================================
// Outputs
// ============================================================================

output workspaceId string = logAnalytics.id
output workspaceKey string = logAnalytics.listKeys().primarySharedKey
output customerId string = logAnalytics.properties.customerId

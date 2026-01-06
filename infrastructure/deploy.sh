#!/usr/bin/env bash
# ============================================================================
# Austin RTASS - Azure Deployment Script
# ============================================================================
# Deploys the infrastructure and application to Azure
#
# Prerequisites:
#   - Azure CLI installed and logged in (az login)
#   - Bicep CLI installed (az bicep install)
#   - Docker installed (for image building)
#
# Usage:
#   ./deploy.sh [dev|staging|prod] [--build] [--push]
#
# Examples:
#   ./deploy.sh dev              # Deploy infrastructure only
#   ./deploy.sh prod --build     # Build Docker image and deploy
#   ./deploy.sh prod --push      # Build, push to ACR, and deploy
# ============================================================================

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
ENVIRONMENT="${1:-dev}"
BUILD_IMAGE=false
PUSH_IMAGE=false
PARAM_FILE="parameters/${ENVIRONMENT}.bicepparam"

# Target resource group (existing)
RESOURCE_GROUP="rg-aph-cognitive-sandbox-dev-scus-01"

# Parse arguments
shift || true
while [[ $# -gt 0 ]]; do
    case $1 in
        --build)
            BUILD_IMAGE=true
            shift
            ;;
        --push)
            BUILD_IMAGE=true
            PUSH_IMAGE=true
            shift
            ;;
        --resource-group)
            RESOURCE_GROUP="$2"
            shift 2
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            exit 1
            ;;
    esac
done

# Validate environment
if [[ ! "$ENVIRONMENT" =~ ^(dev|staging|prod)$ ]]; then
    echo -e "${RED}Error: Environment must be dev, staging, or prod${NC}"
    exit 1
fi

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Austin RTASS - Azure Deployment${NC}"
echo -e "${BLUE}========================================${NC}"
echo -e "Environment:    ${GREEN}$ENVIRONMENT${NC}"
echo -e "Resource Group: ${GREEN}$RESOURCE_GROUP${NC}"
echo -e "Build Image:    ${GREEN}$BUILD_IMAGE${NC}"
echo -e "Push Image:     ${GREEN}$PUSH_IMAGE${NC}"
echo -e "Parameters:     ${GREEN}$PARAM_FILE${NC}"
echo ""

# Check prerequisites
echo -e "${YELLOW}Checking prerequisites...${NC}"

if ! command -v az &> /dev/null; then
    echo -e "${RED}Error: Azure CLI not found. Install from https://aka.ms/installazurecli${NC}"
    exit 1
fi

if ! az account show &> /dev/null; then
    echo -e "${RED}Error: Not logged in to Azure. Run 'az login' first${NC}"
    exit 1
fi

# Get current Azure context
SUBSCRIPTION=$(az account show --query name -o tsv)
echo -e "Subscription: ${GREEN}$SUBSCRIPTION${NC}"

# Verify resource group exists
if ! az group show --name "$RESOURCE_GROUP" &> /dev/null; then
    echo -e "${RED}Error: Resource group '$RESOURCE_GROUP' not found${NC}"
    exit 1
fi

RG_LOCATION=$(az group show --name "$RESOURCE_GROUP" --query location -o tsv)
echo -e "RG Location:  ${GREEN}$RG_LOCATION${NC}"
echo ""

# Confirm deployment
read -p "Deploy to $ENVIRONMENT in $RESOURCE_GROUP? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Deployment cancelled${NC}"
    exit 0
fi

# Change to infrastructure directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if [[ ! -f "$PARAM_FILE" ]]; then
    echo -e "${RED}Error: Parameters file not found: $PARAM_FILE${NC}"
    echo -e "${YELLOW}Available parameter files:${NC}"
    ls -1 parameters/*.bicepparam 2>/dev/null || true
    exit 1
fi

# Best-effort extraction of baseName for display (do not depend on parsing for deploy logic)
BASE_NAME=$(sed -n "s/^param baseName = '\\(.*\\)'/\\1/p" "$PARAM_FILE" | head -n 1)
BASE_NAME="${BASE_NAME:-austin-rtass}"

# ============================================================================
# Deploy Infrastructure
# ============================================================================

echo ""
echo -e "${YELLOW}Deploying infrastructure...${NC}"

DEPLOYMENT_NAME="${BASE_NAME}-${ENVIRONMENT}-$(date +%Y%m%d%H%M%S)"

az deployment group create \
    --name "$DEPLOYMENT_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --template-file main.bicep \
    --parameters "$PARAM_FILE" \
    --output table

# Get deployment outputs
echo ""
echo -e "${YELLOW}Getting deployment outputs...${NC}"

ACR_NAME=$(az deployment group show --name "$DEPLOYMENT_NAME" --resource-group "$RESOURCE_GROUP" --query 'properties.outputs.containerRegistryLoginServer.value' -o tsv 2>/dev/null || echo "")
CONTAINER_APP_NAME=$(az deployment group show --name "$DEPLOYMENT_NAME" --resource-group "$RESOURCE_GROUP" --query 'properties.outputs.containerAppName.value' -o tsv 2>/dev/null || echo "")
APP_URL=$(az deployment group show --name "$DEPLOYMENT_NAME" --resource-group "$RESOURCE_GROUP" --query 'properties.outputs.containerAppUrl.value' -o tsv 2>/dev/null || echo "")
KEY_VAULT_URI=$(az deployment group show --name "$DEPLOYMENT_NAME" --resource-group "$RESOURCE_GROUP" --query 'properties.outputs.keyVaultUri.value' -o tsv 2>/dev/null || echo "")

echo -e "Resource Group: ${GREEN}$RESOURCE_GROUP${NC}"
echo -e "ACR Server:     ${GREEN}$ACR_NAME${NC}"
echo -e "Container App:  ${GREEN}${CONTAINER_APP_NAME:-"(not available)"}${NC}"
echo -e "App URL:        ${GREEN}$APP_URL${NC}"
echo -e "Key Vault:      ${GREEN}$KEY_VAULT_URI${NC}"

# ============================================================================
# Build and Push Docker Image (if requested)
# ============================================================================

if [[ "$BUILD_IMAGE" == "true" ]]; then
    echo ""
    echo -e "${YELLOW}Building Docker image...${NC}"

    cd "$SCRIPT_DIR/.."

    # Versioned tag to avoid Azure Container Apps image caching
    if git rev-parse --git-dir > /dev/null 2>&1; then
        GIT_SHA=$(git rev-parse --short HEAD)
        IMAGE_TAG="${ENVIRONMENT}-${GIT_SHA}"
    else
        IMAGE_TAG="${ENVIRONMENT}-$(date +%Y%m%d%H%M%S)"
    fi

    # Build for AMD64 (Azure)
    if [[ "$PUSH_IMAGE" == "true" && -n "$ACR_NAME" ]]; then
        # Login to ACR
        az acr login --name "${ACR_NAME%%.*}"

        # Build and push directly to ACR
        docker buildx build \
            --platform linux/amd64 \
            -t "$ACR_NAME/austin-rtass:${IMAGE_TAG}" \
            -t "$ACR_NAME/austin-rtass:latest" \
            --push \
            .

        echo -e "${GREEN}Pushed:${NC} $ACR_NAME/austin-rtass:${IMAGE_TAG}"

        # Update Container App with new image
        echo ""
        echo -e "${YELLOW}Updating Container App...${NC}"

        if [[ -z "$CONTAINER_APP_NAME" ]]; then
            echo -e "${RED}Error: containerAppName output missing from deployment${NC}"
            exit 1
        fi

        az containerapp update \
            --name "$CONTAINER_APP_NAME" \
            --resource-group "$RESOURCE_GROUP" \
            --image "$ACR_NAME/austin-rtass:${IMAGE_TAG}"
    else
        docker buildx build \
            --platform linux/amd64 \
            -t "austin-rtass:latest" \
            -t "austin-rtass:${IMAGE_TAG}" \
            --load \
            .
    fi
fi

# ============================================================================
# Summary
# ============================================================================

# Extract Key Vault name from URI
KV_NAME=""
if [[ -n "$KEY_VAULT_URI" ]]; then
    KV_NAME=$(echo "$KEY_VAULT_URI" | sed -n 's|https://\([^.]*\)\.vault\.azure\.net/|\1|p')
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Deployment Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "Next steps:"
if [[ -n "$KV_NAME" ]]; then
    echo -e "1. Add secrets to Key Vault:"
    echo -e "   ${BLUE}az keyvault secret set --vault-name $KV_NAME --name azure-openai-api-key --value 'YOUR_KEY'${NC}"
    echo -e "   ${BLUE}az keyvault secret set --vault-name $KV_NAME --name azure-openai-endpoint --value 'YOUR_ENDPOINT'${NC}"
    echo ""
fi
echo -e "2. Push your Docker image:"
echo -e "   ${BLUE}./deploy.sh ${ENVIRONMENT} --push${NC}"
echo ""
if [[ -n "$APP_URL" ]]; then
    echo -e "3. Access your application:"
    echo -e "   ${BLUE}$APP_URL${NC}"
fi

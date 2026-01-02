#!/bin/bash
# ============================================================================
# Azure Container Apps Deployment Script
# ============================================================================
# This script automates the deployment of the Meeting Transcriber application
# to Azure Container Apps.
#
# Usage:
#   ./scripts/deploy-azure.sh [environment]
#
# Arguments:
#   environment: staging or production (default: staging)
#
# Prerequisites:
#   - Docker Desktop installed and running
#   - Azure CLI installed and authenticated (az login)
#   - Azure resources created (registry, container apps environment)
#
# Examples:
#   ./scripts/deploy-azure.sh staging
#   ./scripts/deploy-azure.sh production
# ============================================================================

set -e  # Exit on error
set -o pipefail  # Exit on pipe failure

# ============================================================================
# Configuration
# ============================================================================

# Environment selection
ENVIRONMENT="${1:-staging}"

# Validate environment
if [[ "$ENVIRONMENT" != "staging" && "$ENVIRONMENT" != "production" ]]; then
    echo "Error: Environment must be 'staging' or 'production'"
    echo "Usage: $0 [staging|production]"
    exit 1
fi

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Azure resources
ACR_NAME="meetingtranscriberacr"
IMAGE_NAME="meeting-transcriber"
AZURE_REGION="eastus"

# Environment-specific configuration
if [[ "$ENVIRONMENT" == "production" ]]; then
    RESOURCE_GROUP="meeting-transcriber-production-rg"
    CONTAINER_APP_NAME="meeting-transcriber-production"
    CONTAINER_APP_ENV="meeting-transcriber-env-production"
else
    RESOURCE_GROUP="meeting-transcriber-staging-rg"
    CONTAINER_APP_NAME="meeting-transcriber-staging"
    CONTAINER_APP_ENV="meeting-transcriber-env-staging"
fi

# Image tag (use git SHA if in git repo, otherwise use timestamp)
if git rev-parse --git-dir > /dev/null 2>&1; then
    GIT_SHA=$(git rev-parse --short HEAD)
    IMAGE_TAG="${ENVIRONMENT}-${GIT_SHA}"
else
    TIMESTAMP=$(date +%Y%m%d-%H%M%S)
    IMAGE_TAG="${ENVIRONMENT}-${TIMESTAMP}"
fi

# Full image name
FULL_IMAGE_NAME="${ACR_NAME}.azurecr.io/${IMAGE_NAME}:${IMAGE_TAG}"
LATEST_IMAGE_NAME="${ACR_NAME}.azurecr.io/${IMAGE_NAME}:latest"

# ============================================================================
# Helper Functions
# ============================================================================

print_header() {
    echo -e "${BLUE}============================================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}============================================================${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

check_command() {
    if ! command -v $1 &> /dev/null; then
        print_error "$1 is not installed. Please install it first."
        exit 1
    fi
}

# ============================================================================
# Preflight Checks
# ============================================================================

print_header "Preflight Checks"

# Check Docker
print_info "Checking Docker..."
check_command docker

# Verify Docker is running
if ! docker info > /dev/null 2>&1; then
    print_error "Docker is not running. Please start Docker Desktop."
    exit 1
fi
print_success "Docker is running"

# Check Azure CLI
print_info "Checking Azure CLI..."
check_command az
print_success "Azure CLI is installed"

# Check Azure login
print_info "Checking Azure authentication..."
if ! az account show > /dev/null 2>&1; then
    print_error "Not logged in to Azure. Please run: az login"
    exit 1
fi

SUBSCRIPTION_NAME=$(az account show --query name -o tsv)
print_success "Authenticated to Azure subscription: $SUBSCRIPTION_NAME"

# ============================================================================
# Deployment Confirmation
# ============================================================================

print_header "Deployment Configuration"
echo "Environment:       $ENVIRONMENT"
echo "Resource Group:    $RESOURCE_GROUP"
echo "Container App:     $CONTAINER_APP_NAME"
echo "Image Tag:         $IMAGE_TAG"
echo "Full Image:        $FULL_IMAGE_NAME"
echo ""

read -p "Continue with deployment? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    print_warning "Deployment cancelled"
    exit 0
fi

# ============================================================================
# Build Docker Image
# ============================================================================

print_header "Building Docker Image"

print_info "Building for linux/amd64 platform..."
docker buildx build \
    --platform linux/amd64 \
    -t "${FULL_IMAGE_NAME}" \
    -t "${LATEST_IMAGE_NAME}" \
    .

print_success "Docker image built successfully"

# ============================================================================
# Login to Azure Container Registry
# ============================================================================

print_header "Azure Container Registry Login"

print_info "Logging in to ${ACR_NAME}..."
az acr login --name "${ACR_NAME}"
print_success "Logged in to Azure Container Registry"

# ============================================================================
# Push Docker Image
# ============================================================================

print_header "Pushing Docker Image"

print_info "Pushing ${FULL_IMAGE_NAME}..."
docker push "${FULL_IMAGE_NAME}"
print_success "Pushed ${FULL_IMAGE_NAME}"

print_info "Pushing ${LATEST_IMAGE_NAME}..."
docker push "${LATEST_IMAGE_NAME}"
print_success "Pushed ${LATEST_IMAGE_NAME}"

# ============================================================================
# Deploy to Azure Container Apps
# ============================================================================

print_header "Deploying to Azure Container Apps"

print_info "Updating container app: ${CONTAINER_APP_NAME}..."
az containerapp update \
    --name "${CONTAINER_APP_NAME}" \
    --resource-group "${RESOURCE_GROUP}" \
    --image "${FULL_IMAGE_NAME}"

print_success "Container app updated successfully"

# ============================================================================
# Get Application URL
# ============================================================================

print_header "Getting Application URL"

APP_URL=$(az containerapp show \
    --name "${CONTAINER_APP_NAME}" \
    --resource-group "${RESOURCE_GROUP}" \
    --query properties.configuration.ingress.fqdn \
    --output tsv)

if [ -z "$APP_URL" ]; then
    print_error "Failed to get application URL"
    exit 1
fi

print_success "Application URL: https://${APP_URL}"

# ============================================================================
# Health Check
# ============================================================================

print_header "Running Health Check"

print_info "Waiting 30 seconds for deployment to stabilize..."
sleep 30

print_info "Checking health endpoint..."
HEALTH_URL="https://${APP_URL}/api/health"

MAX_RETRIES=10
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if curl -f -s "$HEALTH_URL" > /dev/null 2>&1; then
        print_success "Health check passed!"
        HEALTH_RESPONSE=$(curl -s "$HEALTH_URL")
        echo "Response: $HEALTH_RESPONSE"
        break
    else
        RETRY_COUNT=$((RETRY_COUNT + 1))
        if [ $RETRY_COUNT -lt $MAX_RETRIES ]; then
            print_warning "Health check failed, retrying ($RETRY_COUNT/$MAX_RETRIES)..."
            sleep 10
        else
            print_error "Health check failed after $MAX_RETRIES attempts"
            print_warning "Application may still be starting. Check logs with:"
            echo "  az containerapp logs show --name ${CONTAINER_APP_NAME} --resource-group ${RESOURCE_GROUP} --follow"
            exit 1
        fi
    fi
done

# ============================================================================
# Deployment Summary
# ============================================================================

print_header "Deployment Summary"
echo -e "${GREEN}✓ Deployment completed successfully!${NC}"
echo ""
echo "Environment:       $ENVIRONMENT"
echo "Container App:     $CONTAINER_APP_NAME"
echo "Image Tag:         $IMAGE_TAG"
echo "Application URL:   https://${APP_URL}"
echo ""
echo "Next steps:"
echo "  1. Open application:  open https://${APP_URL}"
echo "  2. View logs:         az containerapp logs show --name ${CONTAINER_APP_NAME} --resource-group ${RESOURCE_GROUP} --follow"
echo "  3. View revisions:    az containerapp revision list --name ${CONTAINER_APP_NAME} --resource-group ${RESOURCE_GROUP} --output table"
echo ""
print_success "Deployment complete!"

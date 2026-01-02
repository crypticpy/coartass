# Deployment Guide

This guide provides comprehensive instructions for deploying the Meeting Transcriber application. The app is designed to run in Docker containers and can be deployed to any infrastructure that supports containerized applications.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Choosing Your Deployment](#choosing-your-deployment)
- [Docker Deployment](#docker-deployment)
- [Azure Container Apps](#azure-container-apps)
- [Environment Variables](#environment-variables)
- [Health Checks & Monitoring](#health-checks--monitoring)
- [Troubleshooting](#troubleshooting)

## Prerequisites

Before deploying, ensure you have:

- **Node.js 20+** - For local development/testing
- **Docker** - For containerized deployment
- **OpenAI API access** - Either:
  - Standard OpenAI API key, OR
  - Azure OpenAI Service credentials

### What You'll Need for Each Platform

| Platform | Requirements |
|----------|--------------|
| **Docker (Local)** | Docker Desktop, `.env.local` file |
| **Azure Container Apps** | Azure subscription, Azure CLI, Container Registry |

## Choosing Your Deployment

| Deployment Method | Best For | Complexity |
|------------------|----------|------------|
| **Docker Compose** | Local testing, small teams | Low |
| **Azure Container Apps** | Production, enterprise | Medium |

For most organizations, we recommend starting with **Docker locally** for testing, then deploying to **Azure Container Apps** for production.

## Docker Deployment

### Quick Start

```bash
# 1. Clone and enter the repository
git clone https://github.com/your-org/meeting-transcriber.git
cd meeting-transcriber

# 2. Create environment file
cp .env.local.example .env.local
# Edit .env.local with your API credentials

# 3. Build and run
docker compose up --build
```

The application will be available at `http://localhost:3000`.

### Building the Docker Image

#### For Local Testing (Your Machine's Architecture)

```bash
docker build -t meeting-transcriber:local .
```

#### For Azure/Cloud Deployment (x86_64/AMD64)

Most cloud platforms run on x86_64 architecture. If you're building on an Apple Silicon Mac (M1/M2/M3), you need to specify the platform:

```bash
docker buildx build --platform linux/amd64 -t meeting-transcriber:azure .
```

#### Multi-Architecture Build

To build for both ARM64 (Apple Silicon) and AMD64 (Intel/AMD):

```bash
docker buildx build --platform linux/amd64,linux/arm64 \
  -t meeting-transcriber:latest .
```

### Running the Container

#### With Environment Variables

```bash
docker run -p 3000:3000 \
  -e OPENAI_API_KEY=sk-your-key \
  meeting-transcriber:local
```

#### With Environment File

```bash
docker run -p 3000:3000 --env-file .env.local meeting-transcriber:local
```

#### With Docker Compose

```bash
docker compose up
```

To run in the background:

```bash
docker compose up -d
```

### Docker Compose Configuration

The included `docker-compose.yml` provides:

- **Health checks**: Monitors application status
- **Automatic restart**: Recovers from failures
- **Security hardening**: Non-root user, dropped capabilities
- **Log rotation**: Prevents disk from filling up

See the comments in `docker-compose.yml` for customization options.

### Image Details

The Dockerfile uses a multi-stage build for optimal size and security:

| Stage | Purpose | Size |
|-------|---------|------|
| deps | Install dependencies | ~500MB |
| builder | Build Next.js app | ~800MB |
| runner | Production runtime | ~300MB |

**Security features included:**
- Non-root user (`nextjs`, UID 1001)
- Alpine Linux base (minimal attack surface)
- `dumb-init` for proper signal handling
- Health checks for monitoring
- No unnecessary packages

## Azure Container Apps

Azure Container Apps is our recommended production deployment target. It provides:

- Automatic scaling
- Built-in HTTPS
- Managed infrastructure
- Integration with Azure Key Vault

### Prerequisites for Azure

1. **Azure CLI** installed and configured
2. **Azure subscription** with Container Apps enabled
3. **Azure Container Registry** (ACR) for storing images

### Step-by-Step Deployment

#### 1. Login to Azure

```bash
az login
```

#### 2. Create Resource Group (if needed)

```bash
az group create --name rg-meeting-transcriber --location eastus
```

#### 3. Create Container Registry

```bash
az acr create \
  --resource-group rg-meeting-transcriber \
  --name youracrname \
  --sku Basic
```

#### 4. Build and Push Image

> **CRITICAL: Always Use Versioned Tags**
>
> Azure Container Apps caches images by tag name. Using `:latest` repeatedly will NOT trigger a new deployment - Azure will silently reuse the cached image. **Always use unique version tags** (e.g., `:v0.9.9`, `:v0.9.9-20251228`) to force Azure to pull the new image and create a new revision.

```bash
# Login to ACR
az acr login --name youracrname

# Get version from package.json (recommended)
VERSION=$(node -p "require('./package.json').version")

# Build for AMD64 with version tag
docker buildx build --platform linux/amd64 \
  -t youracrname.azurecr.io/meeting-transcriber:v${VERSION} \
  --push .

# Also tag as latest for convenience (but deploy with version tag!)
docker tag youracrname.azurecr.io/meeting-transcriber:v${VERSION} \
  youracrname.azurecr.io/meeting-transcriber:latest
docker push youracrname.azurecr.io/meeting-transcriber:latest
```

**Deploy with the versioned tag:**
```bash
az containerapp update \
  --name your-container-app \
  --resource-group your-resource-group \
  --image youracrname.azurecr.io/meeting-transcriber:v${VERSION}
```

#### 5. Deploy Using Infrastructure Scripts

The repository includes Bicep templates for Azure deployment:

```bash
cd infrastructure
./deploy.sh prod
```

This creates:
- Container Apps Environment
- Container App with your image
- Key Vault for secrets
- Managed Identity

#### 6. Configure Secrets in Key Vault

```bash
# Set your OpenAI credentials
az keyvault secret set \
  --vault-name kv-mtranscriber-prod \
  --name azure-openai-api-key \
  --value 'your-api-key'

az keyvault secret set \
  --vault-name kv-mtranscriber-prod \
  --name azure-openai-endpoint \
  --value 'https://your-resource.openai.azure.com/'
```

### Azure-Specific Environment Variables

When using Azure Key Vault, set `AZURE_KEY_VAULT_URL`:

```env
AZURE_KEY_VAULT_URL=https://your-vault.vault.azure.net/
```

The application will automatically fetch secrets from Key Vault using managed identity.

## Environment Variables

### Required Variables

You need **one** of these configurations:

#### Standard OpenAI

```env
OPENAI_API_KEY=sk-your-api-key
```

#### Azure OpenAI

```env
AZURE_OPENAI_API_KEY=your-azure-key
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
AZURE_OPENAI_API_VERSION=2025-01-01-preview
AZURE_OPENAI_WHISPER_DEPLOYMENT=your-whisper-deployment
AZURE_OPENAI_GPT5_DEPLOYMENT=your-gpt5-deployment
```

### Analysis Model Selection

The app automatically selects the appropriate GPT model based on transcript size:

| Transcript Size | Model | Environment Variable |
|-----------------|-------|---------------------|
| < 256k tokens | GPT-5 (standard) | `AZURE_OPENAI_GPT5_DEPLOYMENT` |
| >= 256k tokens | GPT-4.1 (extended) | `AZURE_OPENAI_EXTENDED_GPT_DEPLOYMENT` |

**Note**: `AZURE_OPENAI_GPT4_DEPLOYMENT` is still supported as a legacy fallback.

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3000` |
| `HOSTNAME` | Server hostname | `0.0.0.0` |
| `AZURE_KEY_VAULT_URL` | Key Vault URL for secrets | - |
| `AZURE_OPENAI_GPT4_DEPLOYMENT` | Legacy analysis model (fallback) | - |
| `AZURE_OPENAI_EXTENDED_GPT_DEPLOYMENT` | Extended context model (gpt-41, 1M tokens) | - |
| `AZURE_OPENAI_CITATIONS_DEPLOYMENT` | Citations model for "View Supporting Evidence" (Advanced) | `gpt-4.1-mini` |
| `AZURE_OPENAI_CITATIONS_API_VERSION` | Override Azure API version for citations | `2024-12-01-preview` |
| `OPENAI_CITATIONS_MODEL` | Citations model when using standard OpenAI | `gpt-4.1-mini` |
| `NEXT_TELEMETRY_DISABLED` | Disable Next.js telemetry | `1` |

See [ENV_SETUP.md](./lib/docs/ENV_SETUP.md) for complete documentation.

## Health Checks & Monitoring

### Health Endpoint

The application exposes a health check endpoint at:

```
GET /api/health
```

Response:
```json
{
  "status": "healthy",
  "timestamp": "2025-01-01T00:00:00.000Z",
  "uptime": 12345.67
}
```

### Docker Health Check

The Docker container includes an automatic health check:

- **Interval**: 30 seconds
- **Timeout**: 3 seconds
- **Start period**: 40 seconds (allows app to start)
- **Retries**: 3

Check container health:

```bash
docker ps  # Shows health status
docker inspect --format='{{.State.Health.Status}}' meeting-transcriber
```

### Azure Container Apps Health

Azure Container Apps automatically uses the `/api/health` endpoint for:

- **Liveness probes**: Restart unhealthy containers
- **Readiness probes**: Route traffic only to healthy instances

## Troubleshooting

### Common Issues

#### Container Won't Start

**Symptoms**: Container exits immediately or restarts continuously

**Check logs**:
```bash
docker compose logs -f app
# or
docker logs meeting-transcriber
```

**Common causes**:
- Missing environment variables (check `.env.local`)
- Port 3000 already in use
- Invalid API credentials

#### Health Check Failing

**Symptoms**: Container shows "unhealthy" status

**Verify the endpoint**:
```bash
curl http://localhost:3000/api/health
```

**Check if app is running**:
```bash
docker compose exec app ps aux
```

#### Build Fails on Apple Silicon

**Symptoms**: Build fails with architecture errors

**Solution**: Use buildx with explicit platform:
```bash
docker buildx build --platform linux/amd64 -t meeting-transcriber:azure .
```

#### Environment Variables Not Loading

**Symptoms**: App starts but API calls fail

**Verify variables are set**:
```bash
docker compose exec app env | grep -E '(OPENAI|AZURE)'
```

**Check file format**:
- Ensure `.env.local` has no quotes around values
- Ensure no trailing whitespace
- Ensure file uses Unix line endings (LF, not CRLF)

#### Azure Container Apps Not Pulling New Image

**Symptoms**: Deployment "succeeds" but app still shows old version/code

**Root cause**: Using `:latest` tag repeatedly. Azure caches the image digest and won't pull a new image if the tag name hasn't changed.

**Solution**: Always use unique version tags:
```bash
# Get version from package.json
VERSION=$(node -p "require('./package.json').version")

# Or use timestamp for uniqueness
VERSION="0.9.9-$(date +%Y%m%d%H%M%S)"

# Deploy with versioned tag
az containerapp update \
  --name your-app \
  --resource-group your-rg \
  --image youracr.azurecr.io/meeting-transcriber:v${VERSION}
```

**Verify the new revision is running**:
```bash
az containerapp revision list \
  --name your-app \
  --resource-group your-rg \
  --query "[].{name:name, active:properties.active, traffic:properties.trafficWeight}" \
  -o table
```

#### Azure Container Apps Can't Pull Image (Auth Error)

**Symptoms**: Deployment fails, can't pull image

**Verify ACR access**:
```bash
az acr repository list --name youracrname
```

**Check managed identity permissions**:
```bash
az role assignment list --assignee <identity-id>
```

### Getting Help

1. Check the logs first (see commands above)
2. Review [ENV_SETUP.md](./lib/docs/ENV_SETUP.md) for configuration details
3. Open an issue on GitHub with:
   - Error messages from logs
   - Your deployment method
   - Relevant environment variables (redact secrets!)

---

**Last Updated**: 2025-11-25

# Environment Setup Guide

This guide explains how to configure the Meeting Transcriber application with OpenAI API credentials.

## Table of Contents

- [Overview](#overview)
- [Quick Setup](#quick-setup)
- [Azure OpenAI Setup](#azure-openai-setup)
- [Standard OpenAI Setup](#standard-openai-setup)
- [Extended Context Deployments](#extended-context-deployments)
- [Azure Key Vault Integration](#azure-key-vault-integration)
- [Environment Variables Reference](#environment-variables-reference)
- [Verification](#verification)
- [Troubleshooting](#troubleshooting)

## Overview

The Meeting Transcriber requires access to OpenAI APIs for:

- **Transcription**: Converting audio to text (Whisper or GPT-4o Transcribe)
- **Analysis**: Meeting summaries, action items, and key decisions (GPT models)
- **Chat**: Q&A about transcripts (GPT models)

You can use either:

1. **Azure OpenAI Service** (Recommended for production)
2. **Standard OpenAI API** (Simpler setup)

## Quick Setup

### Standard OpenAI (Fastest)

```bash
# Create .env.local
cp .env.local.example .env.local

# Add your API key
echo "OPENAI_API_KEY=sk-your-key-here" >> .env.local
```

### Azure OpenAI

```bash
# Create .env.local
cp .env.local.example .env.local
```

Then add these variables to `.env.local`:

```env
AZURE_OPENAI_API_KEY=your-azure-key
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
AZURE_OPENAI_API_VERSION=2024-12-01-preview
AZURE_OPENAI_WHISPER_DEPLOYMENT=your-whisper-deployment
AZURE_OPENAI_GPT4_DEPLOYMENT=your-gpt4-deployment
# Optional: Use a small model for "View Supporting Evidence" (Advanced analyses)
AZURE_OPENAI_CITATIONS_DEPLOYMENT=gpt-4.1-mini
AZURE_OPENAI_CITATIONS_API_VERSION=2024-12-01-preview
```

## Azure OpenAI Setup

### Step 1: Create Azure OpenAI Resource

1. Go to [Azure Portal](https://portal.azure.com)
2. Search for "Azure OpenAI" and create a new resource
3. Choose your subscription, resource group, and region
4. Wait for deployment to complete

### Step 2: Deploy Models

In Azure OpenAI Studio, deploy these models:

| Model | Purpose | Recommended Deployment Name |
|-------|---------|----------------------------|
| `whisper` | Audio transcription | `whisper-1` |
| `gpt-4o-transcribe` | Advanced audio transcription | `gpt-4o-transcribe` |
| `gpt-4o` | Analysis and chat | `gpt-4o` |
| `gpt-4.1-mini` | Supporting evidence selection | `gpt-4.1-mini` |

**Note**: You need at least one transcription model (Whisper or GPT-4o Transcribe) and one analysis model.

### Step 3: Get Credentials

1. In Azure Portal, go to your Azure OpenAI resource
2. Navigate to **Keys and Endpoint**
3. Copy:
   - **KEY 1** (or KEY 2)
   - **Endpoint** URL

### Step 4: Configure Environment

Add to `.env.local`:

```env
# Azure OpenAI Configuration
AZURE_OPENAI_API_KEY=your-key-from-step-3
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
AZURE_OPENAI_API_VERSION=2024-12-01-preview

# Transcription deployment
AZURE_OPENAI_WHISPER_DEPLOYMENT=whisper-1

# Analysis deployment
AZURE_OPENAI_GPT4_DEPLOYMENT=gpt-4o

# Optional: Supporting evidence selection (Advanced analyses)
AZURE_OPENAI_CITATIONS_DEPLOYMENT=gpt-4.1-mini
AZURE_OPENAI_CITATIONS_API_VERSION=2024-12-01-preview
```

## Standard OpenAI Setup

### Step 1: Create API Key

1. Go to [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
2. Click "Create new secret key"
3. Copy the key immediately

### Step 2: Set Up Billing

1. Go to [Billing Settings](https://platform.openai.com/account/billing/overview)
2. Add a payment method
3. Set usage limits

### Step 3: Configure Environment

Add to `.env.local`:

```env
OPENAI_API_KEY=sk-your-api-key-here
```

The application automatically uses:
- `whisper-1` for transcription
- `gpt-4o` for analysis

## Extended Context Deployments

For very long transcripts (over 256k tokens), you can configure an extended context deployment:

```env
# Optional: Extended context for long transcripts
AZURE_OPENAI_EXTENDED_GPT_DEPLOYMENT=your-extended-context-deployment
```

### How It Works

The application automatically selects deployments based on transcript length:

| Transcript Size | Tokens | Deployment Used |
|-----------------|--------|-----------------|
| Short/Medium | < 256k | Standard (`GPT4_DEPLOYMENT`) |
| Long | ≥ 256k | Extended (`EXTENDED_GPT_DEPLOYMENT`) |

If `AZURE_OPENAI_EXTENDED_GPT_DEPLOYMENT` is not set, long transcripts will use the standard deployment (which may fail or be truncated).

### Recommended Setup for Long Transcripts

In Azure OpenAI Studio:

1. Deploy a model with large context window (e.g., `gpt-4o` with 128k context)
2. If available, deploy a model with 1M token context
3. Configure both deployments:

```env
AZURE_OPENAI_GPT4_DEPLOYMENT=gpt-4o
AZURE_OPENAI_EXTENDED_GPT_DEPLOYMENT=gpt-4o-1m
```

## Azure Key Vault Integration

For production deployments, store secrets in Azure Key Vault:

### Step 1: Create Key Vault

```bash
az keyvault create \
  --name your-keyvault \
  --resource-group your-resource-group \
  --location eastus
```

### Step 2: Add Secrets

```bash
az keyvault secret set \
  --vault-name your-keyvault \
  --name azure-openai-api-key \
  --value "your-api-key"

az keyvault secret set \
  --vault-name your-keyvault \
  --name azure-openai-endpoint \
  --value "https://your-resource.openai.azure.com/"
```

### Step 3: Configure Application

```env
AZURE_KEY_VAULT_URL=https://your-keyvault.vault.azure.net/
```

The application uses managed identity when deployed to Azure and automatically fetches secrets from Key Vault.

## Environment Variables Reference

### Azure OpenAI Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `AZURE_OPENAI_API_KEY` | Yes* | - | Azure OpenAI API key |
| `AZURE_OPENAI_ENDPOINT` | Yes* | - | Endpoint URL (e.g., `https://xxx.openai.azure.com/`) |
| `AZURE_OPENAI_API_VERSION` | No | `2024-08-01-preview` | API version |
| `AZURE_OPENAI_WHISPER_DEPLOYMENT` | No | - | Whisper deployment name |
| `AZURE_OPENAI_GPT4_DEPLOYMENT` | No | - | Primary analysis deployment |
| `AZURE_OPENAI_GPT5_DEPLOYMENT` | No | - | Alternative name for primary deployment |
| `AZURE_OPENAI_EXTENDED_GPT_DEPLOYMENT` | No | - | Extended context deployment for long transcripts |
| `AZURE_OPENAI_CITATIONS_DEPLOYMENT` | No | `gpt-4.1-mini` | Citations deployment for "View Supporting Evidence" |
| `AZURE_OPENAI_CITATIONS_API_VERSION` | No | `2024-12-01-preview` | API version for citations requests |

*Required if using Azure OpenAI

### Standard OpenAI Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `OPENAI_API_KEY` | Yes* | - | OpenAI API key |
| `OPENAI_ORGANIZATION_ID` | No | - | Organization ID (multi-org accounts) |
| `OPENAI_CITATIONS_MODEL` | No | `gpt-4.1-mini` | Model used for "View Supporting Evidence" |

*Required if using standard OpenAI

### Infrastructure Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `AZURE_KEY_VAULT_URL` | No | - | Key Vault URL for secrets |
| `PORT` | No | `3000` | Server port |
| `HOSTNAME` | No | `0.0.0.0` | Server hostname |
| `NODE_ENV` | No | `development` | Environment mode |

### Configuration Priority

The application selects the provider in this order:

1. **Azure OpenAI** - If `AZURE_OPENAI_API_KEY` AND `AZURE_OPENAI_ENDPOINT` are set
2. **Standard OpenAI** - If `OPENAI_API_KEY` is set
3. **Error** - If neither is configured

## Verification

### Check Configuration Status

After starting the server, visit:

```
http://localhost:3000/api/config/status
```

Expected response for Azure OpenAI:

```json
{
  "configured": true,
  "provider": "azure",
  "whisperDeployment": "whisper-1",
  "gpt4Deployment": "gpt-4o"
}
```

Expected response for standard OpenAI:

```json
{
  "configured": true,
  "provider": "openai"
}
```

### Test Transcription

1. Start the dev server: `npm run dev`
2. Upload a short audio file
3. Check terminal for transcription logs

### Test Analysis

1. After transcription completes, select a template
2. Click "Analyze Transcript"
3. Check terminal for analysis logs

## Troubleshooting

### "Missing OpenAI configuration"

- Check `.env.local` exists in project root
- Verify variable names are exactly correct (case-sensitive)
- Ensure no extra spaces around `=` signs
- Restart the development server

### "Invalid AZURE_OPENAI_ENDPOINT"

- Must start with `https://`
- Must end with `.openai.azure.com` or `.openai.azure.com/`
- No extra paths (just the base URL)

### "401 Unauthorized"

- Verify API key is correct and not truncated
- For Azure: Use KEY 1 or KEY 2 from Azure Portal
- For OpenAI: Ensure key hasn't been revoked
- Check for extra whitespace

### "Deployment not found"

- Verify deployment name matches exactly (case-sensitive)
- Check deployment exists in Azure OpenAI Studio
- Ensure deployment is in "Succeeded" state

### "429 Too Many Requests"

- Check quota/rate limits in Azure Portal or OpenAI dashboard
- Wait before retrying
- Consider upgrading your tier

### "Token limit exceeded"

- Configure `AZURE_OPENAI_EXTENDED_GPT_DEPLOYMENT` for long transcripts
- Or split the transcript into smaller parts

### Server Won't Start

```bash
# Kill existing processes
lsof -ti:3000 | xargs kill -9

# Clear cache
rm -rf .next

# Restart
npm run dev
```

## Security Best Practices

- Never commit `.env.local` to version control
- Use different API keys for development and production
- Rotate API keys regularly
- Set up spending limits in your provider's dashboard
- Use Azure Key Vault for production deployments
- Monitor API usage for unexpected activity

---

**Last Updated**: 2025-11-25

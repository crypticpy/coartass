# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Austin RTASS (Radio Transcription Analysis Scoring System) is a Next.js 15 application for transcribing fireground radio traffic and generating evidence-linked training reviews and scorecards. Uses OpenAI's Whisper and GPT transcription engines with AI-powered analysis. All data is stored client-side in IndexedDB.

## Development Commands

```bash
npm ci                  # Install dependencies
npm run dev             # Start development server (http://localhost:3000)
npm run build           # Build for production
npm run lint            # Run ESLint
npm run type-check      # Run TypeScript type checking
npm run test            # Run vitest tests
npm start               # Start production server
ANALYZE=true npm run build  # Build with bundle analyzer
```

### Testing

Tests use Vitest with separate environments:
- `lib/**/__tests__/*.test.ts` - Node environment
- `hooks/**`, `components/**`, `app/**` - jsdom environment

```bash
npm run test             # Run all tests once
npx vitest               # Watch mode
npx vitest run lib/      # Run specific directory
npx vitest --coverage    # Coverage report
```

### Using Make

```bash
make help          # Show all available commands
make dev           # Start development server
make build         # Build production bundle
make lint          # Run ESLint
make docker-build  # Build Docker image
make deploy        # Build, push, and deploy to Azure
```

### Docker

```bash
docker compose up                    # Start with docker-compose
docker buildx build --platform linux/amd64 -t austin-rtass .  # Build for Azure
```

### Azure Deployment

**Local deployment guide available:** `DEPLOY-AZURE.local.md` (gitignored)

This file contains:
- Quick one-liner deploy command
- Step-by-step Azure Container App deployment
- Resource names, URLs, and troubleshooting
- Log viewing, scaling, and rollback commands

**Quick deploy (use version tag to force new revision):**
```bash
# Get version from package.json
VERSION=$(node -p "require('./package.json').version")

az acr login --name acrmtranscriberprod && \
docker buildx build --platform linux/amd64 -t austin-rtass:v${VERSION} . && \
docker tag austin-rtass:v${VERSION} acrmtranscriberprod.azurecr.io/austin-rtass:v${VERSION} && \
docker push acrmtranscriberprod.azurecr.io/austin-rtass:v${VERSION} && \
az containerapp update \
  --name ca-mtranscriber-prod \
  --resource-group rg-aph-cognitive-sandbox-dev-scus-01 \
  --image acrmtranscriberprod.azurecr.io/austin-rtass:v${VERSION}
```

**Important:** Always use versioned tags (`:v0.9.3`) instead of `:latest`. Azure Container Apps caches the `:latest` tag and may not pull the new image, causing deployments to silently use stale code. Using explicit version tags forces a new revision.

**Verify deployment:**
```bash
# Check revision is running with correct image
az containerapp revision list \
  --name ca-mtranscriber-prod \
  --resource-group rg-aph-cognitive-sandbox-dev-scus-01 \
  --query "[0].{revision:name,image:properties.template.containers[0].image,running:properties.runningState}" \
  -o table
```

**Production URL:** https://ca-mtranscriber-prod.ashyground-53059b7a.southcentralus.azurecontainerapps.io

## Architecture

### Tech Stack
- **Framework**: Next.js 15 with App Router
- **UI**: Mantine v8 + Tailwind CSS
- **Database**: Dexie.js (IndexedDB wrapper) - client-side only
- **Audio Processing**: FFmpeg WebAssembly, WaveSurfer.js
- **AI**: OpenAI SDK with Azure OpenAI support

### Key Directories

- `app/` - Next.js App Router pages and API routes
  - `app/api/transcribe/route.ts` - Audio transcription endpoint
  - `app/api/analyze/route.ts` - AI analysis endpoint (POST to analyze, GET for status)
  - `app/api/chat/route.ts` - Q&A chat endpoint for transcript conversations
  - `app/api/pdf/` - PDF export endpoints for transcripts and analyses
  - `app/api/rtass/` - RTASS-specific endpoints (rubrics, scoring)
  - `app/api/health/route.ts` - Health check endpoint
  - `app/api/config/status/route.ts` - API configuration status check
- `i18n/` - Internationalization with next-intl
- `messages/` - Translation files
- `components/` - React components organized by feature
- `hooks/` - Custom React hooks (e.g., `use-recording.ts`, `use-transcription-flow.ts`, `use-analysis.ts`)
- `lib/` - Utilities and business logic
  - `lib/db.ts` - Dexie database singleton and operations
  - `lib/openai.ts` - OpenAI client configuration (Azure/standard)
  - `lib/analysis-strategies/` - Pluggable analysis strategy system with fallback
  - `lib/validations/` - Zod schemas for environment and input validation
  - `lib/api-utils.ts` - Standardized API response helpers
- `types/` - TypeScript type definitions
- `infrastructure/` - Azure Bicep IaC for deployment

### Data Flow

1. **Transcription**: Audio file → `POST /api/transcribe` → OpenAI Whisper → Transcript stored in IndexedDB
2. **Analysis**: Transcript → `POST /api/analyze` → GPT analysis → Analysis stored in IndexedDB
3. **Storage**: All data (transcripts, analyses, recordings, conversations) persisted client-side via Dexie

### Database Schema (lib/db.ts)

The `AustinRTASSDB` class manages these IndexedDB tables:
- `transcripts` - Transcribed audio with segments and metadata
- `templates` - Analysis templates (built-in and custom)
- `analyses` - AI-generated analyses linked to transcripts
- `audioFiles` - Binary audio blobs for playback
- `conversations` - Q&A chat history per transcript
- `recordings` - Saved audio recordings with metadata

### OpenAI Configuration

The app supports both Azure OpenAI and standard OpenAI API. Configuration in `lib/openai.ts`:
- Uses Azure OpenAI if `AZURE_OPENAI_API_KEY` and `AZURE_OPENAI_ENDPOINT` are set
- Falls back to standard OpenAI with `OPENAI_API_KEY`
- Separate transcription client with API version `2025-03-01-preview` for Azure
- Automatic model selection based on transcript length (uses extended context model for >256k tokens)

Key functions:
- `getOpenAIClient()` - Returns singleton client for chat completions
- `getTranscriptionClient()` - Returns client configured for audio transcription
- `getWhisperDeployment()` - Returns deployment name for transcription
- `getGPTAnalysisDeployment()` - Returns deployment name for analysis
- `buildChatCompletionParams()` - Builds model-appropriate parameters (handles GPT-5 vs legacy models)

### Path Aliases

Use `@/*` for imports (configured in `tsconfig.json`):
```typescript
import { db } from '@/lib/db';
import { Transcript } from '@/types';
```

## Environment Setup

Copy `.env.local.example` to `.env.local` and configure:

### Azure OpenAI (Recommended)
```env
AZURE_OPENAI_API_KEY=your-key
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com
AZURE_OPENAI_WHISPER_DEPLOYMENT=whisper-1
AZURE_OPENAI_GPT5_DEPLOYMENT=gpt-5           # Primary analysis model
AZURE_OPENAI_EXTENDED_GPT_DEPLOYMENT=gpt-41  # Optional: for long transcripts (>256k tokens)
```

### Standard OpenAI
```env
OPENAI_API_KEY=sk-your-key
```

Note: `AZURE_OPENAI_GPT4_DEPLOYMENT` is supported as a legacy fallback.

## Code Patterns

### API Route Handlers
API routes use helper functions from `lib/api-utils.ts`:
```typescript
return successResponse(data);
return errorResponse('message', statusCode, details);
```

### Database Operations
Database operations in `lib/db.ts` follow consistent patterns:
- Functions throw `DatabaseError` with codes like `SAVE_FAILED`, `GET_FAILED`
- Use transactions for multi-table operations
- Paginated queries available for large datasets

### Analysis Strategies

Pluggable analysis strategies in `lib/analysis-strategies/` with automatic fallback:

| Strategy | Use Case | API Calls | Duration |
|----------|----------|-----------|----------|
| `basic` | Short transcripts (<50k tokens) | 1 | 30-60s |
| `hybrid` | Medium transcripts (50k-150k tokens) | 2-4 | 60-90s |
| `advanced` | Long/complex transcripts (>150k tokens) | 5-8 | 90-180s |

Key features:
- **Auto-selection**: Strategy chosen based on transcript token count via `recommendStrategy()`
- **Fallback chain**: On failure, degrades gracefully (advanced → hybrid → basic)
- **Circuit breaker**: Prevents repeated failures by tracking strategy health
- **Partial results recovery**: Merges successful sections from failed attempts
- **Self-evaluation**: Optional LLM-as-judge pass improves quality by 10-20%

Entry point: `executeAnalysis()` in `lib/analysis-strategies/index.ts`

### Build Scripts

The build process runs preparatory scripts before Next.js build:
- `scripts/build-templates.mjs` - Compiles analysis templates
- `scripts/copy-pdf-worker.mjs` - Copies pdfjs-dist worker for PDF export

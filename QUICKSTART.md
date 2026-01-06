# Austin RTASS - Quick Start Guide

Get Austin RTASS running in 5 minutes.

## Prerequisites

Before you begin, ensure you have:

- **Node.js 20+** installed ([download](https://nodejs.org/))
- **OpenAI API access** - either:
  - Standard OpenAI API key, OR
  - Azure OpenAI Service credentials

## Step 1: Clone and Install

```bash
# Clone the repository
git clone https://github.com/your-org/austin-rtass.git
cd austin-rtass

# Install dependencies
npm install
```

## Step 2: Configure API Access

Create your environment file:

```bash
cp .env.local.example .env.local
```

Then edit `.env.local` with your API credentials:

### Option A: Standard OpenAI (Simplest)

```env
OPENAI_API_KEY=sk-your-api-key-here
```

Get your API key from [platform.openai.com/api-keys](https://platform.openai.com/api-keys).

### Option B: Azure OpenAI (Production)

```env
AZURE_OPENAI_API_KEY=your-azure-key
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
AZURE_OPENAI_API_VERSION=2025-01-01-preview
AZURE_OPENAI_WHISPER_DEPLOYMENT=your-whisper-deployment
AZURE_OPENAI_GPT5_DEPLOYMENT=your-gpt5-deployment
```

Get your credentials from the [Azure Portal](https://portal.azure.com) → your OpenAI resource → Keys and Endpoint.

## Step 3: Start the Application

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Step 4: Test It

1. **Upload**: Go to the Upload page and select an audio file (MP3, WAV, M4A, or MP4)
2. **Transcribe**: Click "Start Transcription" and wait for processing
3. **View**: See your transcript with speaker labels and timestamps
4. **Analyze**: Select a template and click "Analyze Transcript"
5. **Export**: Download as PDF or Markdown

## Troubleshooting

### "Missing OpenAI configuration"

Check that your `.env.local` file exists and has the correct variables:

```bash
# Verify file exists
ls -la .env.local

# Check variables are set
cat .env.local | grep -E "(OPENAI|AZURE)"
```

Then restart the development server.

### "401 Unauthorized" or "Invalid API Key"

- Verify you copied the API key correctly (no extra spaces)
- For Azure: Check the endpoint URL ends with a `/`
- For Azure: Verify your deployment names are correct
- Try generating a new API key

### "Deployment not found" (Azure)

Your deployment name doesn't match. In Azure Portal:
1. Go to your OpenAI resource
2. Click "Model deployments"
3. Copy the exact deployment names to your `.env.local`

### Transcription works but analysis fails

- Check that your analysis model deployment exists and has quota
- Try a shorter transcript to rule out token limits
- Check the server logs (terminal) for specific error messages

## What's Included

The application is production-ready with:

- **Audio transcription** using Whisper or GPT-4o Transcribe
- **AI-powered analysis** using GPT-5 (with GPT-4.1 for extended context)
- **6 built-in templates** for different meeting types
- **Audio playback** with waveform visualization
- **PDF and Markdown export**
- **Dark mode** support
- **Keyboard shortcuts** (press `?` to see all)
- **Mobile-responsive** design

## Next Steps

- [DEPLOYMENT.md](./DEPLOYMENT.md) - Deploy to production with Docker
- [BRANDING.md](./BRANDING.md) - Customize for your organization
- [ENV_SETUP.md](./lib/docs/ENV_SETUP.md) - Advanced configuration options

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                        Austin RTASS                     │
│                      (Next.js 15)                       │
└────────────────────┬────────────────────────────────────┘
                     │
                     ├─────> Browser IndexedDB
                     │       └─ Transcripts
                     │       └─ Templates
                     │       └─ Analyses
                     │       └─ Audio Files
                     │       (All data stored locally)
                     │
                     └─────> OpenAI API
                             │
                             ├─> whisper-1 / gpt-4o-transcribe
                             │   └─ Audio → Text
                             │
                             └─> gpt-5 / gpt-41
                                 └─ Analysis & Chat
                                 (Auto-selected by token count)
```

## Need Help?

1. Check the server logs in your terminal
2. Open browser DevTools (F12) and check the Console tab
3. Review the configuration in `.env.local`
4. See [DEPLOYMENT.md](./DEPLOYMENT.md) for production issues
5. Open an issue on GitHub

---

**Ready to go?** Run `npm run dev` and start transcribing!

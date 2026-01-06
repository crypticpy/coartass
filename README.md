# Austin RTASS

[![Version](https://img.shields.io/badge/version-0.9.1-blue.svg)](./CHANGELOG.md)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](./LICENSE)

Austin RTASS (Radio Transcription Analysis Scoring System) is a modern web application for transcribing fireground radio traffic and generating evidence-linked training reviews and scorecards using OpenAI transcription and GPT analysis. Built with Next.js 15, featuring audio upload/recording, intelligent file processing, and template-based analysis.

**All data stays in your browser** - transcripts and recordings are stored locally in IndexedDB for privacy.

## Quick Links

- [Getting Started](#getting-started) - Run locally in 5 minutes
- [Deployment Guide](./DEPLOYMENT.md) - Docker and Azure deployment
- [Branding Guide](./BRANDING.md) - Customize for your organization
- [Environment Setup](./lib/docs/ENV_SETUP.md) - API configuration details

## Who Is This For?

This application is designed for **training organizations** needing a secure, private method for radio traffic transcription and review that keeps data within their own infrastructure. It's ideal for teams that need to:

- Transcribe and review radio traffic without sending data to third-party servers
- Keep sensitive meeting content private (all data stays in-browser)
- Maintain full control by deploying on their own infrastructure
- Customize branding for their organization
- Work with Azure OpenAI or standard OpenAI APIs

Whether you're a government agency, healthcare provider, legal firm, or any organization handling confidential discussions, this app provides enterprise-grade transcription while keeping your data under your control.

The app is built for **semi-technical teams** - you don't need to be a software engineer, but familiarity with environment variables, Docker, and basic deployment concepts is helpful.

## Features

### Audio Input
- **File Upload**: Support for MP3, WAV, M4A, WebM, and MP4 files (up to 25MB per segment)
- **Live Recording**: Browser-based audio capture with microphone, system audio, or commentary modes
- **Smart Processing**: Automatic audio format conversion and intelligent splitting for large files using FFmpeg WebAssembly

### Transcription
- **Whisper**: OpenAI's dedicated speech-to-text model for accurate transcription
- **GPT-4o Transcribe**: Advanced audio transcription with enhanced context understanding
- **Speaker Detection**: Automatic speaker diarization and labeling
- **Language Support**: Multi-language transcription with automatic detection

### Analysis & Export
- **AI Analysis**: Comprehensive meeting summaries, action items, and key points extraction
- **Extended Context**: Support for long transcripts with automatic model selection
- **Multiple Export Formats**: PDF, Markdown, and plain text
- **Template System**: Customizable analysis templates for different meeting types

### Storage & Privacy
- **Local Storage**: All data stored in browser IndexedDB - nothing on the server
- **Recording Library**: Save, organize, and replay recordings
- **Transcript History**: Full history of transcripts with search and filtering

## AI Models

This app works with OpenAI models through either the standard OpenAI API or Azure OpenAI Service.

### Transcription Models
| Model | Best For |
|-------|----------|
| **whisper-1** | Fast, accurate transcription of clear audio |
| **gpt-4o-transcribe** | Complex audio with accents, technical jargon, or background noise |

### Analysis & Chat Models
| Model | Purpose | Context Limit |
|-------|---------|---------------|
| **gpt-5** | Analysis, summaries, Q&A chat | 256k tokens |
| **gpt-41** (GPT-4.1) | Extended context for long transcripts | 1M tokens |

### Automatic Model Selection

The app automatically selects the appropriate model based on transcript length:
- **< 256k tokens**: Uses GPT-5 (standard context)
- **>= 256k tokens**: Uses GPT-4.1 (extended context) if configured

Configure via environment variables:
- `AZURE_OPENAI_GPT5_DEPLOYMENT` - Primary analysis model
- `AZURE_OPENAI_EXTENDED_GPT_DEPLOYMENT` - Extended context model (optional)

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **UI**: Mantine v8, Tailwind CSS
- **Audio**: FFmpeg WebAssembly, WaveSurfer.js
- **AI**: OpenAI SDK (Azure OpenAI and standard OpenAI supported)
- **Storage**: Dexie (IndexedDB wrapper) - browser-only
- **PDF Export**: React-PDF
- **Deployment**: Docker, Azure Container Apps

## Getting Started

### Prerequisites

- **Node.js 20+** - [Download here](https://nodejs.org/)
- **npm 10+** - Comes with Node.js
- **OpenAI API access** - Either:
  - [OpenAI API key](https://platform.openai.com/api-keys), OR
  - [Azure OpenAI Service](https://azure.microsoft.com/en-us/products/cognitive-services/openai-service) credentials
- **Docker** (optional) - For containerized deployment

### Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/your-org/austin-rtass.git
cd austin-rtass

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.local.example .env.local
# Edit .env.local with your API credentials (see below)

# 4. Start the development server
npm run dev

# 5. Open http://localhost:3000 in your browser
```

### Configuration Options

#### Option A: Standard OpenAI (Simplest)

Add your OpenAI API key to `.env.local`:

```env
OPENAI_API_KEY=sk-your-api-key-here
```

That's it! The app will use `whisper-1` for transcription and `gpt-5` for analysis.

#### Option B: Azure OpenAI (Recommended for Production)

Azure OpenAI provides enterprise features like private endpoints, managed identity, and SLA guarantees.

```env
# Required
AZURE_OPENAI_API_KEY=your-azure-api-key
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
AZURE_OPENAI_API_VERSION=2025-01-01-preview

# Transcription deployment (deploy whisper-1 or gpt-4o-transcribe in Azure)
AZURE_OPENAI_WHISPER_DEPLOYMENT=your-whisper-deployment-name

# Analysis deployment (deploy gpt-5 in Azure)
AZURE_OPENAI_GPT5_DEPLOYMENT=your-gpt5-deployment-name
# Legacy: AZURE_OPENAI_GPT4_DEPLOYMENT is also supported as fallback

# Optional: Extended context deployment for long transcripts (gpt-41)
AZURE_OPENAI_EXTENDED_GPT_DEPLOYMENT=your-extended-context-deployment
```

See [Environment Setup](./lib/docs/ENV_SETUP.md) for detailed configuration options.

## Deployment

### Docker (Recommended)

Build and run the containerized application:

```bash
# Build the Docker image
docker build -t austin-rtass .

# Run with environment variables
docker run -p 3000:3000 \
  -e OPENAI_API_KEY=your-key \
  austin-rtass
```

Or use Docker Compose:

```bash
# Copy and configure environment
cp .env.local.example .env.local
# Edit .env.local with your credentials

# Start the application
docker compose up
```

### Azure Container Apps

For production deployment on Azure:

```bash
# Deploy using the provided scripts
cd infrastructure
./deploy.sh prod
```

See [DEPLOYMENT.md](./DEPLOYMENT.md) for complete deployment instructions including:
- Multi-architecture Docker builds
- Azure Container Apps setup
- Environment variable configuration
- Health checks and monitoring

## Adapting for Your Organization

This application is designed to be easily customized:

### Branding
- Replace logos and colors with your organization's branding
- Customize the application name and metadata
- See [BRANDING.md](./BRANDING.md) for step-by-step instructions

### Templates
- Create custom analysis templates for your meeting types
- Configure default outputs (summaries, action items, etc.)
- Templates are stored in-browser and can be exported/imported

### Deployment
- Deploy on any infrastructure that supports Docker
- Use Azure, AWS, GCP, or on-premises servers
- Configure secrets via environment variables or Azure Key Vault

## Development

### Available Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Build for production |
| `npm start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run type-check` | Run TypeScript type checking |

### Using Make

```bash
make help          # Show all available commands
make dev           # Start development server
make build         # Build production bundle
make docker-build  # Build Docker image
make deploy        # Build and deploy to Azure
```

## Project Structure

```
austin-rtass/
├── app/                    # Next.js pages and API routes
│   ├── api/               # Backend API endpoints
│   │   ├── transcribe/    # Audio transcription
│   │   ├── analyze/       # AI analysis
│   │   └── chat/          # Q&A with transcripts
│   ├── record/            # Live recording page
│   ├── recordings/        # Recording library
│   ├── templates/         # Template management
│   ├── transcripts/       # Transcript viewing
│   └── upload/            # File upload
├── components/            # React UI components
├── hooks/                 # Custom React hooks
├── lib/                   # Utility libraries
│   ├── openai.ts          # OpenAI client configuration
│   ├── db.ts              # IndexedDB operations
│   └── validations/       # Input validation
├── infrastructure/        # Azure deployment (Bicep)
└── types/                 # TypeScript definitions
```

## Browser Compatibility

| Browser | Version | Notes |
|---------|---------|-------|
| Chrome | 90+ | Recommended - full feature support |
| Edge | 90+ | Full support |
| Firefox | 90+ | Full support |
| Safari | 15+ | Full support |

**Note**: System audio recording requires Chrome/Edge with screen sharing permissions.

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

## Security

For security concerns, please see [SECURITY.md](./SECURITY.md) for our security policy and vulnerability reporting process.

## License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.

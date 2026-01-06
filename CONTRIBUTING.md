# Contributing to Austin RTASS

Thank you for your interest in contributing to Austin RTASS! This document provides guidelines and information about contributing to this project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [How to Contribute](#how-to-contribute)
- [Good First Issues](#good-first-issues)
- [Pull Request Process](#pull-request-process)
- [Coding Standards](#coding-standards)
- [Development Tips](#development-tips)
- [Architecture Overview](#architecture-overview)

## Code of Conduct

This project adheres to a [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code. Please report unacceptable behavior to the project maintainers.

## Getting Started

### Prerequisites

- Node.js 20.x or higher
- npm 10.x or higher
- Git
- Docker (optional, for container testing)
- OpenAI API key (for testing transcription/analysis features)

### Development Setup

1. **Fork the repository**

   Click the "Fork" button in the top right corner of this repository.

2. **Clone your fork**

   ```bash
   git clone https://github.com/your-username/austin-rtass.git
   cd austin-rtass
   ```

3. **Add upstream remote**

   ```bash
   git remote add upstream https://github.com/your-org/austin-rtass.git
   ```

4. **Install dependencies**

   ```bash
   npm install
   ```

5. **Set up environment variables**

   ```bash
   cp .env.local.example .env.local
   # Edit .env.local with your API credentials
   ```

6. **Start development server**

   ```bash
   npm run dev
   ```

7. **Open in browser**

   Navigate to [http://localhost:3000](http://localhost:3000)

## How to Contribute

### Reporting Bugs

Before creating a bug report, please check existing issues to avoid duplicates.

When creating a bug report, include:

- A clear, descriptive title
- Steps to reproduce the issue
- Expected behavior vs actual behavior
- Screenshots if applicable
- Your environment (OS, Node.js version, browser)
- Any relevant error messages or logs

### Suggesting Features

We welcome feature suggestions! Please:

- Check existing issues and discussions first
- Clearly describe the problem your feature would solve
- Explain your proposed solution
- Consider potential drawbacks or alternatives

### Contributing Code

1. **Create a feature branch**

   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b fix/your-bug-fix
   ```

2. **Make your changes**

   - Write clean, readable code
   - Follow the existing code style
   - Add tests for new functionality
   - Update documentation as needed

3. **Run checks before committing**

   ```bash
   npm run lint        # Check for linting errors
   npm run type-check  # Check TypeScript types
   npm run build       # Verify production build works
   ```

4. **Commit your changes**

   Use conventional commit messages:

   ```bash
   git commit -m "feat: add audio compression feature"
   git commit -m "fix: resolve memory leak in transcription"
   git commit -m "docs: update API documentation"
   git commit -m "refactor: simplify analysis strategy selection"
   ```

5. **Push to your fork**

   ```bash
   git push origin feature/your-feature-name
   ```

6. **Create a Pull Request**

   Open a PR against the `main` branch of the upstream repository.

## Good First Issues

Looking for a place to start? Good first issues are labeled in the repository:

- **`good first issue`** - Simple, well-defined tasks ideal for newcomers
- **`documentation`** - Help improve our docs
- **`bug`** - Help fix bugs (check complexity in description)
- **`enhancement`** - Add new features

### Ideas for First Contributions

- Improve error messages to be more helpful
- Add missing TypeScript types
- Write tests for existing code
- Fix typos in documentation
- Add accessibility improvements (ARIA labels, keyboard navigation)
- Improve mobile responsiveness

## Pull Request Process

### Before Submitting

- [ ] All checks pass (`npm run lint`, `npm run type-check`, `npm run build`)
- [ ] Documentation updated if needed
- [ ] Rebased on the latest `main` branch
- [ ] Commits are clean and well-described

### PR Description Should Include

- Summary of changes
- Related issue number(s) (e.g., "Fixes #123")
- Testing performed
- Screenshots for UI changes

### Review Process

1. Maintainers will review your PR within a few days
2. Address any requested changes
3. Once approved, a maintainer will merge your PR

## Coding Standards

### TypeScript

- Use TypeScript for all new code
- Prefer `interface` over `type` for object shapes
- Use strict mode (`strict: true` in tsconfig)
- Avoid `any` - use proper types or `unknown`

### React/Next.js

- Use functional components with hooks
- Follow the App Router conventions
- Use server components where appropriate
- Keep components small and focused

### Styling

- Use Mantine components as the primary UI library
- Use Tailwind CSS for custom styling when needed
- Follow the existing design system
- Ensure responsive design (mobile-first)
- Support dark mode

### File Structure

```
app/                    # Next.js App Router pages and API routes
components/             # React components
├── layout/            # Layout components (header, nav)
├── transcript/        # Transcript-related components
├── record/            # Recording components
├── analysis/          # Analysis components
└── ui/                # Reusable UI components
lib/                   # Utility functions and shared code
├── validations/       # Zod schemas and validators
└── analysis-strategies/  # AI analysis implementations
hooks/                 # Custom React hooks
types/                 # TypeScript type definitions
```

### Naming Conventions

- **Files**: `kebab-case.ts` or `kebab-case.tsx` (all lowercase with hyphens)
- **Components**: `PascalCase` (e.g., `TranscriptCard`)
- **Functions**: `camelCase` (e.g., `formatDuration`)
- **Constants**: `SCREAMING_SNAKE_CASE` (e.g., `MAX_FILE_SIZE`)
- **Types/Interfaces**: `PascalCase` (e.g., `TranscriptSegment`)
- **CSS classes**: Follow Tailwind conventions

### Import Order

```typescript
// 1. React/Next.js imports
import { useState } from 'react';
import Link from 'next/link';

// 2. Third-party libraries
import { Button, Text } from '@mantine/core';

// 3. Internal imports (using @/ alias)
import { db } from '@/lib/db';
import { Transcript } from '@/types';

// 4. Relative imports
import { formatDate } from './utils';
```

## Development Tips

### Hot Reload Issues

If hot reload stops working:

```bash
# Restart the dev server
npm run dev
```

### Database Issues

The app uses IndexedDB in the browser. To reset:

1. Open DevTools (F12)
2. Go to Application → Storage → IndexedDB
3. Delete the database
4. Refresh the page

### Testing API Changes

Use the built-in API test endpoints:

- `GET /api/config/status` - Check configuration
- `GET /api/health` - Health check

### Debugging

- Server-side logs appear in the terminal running `npm run dev`
- Client-side logs appear in browser DevTools Console
- Use `console.log` liberally during development (but remove before committing)

## Architecture Overview

### Key Concepts

1. **Client-Side Storage**: All user data (transcripts, recordings, analyses) is stored in IndexedDB using Dexie.js. Nothing is persisted server-side.

2. **API Routes**: Next.js API routes handle communication with OpenAI. They process requests but don't store data.

3. **Analysis Strategies**: Pluggable analysis system in `lib/analysis-strategies/` allows different approaches for different transcript lengths.

4. **Theme System**: Mantine theme in `lib/mantine-theme.ts` controls the visual design.

### Data Flow

```
User uploads audio
       ↓
Audio processed in browser (FFmpeg WASM)
       ↓
Audio sent to /api/transcribe → OpenAI Whisper
       ↓
Transcript stored in IndexedDB
       ↓
User requests analysis
       ↓
Transcript sent to /api/analyze → OpenAI GPT
       ↓
Analysis stored in IndexedDB
```

### Key Files

| File | Purpose |
|------|---------|
| `lib/db.ts` | Database schema and operations |
| `lib/openai.ts` | OpenAI client configuration |
| `lib/mantine-theme.ts` | UI theme and colors |
| `app/api/transcribe/route.ts` | Transcription endpoint |
| `app/api/analyze/route.ts` | Analysis endpoint |
| `hooks/use-transcription-flow.ts` | Main transcription workflow |

## Getting Help

If you have questions about contributing:

- **GitHub Discussions**: Ask questions and discuss ideas
- **Issues**: For bugs and feature requests (use appropriate labels)

Thank you for contributing to Austin RTASS!

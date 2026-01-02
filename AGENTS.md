# Repository Guidelines

## Project Structure

- `app/`: Next.js App Router pages and API routes (e.g. `app/api/transcribe/route.ts`)
- `components/`: feature-based UI components (Mantine + Tailwind)
- `hooks/`: reusable React hooks for recording/transcription flows
- `lib/`: core logic (OpenAI/Azure clients, audio processing, IndexedDB via Dexie in `lib/db.ts`)
- `types/`: shared TypeScript types
- `public/`: static assets (including `public/ffmpeg-core/` vendor files)
- `infrastructure/`: Azure IaC (Bicep) and deployment tooling

## Build, Test, and Development Commands

- Prereqs: Node.js 20+ and npm 10+
- `npm ci`: install dependencies (uses `package-lock.json`)
- `npm run dev`: run locally at `http://localhost:3000`
- `npm run build`: production build (run before opening a PR)
- `npm start`: serve a built app
- `npm run lint`: ESLint (Next.js core-web-vitals + TypeScript rules)
- `npm run type-check`: `tsc --noEmit` with `strict: true`
- `node scripts/validate-config.mjs`: validate `.env.local` without starting the server
- `make help`: list Makefile shortcuts (wrapping the npm commands above)

## Coding Style & Naming Conventions

- Use TypeScript and React function components; avoid `any` (ESLint warns on it).
- Match existing formatting: 2-space indentation, double quotes, semicolons.
- Naming patterns:
  - files: `kebab-case.ts` / `kebab-case.tsx`
  - components/types: `PascalCase`
  - functions/vars: `camelCase`
- Prefer `@/…` imports (configured via `tsconfig.json` paths) over deep relative paths.

## Testing Guidelines

- `npm run test`: run unit tests with Vitest (see `vitest.config.ts`)
- `npm run test -- --coverage`: run tests with coverage (used by CI)
- Test locations: `lib/**/__tests__/` and `hooks/**/__tests__/` using `*.test.ts(x)`
- For UX-impacting changes, do a quick manual pass: upload/record → transcribe → analyze → export.

## Commit & Pull Request Guidelines

- Follow the repo’s Conventional Commit style: `feat: …`, `fix(scope): …`, `docs: …`, `chore: …`, `ci: …`.
- PRs should include: summary, testing notes, screenshots for UI changes, and linked issues (e.g. `Fixes #123`).

## Security & Configuration Tips

- Never commit secrets; use `.env.local` (copy from `.env.local.example`).
- The app is designed to be browser-storage-only (IndexedDB); avoid adding server-side persistence without explicit review.
- If you add new external connections/resources, verify `next.config.mjs` CSP (`connect-src`, etc.) stays correct.

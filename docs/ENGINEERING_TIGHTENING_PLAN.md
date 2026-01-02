# Engineering Tightening Plan

This plan breaks down the key engineering tighten-ups identified in the app review into executable workstreams. Each section includes concrete steps and “done” checks so it can be used as an implementation checklist.

## 1) Testing & CI (make tests real)

- Decide the test stack (recommended: `vitest` + `@testing-library/react` + `jsdom` for hooks/components; optional `playwright` for end-to-end).
- Wire up tooling:
  - Add `vitest` config + `test` script in `package.json` (replace the placeholder).
  - Ensure tests run in CI with `npm ci`, `npm run lint`, `npm run type-check`, `npm test`.
- Establish a minimum smoke suite (high value, low maintenance):
  - Upload/record → transcribe → analyze (mock APIs where needed) to validate state transitions.
  - IndexedDB persistence: save/load transcript + analysis.
- Add test naming and location conventions (e.g. `*.test.ts(x)` colocated or under `__tests__/`).
- Done when: `npm test` runs locally + in CI, and at least a small smoke suite fails when core flows break.

## 2) Logging & observability (reduce noise + protect PII)

- Introduce a small logger wrapper (e.g. `lib/logger.ts`) with levels (`debug/info/warn/error`) and a `LOG_LEVEL` env var.
- Replace raw `console.log` in server routes with structured logs (include route, request id, durations, provider, model/deployment).
- Add PII-safe logging rules:
  - Never log full transcript text, API keys, or raw model prompts/responses in production.
  - Redact/shorten fields (hash transcript ids, truncate content).
- Add request correlation:
  - Generate/propagate a request id per API request (middleware/header).
- Done when: production logs are structured, low-noise, and do not contain transcript text or secrets.

## 3) CSP tightening (remove unsafe in prod)

- Make `script-src` conditional: allow `'unsafe-eval'` only in development; disallow in production.
- Validate the CSP against app features (FFmpeg workers, audio, Azure endpoints) and add only what’s needed.
- Optional hardening:
  - Add CSP reporting (`report-to` / `report-uri`) to measure violations safely.
- Done when: production CSP no longer includes `'unsafe-eval'` and the app still works end-to-end.

## 4) Rate limiting & abuse protection (transcribe/analyze/citations)

- Add per-endpoint rate limiting for `/api/transcribe`, `/api/analyze`, `/api/citations`:
  - Decide strategy: in-app middleware (basic) vs. shared store (recommended for multi-replica: Redis/Upstash/Azure Cache) vs. Azure ingress/front door rules.
- Add request safety limits:
  - Enforce max payload sizes, max concurrent jobs per client, and explicit timeouts.
  - Return actionable 429/503 responses with retry guidance.
- Done when: abusive traffic is throttled and legitimate users get predictable errors instead of timeouts.

## 5) Config/secrets consistency (validate + Key Vault parity)

- Extend env validation to include citations-specific env vars:
  - `AZURE_OPENAI_CITATIONS_DEPLOYMENT`, `AZURE_OPENAI_CITATIONS_API_VERSION`, and `OPENAI_CITATIONS_MODEL`.
- Add Key Vault mappings for citations env vars so production doesn’t rely on plain env.
- Update `/api/config/status` to report citations readiness (without leaking secrets).
- Ensure docs (`.env.local.example`, `lib/docs/ENV_SETUP.md`, `DEPLOYMENT.md`) match the code defaults.
- Done when: misconfigurations fail fast with clear errors, and Key Vault covers all required secrets.

## 6) Build/deploy determinism (Next tracing root + lockfiles)

- Fix Next build warning by setting `outputFileTracingRoot` in `next.config.mjs` to the repo root.
- Audit for stray lockfiles in parent directories impacting builds; document the expected root.
- Add a “predeploy” checklist command (or script) that runs `lint`, `type-check`, and `build`.
- Done when: builds are deterministic in Docker/Azure and no longer depend on external lockfiles.

## 7) Citations quality + cost/latency guardrails (LLM-only)

- Add explicit controls:
  - Feature flag (env) to enable/disable citations in production.
  - Hard caps: max sections, max chunks, max segments processed, and max output citations per section.
- Add caching:
  - Cache citations by `(transcriptId, analysisId, templateId)` to avoid re-running on refresh.
- Add UX affordances:
  - “Retry citations” button and clear empty-state messaging when citations are disabled/unavailable.
- Done when: citations are consistently meaningful, controllable in cost, and failures are user-visible/recoverable.


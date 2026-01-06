# RTASS Frontend Audit (Operations, Design, UX)

**Date:** 2026-01-02  
**Repo:** `COARTASS` @ `aaf885cbe604231d523e5da52dd6cea8d1f47c2c`

This report focuses on frontend quality, stability, performance, and RTASS feature completeness. It includes concrete bugs with file references and recommended fixes.

## Implementation Tracker

### P0 — Bugs / Broken UX (fix first)
- [x] Home “configured” gating calls the wrong endpoint (`app/page.tsx:28`, `app/api/transcribe/route.ts:938`, `app/api/config/status/route.ts:42`)
- [x] Built-in rubrics list parsing expects wrong response shape (`app/rubrics/page.tsx:56`, `app/api/rtass/rubrics/route.ts:71`, `lib/api-utils.ts:48`)
- [x] `useAllRtassRubrics` uses `useState` for side effects + wrong API shape (`hooks/use-rtass-rubrics.ts:144`)
- [x] “Enable Speaker Detection” toggle is misleading/no-op (model-driven) (`app/upload/page.tsx:597`, `app/api/transcribe/route.ts:775`)
- [x] Skip link target missing (`components/layout/skip-to-content.tsx:10`, `app/layout.tsx:45`)
- [x] Audio player calls `setState` during render (`components/audio/audio-player.tsx:95`)

### P1 — Quality / Performance Wins
- [x] Audio “Retry” hard reloads the page; prefer re-init audio/wavesurfer (`components/audio/audio-player.tsx:163`, `components/audio/radio-playback-interface.tsx:382`)
- [x] Transcript search is a full scan; replace with token-indexed search + pagination (`types/transcript.ts:1`, `lib/db/search.ts:1`, `lib/db/core.ts:178`, `lib/db/transcripts.ts:1`, `app/transcripts/page.tsx:1`)
- [x] Deleting a transcript leaves orphaned `audioFiles` + RTASS scorecards (`lib/db/transcripts.ts:204`, `lib/db/core.ts:56`, `lib/db/core.ts:152`)
- [x] “Clear all data” does not clear waveform-peaks IndexedDB cache (`lib/db/core.ts:235`, `components/audio/waveform-player.tsx:89`)
- [x] Waveform peaks cache has no eviction/TTL (`components/audio/waveform-player.tsx:89`, `components/audio/waveform-player.tsx:306`)
- [x] Branding/copy drift (“Meeting Transcriber”, “Record Meeting”) (`BRANDING.md:1`, `DEPLOYMENT.md:1`, `docker-compose.yml:1`, `next.config.mjs:1`, `middleware.ts:1`)
- [x] Settings copy is provider-ambiguous (Azure vs OpenAI) (`components/layout/settings-dialog.tsx:184`, `app/api/config/status/route.ts:54`)
- [x] API response shapes inconsistent; standardize on `{ success, data }` / `{ success, error, details }` (`lib/api-utils.ts:1`, `app/api/config/status/route.ts:1`, `app/api/chat/route.ts:1`, `app/api/pdf/scorecard/route.ts:1`)

### P2 — Feature Adds (high value)
- [x] Rubric UX: detail view, import/export, duplicate built-ins to custom, batch scoring + compare (`app/rubrics/page.tsx:1`, `app/rubrics/[id]/page.tsx:1`, `components/rtass/scorecard-runner.tsx:1`)
- [x] Scorecards: progress + cancel, compare runs, export PDF/CSV/JSON (`components/rtass/scorecard-runner.tsx:1`, `components/rtass/scorecard-viewer.tsx:1`)
- [x] Storage UX: storage breakdown, peaks purge, proactive quota warnings (`components/layout/settings-dialog.tsx:1`, `lib/db/storage.ts:1`, `lib/db/core.ts:1`)

---

## P0 Findings (Details + Recommended Fix)

### 1) Home configuration gating uses the wrong endpoint
**Symptom:** Home checks `/api/transcribe` and treats `success: true` as “configured”, but `/api/transcribe` GET always returns `success: true` even when env vars are missing.  
**Impact:** UI can show “ready” even when scoring/transcription will fail.  
**Fix:** Use `/api/config/status` and check `configured`. Consider caching the result briefly or sharing a small client hook.

References: `app/page.tsx:28`, `app/api/transcribe/route.ts:938`, `app/api/config/status/route.ts:42`.

### 2) Built-in rubrics list parsing expects the wrong response shape
**Symptom:** Rubrics page reads `data.rubrics`, but the API returns `{ success: true, data: [...] }`.  
**Impact:** Built-in rubrics likely never render; users see “0 built-in” even when present.  
**Fix:** Update the client to read `payload.data` (or standardize the API response shape everywhere).

References: `app/rubrics/page.tsx:56`, `app/api/rtass/rubrics/route.ts:71`, `lib/api-utils.ts:48`.

### 3) `useAllRtassRubrics` performs a fetch in `useState`
**Symptom:** Uses `useState(() => { fetchBuiltIn() })` instead of `useEffect`, and also expects `data.rubrics`.  
**Impact:** Non-deterministic behavior and a broken export for future callers.  
**Fix:** Use `useEffect` and parse `payload.data`. Also avoid unsafe type casts when merging built-in list items with full custom templates.

Reference: `hooks/use-rtass-rubrics.ts:144`.

### 4) Speaker detection toggle is misleading
**Symptom:** UI exposes `enableSpeakerDetection`, but server does not use it to change behavior; diarization is determined by `model`.  
**Impact:** Users believe they toggled a feature, but output does not change.  
**Fix:** Either remove the toggle, or bind it to model selection (toggle selects diarize vs standard), and ensure UI copy reflects this.

References: `app/upload/page.tsx:597`, `app/api/transcribe/route.ts:775`.

### 5) Skip-to-content link target missing
**Symptom:** Skip link points to `#main-content`, but `<main>` lacks that id (and the skip component isn’t currently wired in at root layout).  
**Impact:** Keyboard/screen reader users lose a key navigation affordance.  
**Fix:** Render `SkipToContent` at the top of the layout and set `<main id="main-content" tabIndex={-1}>`.

References: `components/layout/skip-to-content.tsx:10`, `app/layout.tsx:45`.

### 6) Audio player sets state during render
**Symptom:** `AudioPlayer` calls `setIsRetrying(false)` while rendering when error state clears.  
**Impact:** React warnings, potential render loops.  
**Fix:** Move reset logic to a `useEffect` keyed on `hasError` + `isRetrying`.

Reference: `components/audio/audio-player.tsx:95`.

---

## Notes (General Observations)
- The repo already includes some “good hygiene” patterns: cancellation guards in Settings dialog, rate-limit checks, consistent API helpers in some routes, and good type-check/lint coverage.
- Biggest quality risks are “silent mismatches” (API response shape vs client parsing, UI options that don’t map to behavior, and storage lifecycle gaps that will surface over time).

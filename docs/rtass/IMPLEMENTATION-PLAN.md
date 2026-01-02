# Implementation Plan (Developer-Facing): Austin RTASS MVP

This plan turns `docs/rtass/PRD.md` into an executable build sequence for the existing Next.js app.

## 0) Ground Rules

- Preserve the current security model: **no server-side persistence** for user content.
- Reuse existing working pieces wherever possible:
  - transcription pipeline (`/api/transcribe`)
  - timestamped transcript + jump-to-timestamp UI
  - PDF export foundation
  - IndexedDB patterns (Dexie + `lib/db.ts`)

## 1) Product Rename + Domain Context

1. Replace “Meeting Transcriber” naming with “Austin RTASS”.
2. Replace Austin Public Health meeting-language prompts with AFD evaluator language:
   - update evaluator context (`lib/evaluator-prompt.ts`)
   - update any “meeting analyst” system prompts inside analysis strategies
3. Update onboarding/help text for trainers and iPad-first “upload audio” usage.

## 2) Data Model (IndexedDB)

Add Dexie tables and types:

### `incidents`
- `id`, `createdAt`, `updatedAt`
- metadata fields (incident number, type, location, date/time, channel, units, notes)
- `transcriptId?`, `audioFileId?`

### `rtassRubricTemplates`
- store `RtassRubricTemplate` from `docs/rtass/SCORING-SCHEMA.md`

### `rtassScorecards`
- store `RtassScorecard` from `docs/rtass/SCORING-SCHEMA.md`
- indexed by `incidentId`, `transcriptId`, `rubricTemplateId`, `createdAt`

## 3) UI Surfaces (MVP)

### 3.1 Navigation
- Add an “Incidents” section as the primary landing area.
- Keep “Templates” but split:
  - “Rubrics” (RTASS scoring templates)
  - (optional) legacy “Analysis templates” hidden or moved

### 3.2 Incident Detail
- Incident metadata panel.
- Transcript + audio player panel (reuse existing transcript/audio components).
- “Run Scorecard” action:
  - pick rubric template
  - show scoring progress
  - store scorecard

### 3.3 Rubric Builder
- Create/edit rubric sections and criteria (no prompt editing required).
- Validate weights and required fields (client-side).

### 3.4 Scorecard Viewer
- Overall score/status + per-section breakdown.
- Criterion table with verdict, confidence, rationale, and evidence.
- Evidence timestamp links jump to playback.
- Trainer notes + manual override (tracks “human reviewed”).

### 3.5 Export
- New PDF export layout for scorecards (report-card format).

## 4) Scoring Engine

### 4.1 Prompt generation
- Convert a rubric section into an LLM request:
  - transcript (timestamped segments)
  - section + criteria definitions
  - optional supplemental material (policy excerpts)

### 4.2 Execution
- Run section calls in batches (`concurrency=5`).
- Validate each section JSON response; retry with a stricter “JSON only” instruction.
- If a section fails after retries:
  - mark section as incomplete
  - continue to produce a partial scorecard with warnings

### 4.3 Local scoring
- Apply rules in `docs/rtass/SCORING-SCHEMA.md`:
  - weighted averages
  - `not_observed` handling
  - thresholds → pass/needs-improvement/fail

## 5) Template Seeding (AFD Starter)

Add at least one built-in rubric template:
- “AFD A101.6 Radio Compliance (MVP)”
  - initial report/size-up
  - command establishment/transfer
  - CAN reports
  - benchmark announcements
  - MAYDAY protocol readiness (if present)

## 6) QA Checklist (MVP)

- Upload audio → transcribe → run scorecard → export PDF.
- Verify evidence links jump to correct timestamps.
- Verify “not observed” appears instead of invented answers.
- iPad smoke test: upload-only workflow, large tap targets, readable scorecard.


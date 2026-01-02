# Product Requirements Document (PRD): Austin RTASS MVP

## 1. Summary

Austin RTASS (Radio Transcription Analysis Scoring System) is a browser-only web app for Austin Fire Department training staff to upload fireground radio audio, transcribe it, evaluate performance against configurable scoring rubrics, and export an auditable “incident report card” with timestamped evidence.

This MVP is a conversion of the existing root app (“Meeting Transcriber”).

## 2. Users

- Primary: AFD training officers and instructors (non-technical).
- Secondary: Company officers reviewing performance.

## 3. Goals

- Turn a radio audio file into a scored, evidence-linked report card in minutes.
- Let trainers create/edit rubrics (multi-section criteria with weights and thresholds).
- Keep the existing privacy model: **all data stays in the browser** (IndexedDB).

## 4. Non-Goals (MVP)

- Multi-user accounts, server-side storage, org-wide sharing.
- Automated rubric generation from policy uploads (Phase 2+).
- Full CAD/VisiNet integration (Phase 2+; MVP supports “not observed” and optional manual inputs later).

## 5. Core Workflow (MVP)

1. **Create incident** (metadata + optional notes).
2. **Upload audio** (iPad-friendly) or record (where supported).
3. **Transcribe** (default diarization model; speaker labels when available).
4. **Score** using a selected RTASS rubric template.
5. **Review** scorecard; optionally add trainer notes/overrides.
6. **Export** scorecard (PDF + optional JSON).

## 6. Functional Requirements

### FR-1 Incident management (browser-only)
- Create/edit incident metadata: incident number, type, date/time, location, channel, units, notes.
- Link incident to transcript + audio + scorecards.

### FR-2 Rubric templates (trainer-authored)
- Create/edit rubric templates with:
  - sections, criteria, weights, “required” flags, thresholds
  - criterion types: boolean / graded / enum / timing
- Ship with built-in AFD starter templates (at least one A101.6 compliance rubric).

### FR-3 Scoring engine (LLM)
- Run rubric scoring by section-batched LLM calls (default concurrency 5).
- Produce strict JSON outputs per section and merge into a single scorecard.
- Handle missing evidence with `not_observed` rather than guessing.

### FR-4 Evidence + playback linkage
- Every criterion result can show one or more evidence quotes with transcript timestamps.
- Clicking evidence jumps to the corresponding transcript/audio time (existing capability).

### FR-5 Export
- Generate a print-friendly PDF scorecard:
  - incident header
  - overall score + status
  - per-section breakdown
  - criterion table with verdicts + evidence timestamps
  - trainer notes

## 7. UX / Accessibility Requirements

- Classroom-friendly: high contrast, large typography, scannable scorecards.
- Touch-friendly: large tap targets for iPad use.
- Clear loading/progress for transcription + scoring.

## 8. Acceptance Criteria (MVP)

- Given an uploaded audio file, the user can produce a scorecard that:
  - contains per-criterion verdicts and evidence timestamps
  - never fabricates missing information (uses `not_observed`)
  - can be exported as PDF
- Trainers can create and edit a rubric template without editing prompts directly.

## 9. Key Risks / Open Questions

- Some “13 timing benchmarks” may not be inferable from radio traffic alone; MVP must communicate “not observed” clearly.
- iPad Safari limitations for recording/system audio; MVP should emphasize upload-first flow.


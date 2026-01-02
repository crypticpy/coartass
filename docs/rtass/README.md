# Austin RTASS (Radio Transcription Analysis Scoring System)

This folder contains planning artifacts for converting the existing “Meeting Transcriber” app into **Austin RTASS** for Austin Fire Department (AFD) training.

Key constraints and assumptions for MVP:
- **Browser-only data**: incidents, transcripts, templates, and scorecards stay in IndexedDB (no server-side persistence).
- **Evidence-linked scoring**: all findings should reference transcript timestamps (existing app already supports timestamped segments and “jump to timestamp” playback).
- **Flexible rubrics**: trainers can author multi-section scoring templates (criteria + weights + thresholds), and the app can batch LLM calls and compile a single scorecard report.

Start here:
- `docs/rtass/PRD.md` — product requirements for RTASS MVP
- `docs/rtass/SCORING-SCHEMA.md` — rubric template + scorecard output schema
- `docs/rtass/LLM-CONTRACT.md` — JSON contracts and batching approach for LLM scoring
- `docs/rtass/ROADMAP.md` — phased build plan
- `docs/rtass/SOURCE-NOTES.md` — distilled AFD requirements and sources from `OLD_Sites/AFD_Transcriber`


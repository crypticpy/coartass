# Austin RTASS Roadmap (Conversion + MVP)

## Phase 0 — Repo Conversion + Rebrand

- Create new git repo from this codebase (copy working tree, re-init git).
- Rename product text from “Meeting Transcriber” to “Austin RTASS”.
- Update evaluator / analysis context from Austin Public Health meeting language to AFD training evaluator language.
- Template seeding: add RTASS starter rubric(s) and hide/retire meeting templates for the RTASS product.

## Phase 1 — RTASS MVP Scoring (Browser-Only)

- Add new IndexedDB tables:
  - incidents
  - rtassRubricTemplates
  - rtassScorecards
- Build RTASS rubric template builder UI (sections + criteria + weights + thresholds).
- Implement scoring runner:
  - batch rubric section LLM calls (concurrency=5)
  - validate JSON per section
  - merge results and compute weighted scores
  - show progress and allow cancel/retry per section
- Build scorecard viewer:
  - overview + per-section breakdown + criterion evidence + jump-to-timestamp
  - trainer notes + manual overrides (tracked as “human reviewed”)
- Export scorecard PDF.

## Phase 2 — AFD Packs + Benchmarks

- Ship built-in rubrics:
  - A101.6 communications compliance
  - “Incident narrative” 7-section analysis (optional alongside scoring)
  - 13 timing benchmarks:
    - infer what can be inferred from transcript
    - support optional manual inputs for external timings

## Phase 3 — Policy Upload → Rubric Generation (Optional)

- Allow uploading policy/training documents and generate draft rubric templates.
- Keep browser-only if feasible; otherwise add a minimal backend service (explicitly out of MVP scope).


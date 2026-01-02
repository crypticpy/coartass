# Source Notes (AFD / Fireground)

This document distills the key requirements for Austin RTASS from prior research and AFD-specific artifacts in this repo.

## Primary Inputs In Repo

- `OLD_Sites/AFD_Transcriber/docs/real_world_requirements_analysis.md`
  - AFD “13 timing benchmarks” (Met/Missed) and a 7-section analysis structure.
  - A101.6 policy-derived radio requirements (initial report, 360, entry, CAN, command transfer, benchmarks reported to dispatch).
- `OLD_Sites/AFD_Transcriber/docs/afd_bot_instructions.md`
  - The older “bot” structure: Incident overview → VisiNet benchmarks → report card comparison → NFPA comparison → improvements → recommendations → supporting notes.
- `OLD_Sites/AFD_Transcriber/docs/mystic_oaks_incident_report.md`
  - Example incident timeline + benchmark table + an A101.6 compliance comparison formatted in tables.
- `OLD_Sites/AFD_Transcriber/docs/fire_service_ux_research.md`
  - Fire-service UX principles (large touch targets, high contrast, stress-aware UI, classroom projection use).
- `OLD_Sites/AFD_Transcriber/docs/content-structure-plan.md`
  - The classic workflow: Upload → Transcription → Analysis/Scoring → Scorecard export.

The raw source documents are also present (PDF/DOCX/XLSX) in:
- `OLD_Sites/AFD_Transcriber/user_input_files/`

## What RTASS Should Score (MVP-Oriented)

### A101.6 radio requirements (communications compliance)
- Initial arrival / size-up report elements (structure, conditions, strategy, assignments, 360 intent).
- Follow-up / 360 report (complete/not complete, updates/corrections).
- Entry report elements (entry location, TIC/heat/smoke/visibility, 2-in/2-out or exception).
- Command transfer report elements (to company officer, to chief, command post location, strategy confirmation, division/group assignments).
- CAN reports (Conditions / Actions / Needs).
- “Benchmark” announcements to dispatch (primary search complete, fire knocked down, under control, etc.).

### “13 timing benchmarks” (performance benchmarks)
The benchmark list is real and should be supported, but **not all timings are guaranteed to be observable in radio traffic alone**.
For MVP, treat each benchmark as one of:
- **Radio-observable**: can be inferred from transcript timestamps (e.g., “Command established”, “Primary search complete” if explicitly transmitted).
- **External-data**: needs CAD/VisiNet timestamps (optional in later phases via manual entry or document upload).
- **Unknown**: not present in transcript; should be scored as “Not Observed” rather than forcing a guess.

## MVP Scoring Principle

Every scored criterion must return:
- A verdict (Met / Missed / Partial / Not Observed / Not Applicable)
- A short rationale
- Timestamp evidence (one or more supporting transcript excerpts with [seconds] references)


# Changelog

All notable changes to Austin RTASS will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.9.3] - 2026-01-20

### Fixed

- **Critical Deployment Fix**: Corrected all Azure deployment configurations that were incorrectly pointing to meeting transcriber resources (`ca-mtranscriber-prod`) instead of Austin RTASS resources (`ca-austin-rtass-prod`). This prevents accidental deployments to the wrong container app.

- **PDF Export**: Fixed React error #31 with defensive string coercion in PDF generation. Removed invalid Font.register calls that were breaking server-side PDF generation.

- **Scorecard PDF**: Migrated to client-side react-pdf for reliable PDF export.

### Added

- **Scorecard PDF Layout**: Restructured PDF layout with dedicated section breakdown page for better readability.

- **User-Configurable Model Settings**: Added settings UI for configuring AI model and reasoning effort level.

### Changed

- **Infrastructure Security**: Instance-specific Azure documentation (`AZURE_CONTAINER_APPS_GUIDE.md`) is now gitignored to prevent exposing infrastructure details. Generic deployment templates remain in repo with placeholders.

- **GitHub Actions**: All workflows updated to use correct `austin-rtass` naming conventions.

## [0.9.2] - 2025-12-10

### Fixed

- **Timestamp NaN in Evaluation Pass**: Fixed critical issue where timestamps were becoming NaN after the self-evaluation/quality check pass. Added strict timestamp validation to `isValidEvaluationResponse()` for all nested arrays (actionItems, decisions, quotes, agendaItems).

- **Timestamp Recovery**: Added `repairTimestamps()` function that recovers valid timestamps from draft results when the evaluation pass returns invalid values. This provides a safety net for inconsistent LLM responses.

### Improved

- **Validation Strictness**: Enhanced response validation to explicitly check timestamp values are valid numbers (not NaN, not undefined, >= 0) before accepting evaluation results.

- **Debug Logging**: Added detailed logging when timestamp repairs occur, making it easier to diagnose any remaining timestamp issues.

## [0.9.1] - 2025-12-10

### Fixed

- **Timestamp Preservation in Analysis**: Fixed issue where the self-evaluation phase was wiping out timestamps extracted during initial analysis. The evaluator prompt now explicitly shows timestamp data and instructs the LLM to preserve all timestamp values.

- **Upload Progress Status**: Fixed UI getting stuck on "Uploading..." during server-side transcription. Added proper detection of upload completion so the UI now correctly shows "Transcribing..." while OpenAI processes the audio.

- **Multi-part Upload Messaging**: Changed confusing "Uploading (part X/Y)..." messages to "Uploading X audio chunks..." for parallel multi-part uploads, since parts upload simultaneously rather than sequentially.

### Improved

- **Timestamp Extraction**: Enhanced timestamp extraction instructions with explicit conversion rules and worked examples showing how to convert [MM:SS] markers to seconds.

- **Timestamp Validation**: Enhanced `validateTimestamps()` to flag timestamp=0 as suspicious (likely unset by LLM), helping catch extraction issues.

### Security

- Updated base Docker image and dependencies to address CVE vulnerabilities
- Recording pipeline unification for improved security

### Changed

- Export functionality improvements
- Template system updates
- Various UI refinements

## [0.9.0] - 2025-11-30

### Added

- Initial production release
- Audio transcription with Whisper and GPT-4o Transcribe models
- AI-powered meeting analysis with customizable templates
- Live audio recording with microphone, system audio, and commentary modes
- Local-only data storage using IndexedDB
- PDF, Markdown, and text export formats
- Q&A chat interface for transcript queries
- Azure OpenAI and standard OpenAI API support
- Docker deployment with Azure Container Apps
- Multi-language transcription support
- Speaker diarization
- Extended context support for long transcripts (GPT-4.1)

---

## Version History

| Version | Date       | Highlights                                               |
| ------- | ---------- | -------------------------------------------------------- |
| 0.9.3   | 2026-01-20 | Critical deployment fix, PDF export improvements         |
| 0.9.2   | 2025-12-10 | Timestamp NaN fix in evaluation pass, timestamp recovery |
| 0.9.1   | 2025-12-10 | Timestamp fixes, upload progress improvements            |
| 0.9.0   | 2025-11-30 | Initial production release                               |

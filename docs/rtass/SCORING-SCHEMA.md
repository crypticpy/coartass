# RTASS Scoring Schema (Templates + Scorecards)

Austin RTASS needs **rubric-first templates** (what to score) and **auditable scorecards** (what was found, with evidence).

This schema is intended to be stored client-side (IndexedDB) and used to generate LLM prompts + validate LLM JSON responses.

## 1) Rubric Template (Trainer-Authored)

### `RtassRubricTemplate`
- `id: string` (uuid)
- `name: string` (e.g., “AFD A101.6 Radio Compliance”)
- `description: string`
- `version: string` (e.g., “1.0.0”)
- `jurisdiction?: string` (e.g., “AFD”)
- `tags?: string[]` (e.g., `["structure-fire","training"]`)
- `createdAt: Date`
- `updatedAt?: Date`
- `sections: RtassRubricSection[]`
- `scoring: RtassScoringConfig`
- `llm: RtassLlmConfig` (batching + response rules)

### `RtassRubricSection`
- `id: string` (kebab-case stable id, e.g., `arrival-size-up`)
- `title: string`
- `description?: string`
- `weight: number` (0..1; section weights should sum to 1.0)
- `criteria: RtassCriterion[]`

### `RtassCriterion`
- `id: string` (kebab-case stable id, e.g., `announce-command`)
- `title: string`
- `description: string` (what the evaluator checks)
- `required: boolean` (safety-critical / must-pass style flags)
- `weight?: number` (optional; relative within section; if omitted, even split)
- `type: "boolean" | "graded" | "enum" | "timing"`
- `grading?: { minScore?: number; maxScore?: number }` (for `graded`)
- `enumOptions?: string[]` (for `enum`)
- `timing?: { startEvent: string; endEvent: string; targetSeconds?: number; maxSeconds?: number }`
- `evidenceRules?: { minEvidence: number; requireVerbatimQuote?: boolean }`
- `notes?: string` (trainer-facing guidance)

## 2) Scorecard Output (LLM + Local Computation)

### Verdict model
Use a *verdict + score* approach so scoring remains flexible:
- `verdict: "met" | "missed" | "partial" | "not_observed" | "not_applicable"`
- `score: number` (0..1)
  - `met` → 1.0
  - `missed` → 0.0
  - `partial` → (0..1)
  - `not_observed` → null (or omit) and excluded from weighting unless `required=true`
  - `not_applicable` → null (or omit) and excluded from weighting

### Evidence model
- `evidence: { quote: string; start: number; end?: number; speaker?: string; relevance?: number }[]`
  - `start` is **seconds** and should line up with transcript segment timestamps.

### `RtassScorecard`
- `id: string` (uuid)
- `incidentId: string`
- `transcriptId: string`
- `rubricTemplateId: string`
- `createdAt: Date`
- `modelInfo: { provider: "azure-openai" | "openai"; model: string; deployment?: string }`
- `overall: { score: number; status: "pass" | "needs_improvement" | "fail"; notes?: string }`
- `sections: RtassScorecardSection[]`
- `warnings?: string[]` (missing evidence, low confidence, etc.)
- `humanReview?: { reviewed: boolean; reviewer?: string; reviewedAt?: Date; notes?: string }`

### `RtassScorecardSection`
- `sectionId: string`
- `title: string`
- `weight: number`
- `score: number`
- `status: "pass" | "needs_improvement" | "fail"`
- `criteria: RtassScorecardCriterion[]`

### `RtassScorecardCriterion`
- `criterionId: string`
- `title: string`
- `verdict: "met" | "missed" | "partial" | "not_observed" | "not_applicable"`
- `score?: number` (0..1, omitted for N/A / Not Observed)
- `confidence: number` (0..1)
- `rationale: string` (1–3 sentences)
- `evidence: Array<{ quote: string; start: number; end?: number; speaker?: string }>`
- `observedEvents?: Array<{ name: string; at: number }>` (optional; supports timing criteria)

## 3) Scoring Rules (Local)

- Compute criterion contribution as: `criterionWeight * score`.
- Exclude `not_applicable` criteria from denominators.
- For `not_observed`:
  - If `required=false`: exclude from denominators and add a warning.
  - If `required=true`: treat as `missed` unless trainer config says otherwise.
- Section score is weighted average of its applicable criteria.
- Overall score is weighted average of section scores.


# LLM Contract (RTASS Scoring)

RTASS should generate scorecards by sending **rubric sections** to the LLM in **concurrent batches** and merging the JSON results locally.

## Why section-based calls
- Keeps prompts small and predictable.
- Enables parallelism (batch of 5 sections at a time).
- Keeps scorecard auditable (each section yields its own criterion results + evidence).

## Input to Each LLM Call

For a single rubric section:
- System: “AFD training evaluator; do not speculate; only score what is in the transcript; produce JSON only.”
- User content:
  - Transcript text with timestamp markers / segments (the app already has this).
  - `section`: title/description/weight.
  - `criteria[]`: ids, titles, descriptions, types, required flags, and any timing targets.
  - Optional: “supplementalMaterial” (policy excerpts) as extra context.

## Output JSON (per section)

The model must respond with **valid JSON only** in this structure:

```json
{
  "sectionId": "arrival-size-up",
  "criteria": [
    {
      "criterionId": "announce-command",
      "verdict": "met",
      "score": 1,
      "confidence": 0.83,
      "rationale": "Clear command assumption and tactical channel stated.",
      "evidence": [
        { "quote": "Engine 25 assuming command on FTAC 205...", "start": 90, "speaker": "ENG25" }
      ],
      "observedEvents": [
        { "name": "command_assumed", "at": 90 }
      ]
    }
  ],
  "sectionNotes": "Optional evaluator notes.",
  "warnings": ["Optional warning strings."]
}
```

## Batching Strategy

- Default: `concurrency = 5` section calls at a time.
- Retry policy:
  - Retry on transient errors and JSON parse errors (with a “return JSON only” reminder).
  - If a section fails after retries: mark section as “incomplete” with a warning and continue (don’t lose the whole scorecard).

## Non-Speculation Rules (Hard Requirements)

The LLM must:
- Use `not_observed` when the transcript does not contain enough evidence.
- Never invent times, units, or actions.
- Provide timestamp evidence for any `met/missed/partial` verdict unless explicitly impossible.
- Prefer short verbatim quotes from transcript segments.


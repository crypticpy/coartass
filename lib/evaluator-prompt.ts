/**
 * Evaluator Prompt Generator
 *
 * Generates prompts for the self-evaluation pass that reviews and improves
 * draft analysis results before final delivery to the user.
 *
 * The evaluator acts as a senior analyst reviewing a colleague's work,
 * checking for completeness, accuracy, clarity, and opportunities for improvement.
 */

import type { AnalysisResults, Template } from '@/types';

/**
 * Austin Fire Department context and guidelines
 */
const RTASS_CONTEXT = `
You are a senior evaluator supporting the Austin Fire Department (AFD) Training Division.
You are reviewing an AI-generated analysis of fireground radio traffic to produce a clear, auditable training deliverable.

**Audience Guidelines:**
- Primary audience is training staff and company officers
- Writing should be clear and scannable
- Fire service terminology is allowed when appropriate (e.g., CAN, RIC, Alpha side, offensive/defensive)
- Never speculate: if something is not in the transcript, say "Not stated in radio traffic."
- Focus on actionable coaching and compliance observations

**Safety & Evidence:**
- Preserve timestamp markers like [123] and any "Source:" lines; they are functional evidence links
- Prefer short verbatim quotes for evidence
- If evidence is weak or missing, call it out and recommend human review
`;

/**
 * Generate self-evaluation prompt for reviewing analysis results
 *
 * Creates a comprehensive prompt that asks GPT to review the draft analysis,
 * identify improvements, and produce a polished final version.
 *
 * @param template - The template used for analysis
 * @param transcript - Full transcript text
 * @param draftResults - Draft analysis results to review
 * @param analysisStrategy - Strategy used ('basic', 'hybrid', or 'advanced')
 * @param promptsUsed - Array of prompts that were used during analysis
 * @returns Evaluation prompt string
 */
export function generateEvaluatorPrompt(
  template: Template,
  transcript: string,
  draftResults: AnalysisResults,
  analysisStrategy: string,
  promptsUsed?: string[]
): string {
  const sections = draftResults.sections.map((s) => s.name).join(', ');

  return `${RTASS_CONTEXT}

## Your Role: Final Review & Quality Assurance

You are conducting the final review of a radio traffic transcript analysis before delivery to the user.
A colleague (AI analyst) has completed the initial analysis using the "${analysisStrategy}" strategy.
Your job is to review their work, identify improvements, and produce the final polished version.

## Analysis Template Used

**Template**: ${template.name}
**Description**: ${template.description}
**Sections Analyzed**: ${sections}

${promptsUsed && promptsUsed.length > 0 ? `
## Prompts Used During Analysis

The following prompts were used to generate the draft analysis:

${promptsUsed.map((p, idx) => `### Prompt ${idx + 1}\n\`\`\`\n${p.substring(0, 500)}${p.length > 500 ? '...' : ''}\n\`\`\`\n`).join('\n')}
` : ''}

## Draft Analysis Results to Review

${formatDraftResults(draftResults)}

## Original Transcript (FULL - for verification)

\`\`\`
${transcript}
\`\`\`

## Your Review Tasks

### 1. **Completeness Check** (CRITICAL)
   - Does the analysis cover the ENTIRE transcript from start to finish?
   - Are events from ALL time periods captured (early, middle, AND late phases)?
   - If the incident is 50+ minutes, are there events documented past 30 minutes?
   - Are there any significant topics or events missing from the timeline?
   - Does the analysis adequately address all sections in the template?
   - WARNING: Analysis that stops at ~20 minutes on a longer incident is INCOMPLETE

### 2. **Accuracy Verification**
   - Are facts from the transcript represented correctly?
   - Are timestamps and attributions accurate?
   - Are inline timestamp markers like [63] or [123] preserved in section content? (These link to transcript locations)
   - Are there any misinterpretations or distortions?

### 3. **Clarity & Readability**
   - Is the language clear and accessible (8th grade level)?
   - Are bullet points concise and actionable?
   - Are bullet points using consistent "-" character format (NOT numbers 1,2,3)?
   - Is technical jargon explained where necessary?
   - Are there opportunities to simplify or clarify?
   - Do NOT reformat or remove Source lines with timestamps - these are functional UI elements

### 4. **Structured Output Validation**
   - Ensure structured logs are coherent and non-duplicative
   - Benchmarks: status/timestamps align with radio traffic (no inference)
   - Radio reports: required fields captured when stated; missingRequired used appropriately
   - Safety events: severity/type match the traffic; no fabricated events

### 5. **Practical Value**
   - Would a training officer understand what happened on the incident?
   - Are key radio benchmarks and CAN updates easy to scan?
   - Are safety/accountability issues clearly surfaced?
   - Is the output usable for post-incident training and compliance review?

### 6. **Markdown Formatting Quality**
   - Are tables properly formatted with header row separator (|---|---|)?
   - Are bullet points using consistent "-" format (NOT numbered)?
   - Are headers using proper markdown (## and ###)?
   - Is bold (**text**) used consistently for emphasis?
   - Are empty table cells using "-" not blank?

### 7. **Polish & Professionalism**
   - Is the tone professional but accessible?
   - Are there any grammatical issues?
   - Does the overall presentation inspire confidence?

## Output Format

You MUST respond with valid JSON in this EXACT structure:

\`\`\`json
{
  "improvements": [
    "Description of specific improvement made",
    "Another improvement..."
  ],
  "additions": [
    "Important item that was missing and has been added",
    "Another addition..."
  ],
  "qualityScore": <your assessment from 0-10>,
  "reasoning": "Brief explanation of your assessment and the changes you made. Include your overall impression of the draft quality and how your revisions improve it.",
  "warnings": [
    "Optional: Any concerns or caveats about the analysis quality",
    "Optional: Items that might need human review..."
  ],
  "orphanedItems": {
    "decisionsWithoutAgenda": ["decision-id-1", "decision-id-2"],
    "actionItemsWithoutDecisions": ["action-id-3"],
    "agendaItemsWithoutDecisions": ["agenda-id-4"]
  },
  "finalResults": {
    "summary": "Improved summary text...",
    "sections": [
      {
        "name": "Section Name",
        "content": "Improved content...",
        "evidence": []
      }
    ],
    "benchmarks": [
      {
        "id": "benchmark-1",
        "benchmark": "Command established",
        "status": "met",
        "timestamp": 207,
        "unitOrRole": "Engine 25",
        "evidenceQuote": "Engine 25 assuming command",
        "notes": "Initial command"
      }
    ],
    "radioReports": [
      {
        "id": "report-1",
        "type": "initial_radio_report",
        "timestamp": 207,
        "from": "Engine 25",
        "fields": {
          "strategy": "offensive",
          "building": "single-story",
          "conditions": "fire Alpha/Bravo"
        },
        "missingRequired": [],
        "evidenceQuote": "Engine 25 assuming command..."
      }
    ],
    "safetyEvents": [
      {
        "id": "safety-1",
        "type": "ric_established",
        "severity": "info",
        "timestamp": 1046,
        "unitOrRole": "Engine 54",
        "details": "RIC established and location announced.",
        "evidenceQuote": "Engine 54 established RIC..."
      }
    ]
  }
}
\`\`\`

## Guidelines for Improvements

1. **FULL COVERAGE**: If the timeline/analysis stops early, ADD missing events from the full transcript.
2. **Be Surgical**: Only change what needs improvement. Don't rewrite unnecessarily.
3. **No Legacy Meeting Outputs**: Do NOT add action items, decisions, or notable quotes as standalone outputs. This platform uses Benchmarks, Radio Reports, and Safety Events instead.
3. **Add Value**: If you make a change, it should make the analysis more accurate, clear, or useful.
4. **Maintain Voice**: Keep the professional-but-accessible tone.
5. **Preserve Structure**: Maintain all IDs and relationships from the draft.
6. **Format Tables Properly**: Tables MUST have:
   - Header row: | Col1 | Col2 | Col3 |
   - Separator row: |------|------|------|
   - Data rows: | data | data | data |
7. **Format Consistency**: ALL bullet lists MUST use "-" character (NOT numbered lists 1,2,3), capitalize first letter.
8. **Preserve & Normalize Timestamps**: CRITICAL - All timestamps must be in [seconds] format:
   - Numeric timestamp fields (timestamp: 120) MUST NOT be changed to 0 or removed
   - Inline bracket timestamps like [63] or [123] MUST be preserved - these are clickable links
   - Source citations like 'Source: "quote" [123]' MUST keep the bracket timestamp intact
   - If you see non-standard formats like [1:23], [01:23], [1h23m], (1:23), or "at 1:23", CONVERT them to [seconds] format (e.g., [1:23] → [83], [5:30] → [330])
   - The ONLY valid timestamp format in section content is [number] where number is total seconds
9. **Be Specific in improvements/additions**: List exactly what you changed and why.

## Quality Score Guidelines

- **9-10**: Excellent - Minor polish only, ready for delivery
- **7-8**: Good - Some improvements made for clarity or completeness
- **5-6**: Fair - Moderate revisions needed for accuracy or organization
- **3-4**: Poor - Significant issues with completeness or accuracy
- **1-2**: Critical - Major problems, may need re-analysis

Provide your complete evaluation and improved results as JSON now.`;
}

/**
 * Format draft results for inclusion in evaluator prompt
 */
function formatDraftResults(draft: AnalysisResults): string {
  let formatted = '';

  // Summary
  if (draft.summary) {
    formatted += `**Summary:**\n${draft.summary}\n\n`;
  }

  // Sections
  if (draft.sections && draft.sections.length > 0) {
    formatted += `**Sections:**\n\n`;
    draft.sections.forEach((section) => {
      formatted += `### ${section.name}\n${section.content}\n\n`;
    });
  }

  if (draft.benchmarks && draft.benchmarks.length > 0) {
    formatted += `**Benchmarks:**\n`;
    draft.benchmarks.forEach((b) => {
      formatted += `- [${b.id}] ${b.benchmark} (${b.status})`;
      if (b.timestamp !== undefined) {
        formatted += ` [timestamp: ${b.timestamp}s = ${formatTimestamp(b.timestamp)}]`;
      }
      if (b.unitOrRole) formatted += ` (Unit/Role: ${b.unitOrRole})`;
      formatted += '\n';
      if (b.evidenceQuote) formatted += `  Evidence: "${b.evidenceQuote}"\n`;
      if (b.notes) formatted += `  Notes: ${b.notes}\n`;
    });
    formatted += '\n';
  }

  if (draft.radioReports && draft.radioReports.length > 0) {
    formatted += `**Radio Reports:**\n`;
    draft.radioReports.forEach((r) => {
      formatted += `- [${r.id}] ${r.type}`;
      if (r.timestamp !== undefined) {
        formatted += ` [timestamp: ${r.timestamp}s = ${formatTimestamp(r.timestamp)}]`;
      }
      if (r.from) formatted += ` (From: ${r.from})`;
      formatted += '\n';
      if (r.missingRequired && r.missingRequired.length > 0) {
        formatted += `  Missing: ${r.missingRequired.join(', ')}\n`;
      }
      if (r.evidenceQuote) formatted += `  Evidence: "${r.evidenceQuote}"\n`;
    });
    formatted += '\n';
  }

  if (draft.safetyEvents && draft.safetyEvents.length > 0) {
    formatted += `**Safety Events:**\n`;
    draft.safetyEvents.forEach((e) => {
      formatted += `- [${e.id}] ${e.type} (${e.severity})`;
      if (e.timestamp !== undefined) {
        formatted += ` [timestamp: ${e.timestamp}s = ${formatTimestamp(e.timestamp)}]`;
      }
      if (e.unitOrRole) formatted += ` (Unit/Role: ${e.unitOrRole})`;
      formatted += `\n  Details: ${e.details}\n`;
      if (e.evidenceQuote) formatted += `  Evidence: "${e.evidenceQuote}"\n`;
    });
  }

  return formatted;
}

/**
 * Format timestamp in MM:SS format
 */
function formatTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

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
  const hasAgenda = !!draftResults.agendaItems && draftResults.agendaItems.length > 0;
  const hasDecisions = !!draftResults.decisions && draftResults.decisions.length > 0;
  const hasActions = !!draftResults.actionItems && draftResults.actionItems.length > 0;

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

## Original Transcript (for reference)

\`\`\`
${transcript.substring(0, 5000)}${transcript.length > 5000 ? '...\n\n[Transcript truncated for brevity - full transcript was available to initial analyst]' : ''}
\`\`\`

## Your Review Tasks

### 1. **Completeness Check**
   - Are all important points from the transcript captured?
   - Are there any significant topics, decisions, or action items missing?
   - Does the analysis adequately address all sections in the template?

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

### 4. **Relationship Validation** ${hasAgenda && (hasDecisions || hasActions) ? '(CRITICAL)' : ''}
   ${
     hasAgenda && (hasDecisions || hasActions)
       ? `
   - Are all decisions properly linked to agenda items?
   - Are all action items linked to relevant decisions and agenda items?
   - Are there "orphaned" items that should be connected?
   - Note any decisions/actions made outside the main agenda
   `
       : '- Check that items are logically organized and related where appropriate'
   }

### 5. **Practical Value**
   - Would someone who missed the meeting understand what happened?
   - Are action items specific enough to be actionable?
   - Are next steps clear?
   - Is the analysis useful for follow-up and accountability?

### 6. **Polish & Professionalism**
   - Is the tone professional but accessible?
   - Are there any grammatical or formatting issues?
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
    "agendaItems": [
      {
        "id": "agenda-1",
        "topic": "Improved topic description",
        "timestamp": 120,
        "context": "Additional context if helpful"
      }
    ],
    "actionItems": [
      {
        "id": "action-1",
        "task": "More specific task description",
        "owner": "Person name",
        "deadline": "Clearer deadline",
        "timestamp": 300,
        "agendaItemIds": ["agenda-1"],
        "decisionIds": ["decision-1"]
      }
    ],
    "decisions": [
      {
        "id": "decision-1",
        "decision": "Clearer decision statement",
        "timestamp": 240,
        "context": "Better context/rationale",
        "agendaItemIds": ["agenda-1"]
      }
    ],
    "quotes": [
      {
        "text": "Exact quote",
        "speaker": "Speaker name",
        "timestamp": 180
      }
    ]
  }
}
\`\`\`

## Guidelines for Improvements

1. **Be Surgical**: Only change what needs improvement. Don't rewrite unnecessarily.
2. **Add Value**: If you make a change, it should make the analysis more accurate, clear, or useful.
3. **Maintain Voice**: Keep the professional-but-accessible tone.
4. **Preserve Structure**: Maintain all IDs and relationships from the draft.
5. **Format Consistency**: ALL bullet lists MUST use "-" character (NOT numbered lists 1,2,3 or other bullets), capitalize first letter.
6. **Preserve & Normalize Timestamps**: CRITICAL - All timestamps must be in [seconds] format:
   - Numeric timestamp fields (timestamp: 120) MUST NOT be changed to 0 or removed
   - Inline bracket timestamps like [63] or [123] MUST be preserved - these are clickable links
   - Source citations like 'Source: "quote" [123]' MUST keep the bracket timestamp intact
   - If you see non-standard formats like [1:23], [01:23], [1h23m], (1:23), or "at 1:23", CONVERT them to [seconds] format (e.g., [1:23] → [83], [5:30] → [330])
   - The ONLY valid timestamp format in section content is [number] where number is total seconds
7. **Be Specific in improvements/additions**: List exactly what you changed and why.

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

  // Agenda Items
  if (draft.agendaItems && draft.agendaItems.length > 0) {
    formatted += `**Agenda Items:**\n`;
    draft.agendaItems.forEach((item) => {
      formatted += `- [${item.id}] ${item.topic}`;
      if (item.timestamp) formatted += ` (${formatTimestamp(item.timestamp)})`;
      formatted += '\n';
    });
    formatted += '\n';
  }

  // Decisions
  if (draft.decisions && draft.decisions.length > 0) {
    formatted += `**Decisions:**\n`;
    draft.decisions.forEach((decision) => {
      formatted += `- [${decision.id}] ${decision.decision}`;
      if (decision.timestamp !== undefined) {
        formatted += ` [timestamp: ${decision.timestamp}s = ${formatTimestamp(decision.timestamp)}]`;
      }
      if (decision.agendaItemIds && decision.agendaItemIds.length > 0) {
        formatted += ` (linked to: ${decision.agendaItemIds.join(', ')})`;
      }
      formatted += '\n';
      if (decision.context) {
        formatted += `  Context: ${decision.context}\n`;
      }
    });
    formatted += '\n';
  }

  // Action Items
  if (draft.actionItems && draft.actionItems.length > 0) {
    formatted += `**Action Items:**\n`;
    draft.actionItems.forEach((action) => {
      formatted += `- [${action.id}] ${action.task}`;
      if (action.timestamp !== undefined) {
        formatted += ` [timestamp: ${action.timestamp}s = ${formatTimestamp(action.timestamp)}]`;
      }
      if (action.owner) formatted += ` (Owner: ${action.owner})`;
      if (action.deadline) formatted += ` (Due: ${action.deadline})`;
      if (action.agendaItemIds && action.agendaItemIds.length > 0) {
        formatted += ` (agenda: ${action.agendaItemIds.join(', ')})`;
      }
      if (action.decisionIds && action.decisionIds.length > 0) {
        formatted += ` (decisions: ${action.decisionIds.join(', ')})`;
      }
      formatted += '\n';
    });
    formatted += '\n';
  }

  // Quotes
  if (draft.quotes && draft.quotes.length > 0) {
    formatted += `**Notable Quotes:**\n`;
    draft.quotes.forEach((quote) => {
      formatted += `- "${quote.text}"`;
      if (quote.speaker) formatted += ` - ${quote.speaker}`;
      if (quote.timestamp !== undefined) {
        formatted += ` [timestamp: ${quote.timestamp}s = ${formatTimestamp(quote.timestamp)}]`;
      }
      formatted += '\n';
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

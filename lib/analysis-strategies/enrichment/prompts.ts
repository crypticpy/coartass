/**
 * Enrichment Prompt Templates
 *
 * Prompt builders for the mining engine. Uses segment-ID grounding
 * to prevent hallucination (similar to citations pattern).
 *
 * Key principles:
 * 1. Reference transcript by segment ID only
 * 2. Never invent quotes or timestamps
 * 3. Return structured JSON matching expected schemas
 */

import type { MiningContext, MiningSegment } from '@/types/enrichment';
import type { Decision, ActionItem } from '@/types';

// ============================================================================
// Prompt Configuration
// ============================================================================

const MAX_SEGMENTS_FOR_PROMPT = 500;
const SEGMENT_TEXT_MAX_CHARS = 400;

// ============================================================================
// Shared Helpers
// ============================================================================

/**
 * Truncate text to max chars with ellipsis.
 */
function truncate(text: string, maxChars: number): string {
  if (!text) return '';
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxChars) return normalized;
  return `${normalized.slice(0, maxChars - 1)}…`;
}

/**
 * Format timestamp as [MM:SS] string.
 */
function formatTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `[${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}]`;
}

/**
 * Build segment list for prompt.
 * Includes ID for grounding, timestamp, speaker, and text.
 */
function buildSegmentList(segments: MiningSegment[], maxSegments: number): string {
  const limitedSegments = segments.slice(0, maxSegments);

  return limitedSegments
    .map((seg) => {
      const ts = formatTimestamp(seg.start);
      const speaker = seg.speaker ? `${seg.speaker}: ` : '';
      const text = truncate(seg.text, SEGMENT_TEXT_MAX_CHARS);
      return `[${seg.id}] ${ts} ${speaker}${text}`;
    })
    .join('\n');
}

/**
 * Build a summary of existing decisions for context.
 */
function buildDecisionsSummary(context: MiningContext): string {
  const decisions = context.existingResults.decisions ?? [];
  if (decisions.length === 0) return 'No decisions extracted yet.';

  return decisions
    .map((d: Decision) => {
      const ts = formatTimestamp(d.timestamp);
      return `- ${d.id}: ${ts} ${truncate(d.decision, 150)}`;
    })
    .join('\n');
}

/**
 * Build a summary of existing action items for context.
 */
function buildActionsSummary(context: MiningContext): string {
  const actions = context.existingResults.actionItems ?? [];
  if (actions.length === 0) return 'No action items extracted yet.';

  return actions
    .map((a: ActionItem) => {
      const ts = formatTimestamp(a.timestamp);
      const owner = a.owner ? ` (${a.owner})` : '';
      return `- ${a.id}: ${ts} ${truncate(a.task, 150)}${owner}`;
    })
    .join('\n');
}

// ============================================================================
// Combined Enrichment Prompt
// ============================================================================

/**
 * Build a combined prompt for all patterns at once.
 * Used in 'combined' mode for faster execution.
 */
export function buildCombinedEnrichmentPrompt(
  context: MiningContext,
  patternNames: string[]
): string {
  const segmentList = buildSegmentList(context.segments, MAX_SEGMENTS_FOR_PROMPT);
  const decisionsSummary = buildDecisionsSummary(context);
  const actionsSummary = buildActionsSummary(context);
  const maxQuotes = context.config.maxQuotes;

  return `
You are enriching a meeting analysis with additional context from the transcript.

## Transcript Segments
Each segment has format: [id] [timestamp] Speaker: text
${segmentList}

## Current Analysis

### Decisions
${decisionsSummary}

### Action Items
${actionsSummary}

## Your Tasks

${patternNames.includes('decision-mining') ? `
### 1. Decision Enrichment
For each decision above, find:
- WHO made or announced it (madeBy)
- WHO participated in discussing it (participants array)
- Whether it was EXPLICITLY stated or inferred from context (isExplicit)
- If there was a vote, the tally (voteTally: { for, against, abstain })
- Your confidence in this enrichment (0-1)
` : ''}

${patternNames.includes('action-mining') ? `
### 2. Action Item Enrichment
For each action item above, find:
- WHO assigned it (assignedBy - speaker who requested the action)
- Exact timestamp of assignment if different from task timestamp (assignmentTimestamp)
- Priority inferred from urgency language (priority: high/medium/low)
- Whether explicitly assigned or inferred (isExplicit)
- Your confidence in this enrichment (0-1)
` : ''}

${patternNames.includes('quote-mining') ? `
### 3. Quote Extraction
Find up to ${maxQuotes} notable quotes that:
- Are NOT already captured in decisions or action items
- Represent memorable moments, insights, concerns, or commitments
- Have clear attribution to a speaker

For each quote include:
- The exact text from the transcript
- Speaker name
- Timestamp in seconds
- Context explaining why it matters
- Category: decision|commitment|concern|insight|humor
- Sentiment: positive|negative|neutral
- Confidence score (0-1)
` : ''}

## Rules
1. ONLY reference segment IDs from the provided list
2. NEVER invent quotes - use exact text from segments
3. Timestamps must match segment timestamps
4. Return valid JSON matching the schema below

## Response Schema
{
  "actionItems": [
    {
      "id": "existing-action-id",
      "assignedBy": "Speaker Name or null",
      "assignmentTimestamp": 123.45 or null,
      "priority": "high|medium|low or null",
      "isExplicit": true|false,
      "confidence": 0.0-1.0
    }
  ],
  "decisions": [
    {
      "id": "existing-decision-id",
      "madeBy": "Speaker Name or null",
      "participants": ["Speaker1", "Speaker2"] or null,
      "isExplicit": true|false,
      "voteTally": { "for": 0, "against": 0, "abstain": 0 } or null,
      "confidence": 0.0-1.0
    }
  ],
  "quotes": [
    {
      "text": "Exact quote from transcript",
      "speaker": "Speaker Name",
      "timestamp": 123.45,
      "context": "Why this quote matters",
      "category": "decision|commitment|concern|insight|humor",
      "sentiment": "positive|negative|neutral",
      "confidence": 0.0-1.0
    }
  ]
}

Respond with JSON only.
`.trim();
}

// ============================================================================
// Pattern-Specific Prompts
// ============================================================================

/**
 * Build a prompt for a specific pattern.
 * Used in 'separate' mode for higher quality extraction.
 */
export function buildPatternPrompt(patternName: string, context: MiningContext): string {
  switch (patternName) {
    case 'decision-mining':
      return buildDecisionMiningPrompt(context);
    case 'action-mining':
      return buildActionMiningPrompt(context);
    case 'quote-mining':
      return buildQuoteMiningPrompt(context);
    default:
      throw new Error(`Unknown pattern: ${patternName}`);
  }
}

/**
 * Prompt for decision enrichment pattern.
 */
function buildDecisionMiningPrompt(context: MiningContext): string {
  const segmentList = buildSegmentList(context.segments, MAX_SEGMENTS_FOR_PROMPT);
  const decisionsSummary = buildDecisionsSummary(context);

  return `
You are enriching meeting decisions with speaker and context information.

## Transcript Segments
Each segment has format: [id] [timestamp] Speaker: text
${segmentList}

## Decisions to Enrich
${decisionsSummary}

## Your Task
For each decision, find in the transcript:
1. **madeBy**: Who announced or finalized the decision?
2. **participants**: Who participated in the discussion leading to it?
3. **isExplicit**: Was it explicitly stated ("We've decided to...") or inferred from context?
4. **voteTally**: If there was a vote, what was the count?
5. **confidence**: How confident are you in this enrichment? (0-1)

## Rules
1. ONLY reference speakers and timestamps from the provided segments
2. Look for phrases like "we've decided", "let's go with", "motion passes", etc.
3. Participants are people who spoke about the topic before the decision
4. A vote requires explicit counting ("3 in favor, 1 against")
5. If you cannot find information for a field, omit it (return null)

## Response Schema
{
  "decisions": [
    {
      "id": "decision-id-from-above",
      "madeBy": "Speaker Name",
      "participants": ["Speaker1", "Speaker2"],
      "isExplicit": true,
      "voteTally": { "for": 3, "against": 1, "abstain": 0 },
      "confidence": 0.85
    }
  ]
}

Respond with JSON only.
`.trim();
}

/**
 * Prompt for action item enrichment pattern.
 */
function buildActionMiningPrompt(context: MiningContext): string {
  const segmentList = buildSegmentList(context.segments, MAX_SEGMENTS_FOR_PROMPT);
  const actionsSummary = buildActionsSummary(context);
  const decisionsSummary = buildDecisionsSummary(context);

  return `
You are enriching meeting action items with assignment and priority information.

## Transcript Segments
Each segment has format: [id] [timestamp] Speaker: text
${segmentList}

## Action Items to Enrich
${actionsSummary}

## Related Decisions (for context)
${decisionsSummary}

## Your Task
For each action item, find in the transcript:
1. **assignedBy**: Who requested or assigned this action? (the speaker who asked for it)
2. **assignmentTimestamp**: When exactly was it assigned? (may differ from task timestamp)
3. **priority**: Infer priority from urgency language:
   - high: "urgent", "ASAP", "by end of day", "critical", "immediately"
   - medium: "soon", "this week", "when you can"
   - low: "eventually", "when possible", "nice to have"
4. **isExplicit**: Was assignment explicit ("John, can you...") or inferred from context?
5. **confidence**: How confident are you in this enrichment? (0-1)

## Rules
1. ONLY reference speakers and timestamps from the provided segments
2. The assigner is usually the speaker who made the request, not the owner
3. Look for imperative language: "please", "can you", "we need", "let's", etc.
4. If no clear priority language exists, default to medium
5. If you cannot find information for a field, omit it (return null)

## Response Schema
{
  "actionItems": [
    {
      "id": "action-id-from-above",
      "assignedBy": "Speaker Name",
      "assignmentTimestamp": 123.45,
      "priority": "high",
      "isExplicit": true,
      "confidence": 0.90
    }
  ]
}

Respond with JSON only.
`.trim();
}

/**
 * Prompt for quote extraction pattern.
 */
function buildQuoteMiningPrompt(context: MiningContext): string {
  const segmentList = buildSegmentList(context.segments, MAX_SEGMENTS_FOR_PROMPT);
  const maxQuotes = context.config.maxQuotes;
  const decisionsSummary = buildDecisionsSummary(context);
  const actionsSummary = buildActionsSummary(context);

  return `
You are extracting notable quotes from a meeting transcript.

## Transcript Segments
Each segment has format: [id] [timestamp] Speaker: text
${segmentList}

## Already Captured Content (avoid duplicating)
### Decisions
${decisionsSummary}

### Action Items
${actionsSummary}

## Your Task
Find up to ${maxQuotes} notable quotes that:
1. Are NOT already captured in decisions or action items above
2. Represent memorable moments in the meeting
3. Have clear speaker attribution
4. Add value beyond what's already extracted

## Quote Categories
- **decision**: Quotes about decisions being made
- **commitment**: Promises or pledges ("I'll make sure...", "We commit to...")
- **concern**: Objections or worries raised ("I'm worried about...", "The risk is...")
- **insight**: Valuable observations or expertise shared
- **humor**: Memorable light moments that humanize the meeting

## Rules
1. Use EXACT text from transcript segments
2. Prefer complete thoughts over fragments
3. Include enough context for the quote to be meaningful
4. Avoid short confirmations ("yes", "okay", "got it")
5. Speaker must be identifiable from the transcript
6. Timestamp must match the segment

## Response Schema
{
  "quotes": [
    {
      "text": "Exact quote from transcript",
      "speaker": "Speaker Name",
      "timestamp": 123.45,
      "context": "Why this quote is notable",
      "category": "insight",
      "sentiment": "positive",
      "confidence": 0.85
    }
  ]
}

Respond with JSON only.
`.trim();
}

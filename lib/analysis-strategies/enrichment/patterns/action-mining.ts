/**
 * Action Mining Pattern
 *
 * Enriches action items with:
 * - Who assigned the task (speaker attribution)
 * - Assignment timestamp
 * - Priority inference from urgency language
 * - Explicit vs implicit flag
 * - Confidence scores
 */

import type {
  MiningPattern,
  MiningResult,
  MiningContext,
  ActionItemEnrichment,
} from '@/types/enrichment';
import type { ActionItem } from '@/types';

/**
 * Action mining pattern configuration.
 */
export interface ActionMiningConfig {
  /** Minimum confidence threshold for enrichments (0-1) */
  minConfidence: number;

  /** Whether to infer priority from language */
  inferPriority: boolean;

  /** Priority keywords mapping */
  priorityKeywords: {
    high: string[];
    medium: string[];
    low: string[];
  };
}

/**
 * Default action mining configuration.
 */
export const DEFAULT_ACTION_MINING_CONFIG: ActionMiningConfig = {
  minConfidence: 0.5,
  inferPriority: true,
  priorityKeywords: {
    high: [
      'urgent',
      'asap',
      'immediately',
      'critical',
      'priority',
      'deadline',
      'today',
      'tomorrow',
      'end of day',
      'eod',
      'must',
      'required',
    ],
    medium: [
      'soon',
      'next week',
      'this week',
      'important',
      'should',
      'need to',
      'needs to',
    ],
    low: [
      'when possible',
      'eventually',
      'sometime',
      'maybe',
      'could',
      'might',
      'consider',
      'low priority',
    ],
  },
};

/**
 * Create the action mining pattern.
 *
 * @param config - Optional configuration overrides
 * @returns MiningPattern for action item enrichment
 */
export function createActionMiningPattern(
  config: Partial<ActionMiningConfig> = {}
): MiningPattern<ActionItemEnrichment[]> {
  const fullConfig = { ...DEFAULT_ACTION_MINING_CONFIG, ...config };

  return {
    name: 'action-mining',
    description:
      'Enriches action items with assignedBy, assignmentTimestamp, priority, and confidence',

    buildPrompt(context: MiningContext): string {
      const { segments, existingResults } = context;
      const actionItems = existingResults.actionItems ?? [];

      if (actionItems.length === 0) {
        return 'No action items to enrich. Return: {"actionItems": []}';
      }

      // Format segments with IDs
      const segmentText = segments
        .map((s) => `[${s.id}] ${s.speaker ?? 'Unknown'} (${formatTime(s.start)}): ${s.text}`)
        .join('\n');

      // Format existing action items
      const actionItemsText = actionItems
        .map(
          (a: ActionItem, i: number) =>
            `${i + 1}. [ID: ${a.id}] "${a.task}" - Owner: ${a.owner ?? 'Unknown'}` +
            (a.deadline ? ` - Due: ${a.deadline}` : '')
        )
        .join('\n');

      return `## Task: Enrich Action Items

Analyze the transcript to enrich each action item with additional context.

## Transcript (with segment IDs):
${segmentText}

## Action Items to Enrich:
${actionItemsText}

## Instructions:
For each action item, find:
1. **assignedBy**: The speaker who assigned or mentioned the task (use segment IDs to verify)
2. **assignmentTimestamp**: When the assignment occurred (in seconds)
3. **priority**: Infer from language - "high" (urgent/asap/critical), "medium" (soon/should), "low" (eventually/maybe)
4. **isExplicit**: true if task was directly stated, false if implied from context
5. **confidence**: 0.0-1.0 score for how confident you are in the enrichment

## Rules:
- ONLY use information from the transcript segments
- Do NOT invent quotes or timestamps not in segments
- Reference segment IDs when determining speaker/timestamp
- If unable to determine a field, omit it (don't guess)
- Minimum confidence threshold: ${fullConfig.minConfidence}

## Response Format (JSON):
{
  "actionItems": [
    {
      "id": "action-item-id-from-input",
      "assignedBy": "Speaker Name",
      "assignmentTimestamp": 123.45,
      "priority": "high" | "medium" | "low",
      "isExplicit": true | false,
      "confidence": 0.85
    }
  ]
}`;
    },

    parseResponse(raw: string): MiningResult<ActionItemEnrichment[]> {
      try {
        const parsed = JSON.parse(raw);
        const enrichments: ActionItemEnrichment[] = [];

        if (!parsed.actionItems || !Array.isArray(parsed.actionItems)) {
          return {
            data: [],
            metadata: {
              itemsProcessed: 0,
              itemsEnriched: 0,
              confidence: 0,
              processingTimeMs: 0,
            },
          };
        }

        for (const item of parsed.actionItems) {
          // Validate required fields
          if (!item.id) continue;

          // Filter by confidence threshold
          const confidence = item.confidence ?? 0.5;
          if (confidence < fullConfig.minConfidence) continue;

          enrichments.push({
            id: item.id,
            assignedBy: item.assignedBy,
            assignmentTimestamp: item.assignmentTimestamp,
            priority: item.priority,
            isExplicit: item.isExplicit,
            confidence,
          });
        }

        const avgConfidence =
          enrichments.length > 0
            ? enrichments.reduce((sum, e) => sum + (e.confidence ?? 0), 0) / enrichments.length
            : 0;

        return {
          data: enrichments,
          metadata: {
            itemsProcessed: parsed.actionItems.length,
            itemsEnriched: enrichments.length,
            confidence: avgConfidence,
            processingTimeMs: 0, // Set by engine
          },
        };
      } catch {
        return {
          data: [],
          metadata: {
            itemsProcessed: 0,
            itemsEnriched: 0,
            confidence: 0,
            processingTimeMs: 0,
          },
          error: 'Failed to parse action mining response',
        };
      }
    },

    shouldRun(context: MiningContext): boolean {
      const actionItems = context.existingResults.actionItems ?? [];
      return actionItems.length > 0;
    },
  };
}

/**
 * Infer priority from task description text.
 * Client-side helper for additional priority detection.
 *
 * @param text - Action item task description
 * @param config - Priority keywords configuration
 * @returns Inferred priority or undefined
 */
export function inferPriorityFromText(
  text: string,
  config: ActionMiningConfig['priorityKeywords'] = DEFAULT_ACTION_MINING_CONFIG.priorityKeywords
): 'high' | 'medium' | 'low' | undefined {
  const lowerText = text.toLowerCase();

  for (const keyword of config.high) {
    if (lowerText.includes(keyword.toLowerCase())) {
      return 'high';
    }
  }

  for (const keyword of config.medium) {
    if (lowerText.includes(keyword.toLowerCase())) {
      return 'medium';
    }
  }

  for (const keyword of config.low) {
    if (lowerText.includes(keyword.toLowerCase())) {
      return 'low';
    }
  }

  return undefined;
}

/**
 * Format time in seconds to mm:ss string.
 */
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Pre-built action mining pattern instance.
 */
export const actionMiningPattern = createActionMiningPattern();

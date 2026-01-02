/**
 * Decision Mining Pattern
 *
 * Enriches decisions with:
 * - Who made/announced the decision (speaker attribution)
 * - Participants in the discussion
 * - Vote tallies when applicable
 * - Explicit vs implicit flag
 * - Confidence scores
 */

import type {
  MiningPattern,
  MiningResult,
  MiningContext,
  DecisionEnrichment,
} from '@/types/enrichment';
import type { VoteTally, Decision } from '@/types';

/**
 * Decision mining pattern configuration.
 */
export interface DecisionMiningConfig {
  /** Minimum confidence threshold for enrichments (0-1) */
  minConfidence: number;

  /** Keywords indicating voting occurred */
  voteKeywords: string[];

  /** Keywords indicating a decision was made */
  decisionKeywords: string[];
}

/**
 * Default decision mining configuration.
 */
export const DEFAULT_DECISION_MINING_CONFIG: DecisionMiningConfig = {
  minConfidence: 0.5,
  voteKeywords: [
    'vote',
    'voted',
    'voting',
    'all in favor',
    'aye',
    'nay',
    'yea',
    'opposed',
    'abstain',
    'motion',
    'second',
    'seconded',
    'unanimous',
    'majority',
    'passes',
    'passed',
    'fails',
    'failed',
    'carried',
  ],
  decisionKeywords: [
    'decided',
    'decision',
    'agreed',
    'concluded',
    'resolved',
    'approved',
    'rejected',
    'moving forward',
    'will proceed',
    'final answer',
    'settled',
    'confirmed',
  ],
};

/**
 * Create the decision mining pattern.
 *
 * @param config - Optional configuration overrides
 * @returns MiningPattern for decision enrichment
 */
export function createDecisionMiningPattern(
  config: Partial<DecisionMiningConfig> = {}
): MiningPattern<DecisionEnrichment[]> {
  const fullConfig = { ...DEFAULT_DECISION_MINING_CONFIG, ...config };

  return {
    name: 'decision-mining',
    description:
      'Enriches decisions with madeBy, participants, voteTally, isExplicit, and confidence',

    buildPrompt(context: MiningContext): string {
      const { segments, existingResults } = context;
      const decisions = existingResults.decisions ?? [];

      if (decisions.length === 0) {
        return 'No decisions to enrich. Return: {"decisions": []}';
      }

      // Format segments with IDs
      const segmentText = segments
        .map((s) => `[${s.id}] ${s.speaker ?? 'Unknown'} (${formatTime(s.start)}): ${s.text}`)
        .join('\n');

      // Format existing decisions
      const decisionsText = decisions
        .map(
          (d: Decision, i: number) =>
            `${i + 1}. [ID: ${d.id}] "${d.decision}"` +
            (d.context ? ` - Context: ${d.context}` : '')
        )
        .join('\n');

      return `## Task: Enrich Decisions

Analyze the transcript to enrich each decision with additional context.

## Transcript (with segment IDs):
${segmentText}

## Decisions to Enrich:
${decisionsText}

## Instructions:
For each decision, find:
1. **madeBy**: The speaker who announced or finalized the decision
2. **participants**: Array of speakers who participated in discussion leading to decision
3. **voteTally**: If voting occurred, include { for: N, against: N, abstain: N }
4. **isExplicit**: true if decision was directly stated, false if implied
5. **confidence**: 0.0-1.0 score for enrichment confidence

## Vote Detection Keywords:
${fullConfig.voteKeywords.join(', ')}

## Rules:
- ONLY use information from the transcript segments
- Do NOT invent quotes or timestamps
- Reference segment IDs when determining speakers
- If unable to determine a field, omit it (don't guess)
- Only include voteTally if actual voting language is present
- Minimum confidence threshold: ${fullConfig.minConfidence}

## Response Format (JSON):
{
  "decisions": [
    {
      "id": "decision-id-from-input",
      "madeBy": "Speaker Name",
      "participants": ["Speaker A", "Speaker B"],
      "isExplicit": true | false,
      "voteTally": { "for": 5, "against": 2, "abstain": 1 },
      "confidence": 0.9
    }
  ]
}`;
    },

    parseResponse(raw: string): MiningResult<DecisionEnrichment[]> {
      try {
        const parsed = JSON.parse(raw);
        const enrichments: DecisionEnrichment[] = [];

        if (!parsed.decisions || !Array.isArray(parsed.decisions)) {
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

        for (const item of parsed.decisions) {
          // Validate required fields
          if (!item.id) continue;

          // Filter by confidence threshold
          const confidence = item.confidence ?? 0.5;
          if (confidence < fullConfig.minConfidence) continue;

          // Validate vote tally if present
          let voteTally: VoteTally | undefined;
          if (item.voteTally) {
            const vt = item.voteTally;
            if (
              typeof vt.for === 'number' &&
              typeof vt.against === 'number' &&
              typeof vt.abstain === 'number'
            ) {
              voteTally = {
                for: vt.for,
                against: vt.against,
                abstain: vt.abstain,
              };
            }
          }

          enrichments.push({
            id: item.id,
            madeBy: item.madeBy,
            participants: Array.isArray(item.participants) ? item.participants : undefined,
            isExplicit: item.isExplicit,
            voteTally,
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
            itemsProcessed: parsed.decisions.length,
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
          error: 'Failed to parse decision mining response',
        };
      }
    },

    shouldRun(context: MiningContext): boolean {
      const decisions = context.existingResults.decisions ?? [];
      return decisions.length > 0;
    },
  };
}

/**
 * Check if text contains voting language.
 * Client-side helper for vote detection.
 *
 * @param text - Text to check
 * @param keywords - Vote keywords to match
 * @returns true if voting language detected
 */
export function containsVotingLanguage(
  text: string,
  keywords: string[] = DEFAULT_DECISION_MINING_CONFIG.voteKeywords
): boolean {
  const lowerText = text.toLowerCase();
  return keywords.some((keyword) => lowerText.includes(keyword.toLowerCase()));
}

/**
 * Check if text contains decision language.
 * Client-side helper for decision detection.
 *
 * @param text - Text to check
 * @param keywords - Decision keywords to match
 * @returns true if decision language detected
 */
export function containsDecisionLanguage(
  text: string,
  keywords: string[] = DEFAULT_DECISION_MINING_CONFIG.decisionKeywords
): boolean {
  const lowerText = text.toLowerCase();
  return keywords.some((keyword) => lowerText.includes(keyword.toLowerCase()));
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
 * Pre-built decision mining pattern instance.
 */
export const decisionMiningPattern = createDecisionMiningPattern();

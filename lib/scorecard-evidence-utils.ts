/**
 * Scorecard Evidence Utilities
 *
 * Provides functions for mapping RTASS scorecard evidence to transcript segments.
 * Used to link rubric evaluations back to specific moments in the audio transcript.
 */

import type { RtassScorecard, RtassVerdict } from '@/types/rtass';
import type { TranscriptSegment } from '@/types/transcript';

/**
 * Represents an evidence marker linked to a specific transcript segment.
 * Used to highlight and navigate to evidence locations during scorecard review.
 */
export interface EvidenceMarker {
  /** ID of the criterion this evidence supports */
  criterionId: string;

  /** Human-readable title of the criterion */
  criterionTitle: string;

  /** Verdict for this criterion (met, missed, partial, etc.) */
  verdict: RtassVerdict;

  /** Verbatim quote from the transcript used as evidence */
  evidenceQuote: string;

  /** Index of the transcript segment containing this evidence */
  segmentIndex: number;

  /** Start time (in seconds) of the evidence within the transcript */
  segmentStart: number;

  /** End time (in seconds) of the evidence within the transcript */
  segmentEnd: number;
}

/**
 * Find the segment index that contains a given timestamp using binary search.
 *
 * Efficiently locates the transcript segment whose time range [start, end)
 * contains the specified timestamp. Handles edge cases like timestamps
 * before the first segment or after the last segment.
 *
 * @param timestamp - Time in seconds to locate within segments
 * @param segments - Array of transcript segments sorted by start time
 * @returns Segment index containing the timestamp, or null if not found
 *
 * @example
 * ```typescript
 * const segments = [
 *   { index: 0, start: 0, end: 5, text: "Hello" },
 *   { index: 1, start: 5, end: 10, text: "World" },
 * ];
 *
 * findSegmentForTimestamp(3, segments);  // 0
 * findSegmentForTimestamp(7, segments);  // 1
 * findSegmentForTimestamp(15, segments); // null
 * ```
 */
export function findSegmentForTimestamp(
  timestamp: number,
  segments: TranscriptSegment[]
): number | null {
  if (!segments || segments.length === 0) {
    return null;
  }

  // Validate timestamp
  if (timestamp < 0 || !isFinite(timestamp)) {
    return null;
  }

  const firstSegment = segments[0];
  const lastSegment = segments[segments.length - 1];

  // Timestamp before all segments
  if (timestamp < firstSegment.start) {
    return null;
  }

  // Timestamp after all segments
  if (timestamp >= lastSegment.end) {
    return null;
  }

  // Binary search for the segment containing this timestamp
  let low = 0;
  let high = segments.length - 1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const segment = segments[mid];

    if (timestamp >= segment.start && timestamp < segment.end) {
      return mid;
    } else if (timestamp < segment.start) {
      high = mid - 1;
    } else {
      low = mid + 1;
    }
  }

  // Handle gaps between segments: find nearest segment
  for (let i = 0; i < segments.length - 1; i++) {
    if (timestamp >= segments[i].end && timestamp < segments[i + 1].start) {
      // In a gap - return the previous segment (where the evidence likely ends)
      return i;
    }
  }

  return null;
}

/**
 * Map all evidence from a scorecard to their corresponding transcript segments.
 *
 * Iterates through all sections and criteria in the scorecard, extracting
 * evidence and linking it to the transcript segments by timestamp.
 *
 * @param scorecard - RTASS scorecard containing evaluated criteria with evidence
 * @param segments - Array of transcript segments sorted by start time
 * @returns Map where keys are segment indices and values are arrays of evidence markers
 *
 * @example
 * ```typescript
 * const evidenceMap = mapEvidenceToSegments(scorecard, transcript.segments);
 *
 * // Check if segment 5 has any evidence
 * const markers = evidenceMap.get(5) ?? [];
 * console.log(`Segment 5 has ${markers.length} evidence markers`);
 * ```
 */
export function mapEvidenceToSegments(
  scorecard: RtassScorecard,
  segments: TranscriptSegment[]
): Map<number, EvidenceMarker[]> {
  const evidenceMap = new Map<number, EvidenceMarker[]>();

  if (!scorecard?.sections || !segments || segments.length === 0) {
    return evidenceMap;
  }

  for (const section of scorecard.sections) {
    for (const criterion of section.criteria) {
      if (!criterion.evidence || criterion.evidence.length === 0) {
        continue;
      }

      for (const evidence of criterion.evidence) {
        const segmentIndex = findSegmentForTimestamp(evidence.start, segments);

        if (segmentIndex === null) {
          // Evidence timestamp doesn't match any segment - skip
          continue;
        }

        const segment = segments[segmentIndex];
        const marker: EvidenceMarker = {
          criterionId: criterion.criterionId,
          criterionTitle: criterion.title,
          verdict: criterion.verdict,
          evidenceQuote: evidence.quote,
          segmentIndex,
          segmentStart: segment.start,
          segmentEnd: segment.end,
        };

        const existing = evidenceMap.get(segmentIndex);
        if (existing) {
          existing.push(marker);
        } else {
          evidenceMap.set(segmentIndex, [marker]);
        }
      }
    }
  }

  return evidenceMap;
}

/**
 * Retrieve all evidence markers for a specific transcript segment.
 *
 * Simple accessor function to get evidence markers from a pre-computed map.
 * Returns an empty array if no evidence exists for the segment.
 *
 * @param segmentIndex - Index of the transcript segment
 * @param evidenceMap - Pre-computed map from mapEvidenceToSegments
 * @returns Array of evidence markers for the segment (empty if none)
 *
 * @example
 * ```typescript
 * const evidenceMap = mapEvidenceToSegments(scorecard, segments);
 *
 * // In a transcript renderer
 * segments.forEach((segment, index) => {
 *   const markers = getEvidenceForSegment(index, evidenceMap);
 *   if (markers.length > 0) {
 *     highlightSegment(segment);
 *   }
 * });
 * ```
 */
export function getEvidenceForSegment(
  segmentIndex: number,
  evidenceMap: Map<number, EvidenceMarker[]>
): EvidenceMarker[] {
  return evidenceMap.get(segmentIndex) ?? [];
}

/**
 * Get all segment indices that contain evidence.
 *
 * Useful for quickly identifying which segments need visual highlighting
 * or special handling in the UI.
 *
 * @param evidenceMap - Pre-computed evidence map
 * @returns Sorted array of segment indices with evidence
 *
 * @example
 * ```typescript
 * const evidenceMap = mapEvidenceToSegments(scorecard, segments);
 * const highlightedIndices = getSegmentIndicesWithEvidence(evidenceMap);
 *
 * console.log(`${highlightedIndices.length} segments contain evidence`);
 * ```
 */
export function getSegmentIndicesWithEvidence(
  evidenceMap: Map<number, EvidenceMarker[]>
): number[] {
  return Array.from(evidenceMap.keys()).sort((a, b) => a - b);
}

/**
 * Count total evidence markers across all segments.
 *
 * @param evidenceMap - Pre-computed evidence map
 * @returns Total number of evidence markers
 */
export function countTotalEvidence(
  evidenceMap: Map<number, EvidenceMarker[]>
): number {
  let total = 0;
  for (const markers of evidenceMap.values()) {
    total += markers.length;
  }
  return total;
}

/**
 * Group evidence markers by verdict type.
 *
 * Useful for filtering evidence display by outcome (met, missed, partial, etc.).
 *
 * @param evidenceMap - Pre-computed evidence map
 * @returns Map of verdict type to array of evidence markers
 *
 * @example
 * ```typescript
 * const byVerdict = groupEvidenceByVerdict(evidenceMap);
 * const missedEvidence = byVerdict.get('missed') ?? [];
 *
 * console.log(`${missedEvidence.length} criteria were missed`);
 * ```
 */
export function groupEvidenceByVerdict(
  evidenceMap: Map<number, EvidenceMarker[]>
): Map<RtassVerdict, EvidenceMarker[]> {
  const byVerdict = new Map<RtassVerdict, EvidenceMarker[]>();

  for (const markers of evidenceMap.values()) {
    for (const marker of markers) {
      const existing = byVerdict.get(marker.verdict);
      if (existing) {
        existing.push(marker);
      } else {
        byVerdict.set(marker.verdict, [marker]);
      }
    }
  }

  return byVerdict;
}

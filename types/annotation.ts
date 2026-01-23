/**
 * Transcript Annotation Type Definitions
 *
 * Types for timestamp-based annotations that trainers can add to specific
 * moments in the transcript. Used to capture observations from external
 * sources (like GoPro video) that provide context for analysis.
 */

/**
 * Represents a trainer annotation attached to a specific timestamp in a transcript.
 *
 * Annotations are stored by timestamp (not segment index) to remain resilient
 * to re-transcription. When displayed, the annotation is resolved to the
 * appropriate segment using findSegmentForTimestamp().
 *
 * @example
 * ```typescript
 * const annotation: TranscriptAnnotation = {
 *   id: 'ann_abc123',
 *   transcriptId: 'tr_xyz789',
 *   timestamp: 330, // 5:30 into the incident
 *   text: 'Battalion commander and section chief discussed staging and water supply',
 *   createdAt: new Date(),
 *   updatedAt: new Date(),
 * };
 * ```
 */
export interface TranscriptAnnotation {
  /** Unique identifier for this annotation */
  id: string;

  /** ID of the parent transcript */
  transcriptId: string;

  /** Timestamp in seconds where this annotation applies */
  timestamp: number;

  /** User-provided note text */
  text: string;

  /** When the annotation was created */
  createdAt: Date;

  /** When the annotation was last updated */
  updatedAt: Date;

  /** Optional user identifier (for future multi-user support) */
  createdBy?: string;
}

/**
 * Input for creating a new annotation.
 * Omits auto-generated fields (id, createdAt, updatedAt).
 */
export type CreateAnnotationInput = Pick<
  TranscriptAnnotation,
  "transcriptId" | "timestamp" | "text" | "createdBy"
>;

/**
 * Input for updating an existing annotation.
 * Only text can be updated after creation.
 */
export type UpdateAnnotationInput = Pick<TranscriptAnnotation, "text">;

/**
 * Annotation with resolved segment information.
 * Used when displaying annotations alongside transcript segments.
 */
export interface ResolvedAnnotation extends TranscriptAnnotation {
  /** Index of the segment containing this timestamp (null if in gap or out of range) */
  segmentIndex: number | null;
}

/**
 * Format a timestamp as MM:SS or HH:MM:SS for display.
 *
 * @param seconds - Timestamp in seconds
 * @returns Formatted timestamp string
 */
export function formatAnnotationTimestamp(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}

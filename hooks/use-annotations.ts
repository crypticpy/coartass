/**
 * Annotations Hook
 *
 * Manages transcript annotations with real-time IndexedDB updates.
 * Annotations are timestamp-based notes that trainers can add to
 * specific moments in the transcript.
 *
 * Features:
 * - Live reactive updates via useLiveQuery
 * - Automatic timestamp-to-segment resolution
 * - CRUD operations with optimistic updates
 * - Error handling and loading states
 */

"use client";

import { useState, useCallback, useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  saveAnnotation,
  getAnnotationsByTranscript,
  updateAnnotation as dbUpdateAnnotation,
  deleteAnnotation as dbDeleteAnnotation,
} from "@/lib/db";
import { findSegmentForTimestamp } from "@/lib/scorecard-evidence-utils";
import type {
  TranscriptAnnotation,
  CreateAnnotationInput,
  ResolvedAnnotation,
} from "@/types/annotation";
import type { TranscriptSegment } from "@/types/transcript";

/** Maximum allowed length for annotation text (characters) */
const MAX_ANNOTATION_LENGTH = 5000;

/**
 * Return type for the useAnnotations hook.
 */
export interface UseAnnotationsReturn {
  /** All annotations for the transcript, sorted by timestamp */
  annotations: TranscriptAnnotation[];

  /** Annotations resolved to segment indexes (for display) */
  resolvedAnnotations: ResolvedAnnotation[];

  /** Map of segment index to annotations at that segment */
  annotationsBySegment: Map<number, TranscriptAnnotation[]>;

  /** Whether annotations are loading */
  isLoading: boolean;

  /** Whether an operation is in progress */
  isProcessing: boolean;

  /** Error message if any operation failed */
  error: string | null;

  /** Total count of annotations */
  count: number;

  /** Add a new annotation */
  addAnnotation: (
    timestamp: number,
    text: string,
  ) => Promise<TranscriptAnnotation | null>;

  /** Update an existing annotation */
  updateAnnotation: (id: string, text: string) => Promise<void>;

  /** Delete an annotation */
  deleteAnnotation: (id: string) => Promise<void>;

  /** Get annotations for a specific segment */
  getAnnotationsForSegment: (segmentIndex: number) => TranscriptAnnotation[];

  /** Check if a segment has annotations */
  hasAnnotation: (segmentIndex: number) => boolean;

  /** Clear error */
  clearError: () => void;
}

/**
 * Hook for managing transcript annotations.
 *
 * @param transcriptId - The ID of the transcript to manage annotations for
 * @param segments - The transcript segments for timestamp-to-segment resolution
 *
 * @example
 * ```tsx
 * function TranscriptViewer({ transcript }) {
 *   const {
 *     annotations,
 *     annotationsBySegment,
 *     addAnnotation,
 *     hasAnnotation,
 *   } = useAnnotations(transcript.id, transcript.segments);
 *
 *   const handleAddNote = async (segment: TranscriptSegment) => {
 *     const text = prompt('Enter note:');
 *     if (text) {
 *       await addAnnotation(segment.start, text);
 *     }
 *   };
 *
 *   return (
 *     <div>
 *       {transcript.segments.map((segment, idx) => (
 *         <SegmentItem
 *           key={idx}
 *           segment={segment}
 *           hasNote={hasAnnotation(idx)}
 *           onAddNote={() => handleAddNote(segment)}
 *         />
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 */
export function useAnnotations(
  transcriptId: string | undefined,
  segments: TranscriptSegment[] = [],
): UseAnnotationsReturn {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Live query for annotations
  const annotations = useLiveQuery(
    async () => {
      if (!transcriptId) return [];
      return getAnnotationsByTranscript(transcriptId);
    },
    [transcriptId],
    [], // Default to empty array while loading
  );

  const isLoading = annotations === undefined;

  // Resolve annotations to segment indexes
  const resolvedAnnotations = useMemo((): ResolvedAnnotation[] => {
    if (!annotations || segments.length === 0) return [];

    return annotations.map((ann) => ({
      ...ann,
      segmentIndex: findSegmentForTimestamp(ann.timestamp, segments),
    }));
  }, [annotations, segments]);

  // Map annotations by segment index
  const annotationsBySegment = useMemo(() => {
    const map = new Map<number, TranscriptAnnotation[]>();

    for (const resolved of resolvedAnnotations) {
      if (resolved.segmentIndex !== null) {
        const existing = map.get(resolved.segmentIndex) ?? [];
        existing.push(resolved);
        map.set(resolved.segmentIndex, existing);
      }
    }

    return map;
  }, [resolvedAnnotations]);

  /**
   * Add a new annotation at the specified timestamp.
   */
  const addAnnotation = useCallback(
    async (
      timestamp: number,
      text: string,
    ): Promise<TranscriptAnnotation | null> => {
      if (!transcriptId) {
        setError("No transcript ID provided");
        return null;
      }

      if (!text.trim()) {
        setError("Annotation text cannot be empty");
        return null;
      }

      if (text.length > MAX_ANNOTATION_LENGTH) {
        setError(
          `Annotation text exceeds maximum length of ${MAX_ANNOTATION_LENGTH} characters`,
        );
        return null;
      }

      setIsProcessing(true);
      setError(null);

      try {
        const input: CreateAnnotationInput = {
          transcriptId,
          timestamp,
          text: text.trim(),
        };

        const annotation = await saveAnnotation(input);
        return annotation;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to add annotation";
        setError(message);
        return null;
      } finally {
        setIsProcessing(false);
      }
    },
    [transcriptId],
  );

  /**
   * Update an existing annotation's text.
   */
  const updateAnnotation = useCallback(
    async (id: string, text: string): Promise<void> => {
      if (!text.trim()) {
        setError("Annotation text cannot be empty");
        return;
      }

      if (text.length > MAX_ANNOTATION_LENGTH) {
        setError(
          `Annotation text exceeds maximum length of ${MAX_ANNOTATION_LENGTH} characters`,
        );
        return;
      }

      setIsProcessing(true);
      setError(null);

      try {
        await dbUpdateAnnotation(id, { text: text.trim() });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to update annotation";
        setError(message);
      } finally {
        setIsProcessing(false);
      }
    },
    [],
  );

  /**
   * Delete an annotation.
   */
  const deleteAnnotation = useCallback(async (id: string): Promise<void> => {
    setIsProcessing(true);
    setError(null);

    try {
      await dbDeleteAnnotation(id);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to delete annotation";
      setError(message);
    } finally {
      setIsProcessing(false);
    }
  }, []);

  /**
   * Get all annotations for a specific segment.
   */
  const getAnnotationsForSegment = useCallback(
    (segmentIndex: number): TranscriptAnnotation[] => {
      return annotationsBySegment.get(segmentIndex) ?? [];
    },
    [annotationsBySegment],
  );

  /**
   * Check if a segment has any annotations.
   */
  const hasAnnotation = useCallback(
    (segmentIndex: number): boolean => {
      return annotationsBySegment.has(segmentIndex);
    },
    [annotationsBySegment],
  );

  /**
   * Clear the error state.
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    annotations: annotations ?? [],
    resolvedAnnotations,
    annotationsBySegment,
    isLoading,
    isProcessing,
    error,
    count: annotations?.length ?? 0,
    addAnnotation,
    updateAnnotation,
    deleteAnnotation,
    getAnnotationsForSegment,
    hasAnnotation,
    clearError,
  };
}

/**
 * Format annotations for inclusion in analysis prompts.
 * Each annotation is formatted with its timestamp and text.
 *
 * @param annotations - Array of annotations to format
 * @returns Formatted string for prompt inclusion, or undefined if empty
 */
export function formatAnnotationsForPrompt(
  annotations: TranscriptAnnotation[],
): string | undefined {
  if (!annotations || annotations.length === 0) {
    return undefined;
  }

  // Sort by timestamp
  const sorted = [...annotations].sort((a, b) => a.timestamp - b.timestamp);

  const lines = sorted.map((ann) => {
    const time = formatTimestampForPrompt(ann.timestamp);
    return `[${time}] ${ann.text}`;
  });

  return lines.join("\n");
}

/**
 * Format timestamp as MM:SS or HH:MM:SS for prompt display.
 */
function formatTimestampForPrompt(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}

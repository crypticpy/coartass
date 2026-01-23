/**
 * Annotation Database Operations
 *
 * CRUD operations for transcript annotations stored in IndexedDB.
 * Annotations are timestamp-based notes that trainers can add to specific
 * moments in the transcript.
 */

import { v4 as uuidv4 } from "uuid";
import { getDatabase, DatabaseError } from "./core";
import type {
  TranscriptAnnotation,
  CreateAnnotationInput,
  UpdateAnnotationInput,
} from "@/types/annotation";

/**
 * Save a new annotation to the database.
 *
 * @param input - The annotation data to save
 * @returns The created annotation with generated ID and timestamps
 * @throws {DatabaseError} If save fails
 */
export async function saveAnnotation(
  input: CreateAnnotationInput,
): Promise<TranscriptAnnotation> {
  const db = getDatabase();

  const annotation: TranscriptAnnotation = {
    id: uuidv4(),
    transcriptId: input.transcriptId,
    timestamp: input.timestamp,
    text: input.text,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: input.createdBy,
  };

  try {
    await db.annotations.add(annotation);
    return annotation;
  } catch (error) {
    throw new DatabaseError(
      `Failed to save annotation: ${error instanceof Error ? error.message : "Unknown error"}`,
      "ANNOTATION_SAVE_FAILED",
      error instanceof Error ? error : undefined,
    );
  }
}

/**
 * Get an annotation by its ID.
 *
 * @param id - The annotation ID
 * @returns The annotation or undefined if not found
 * @throws {DatabaseError} If retrieval fails
 */
export async function getAnnotation(
  id: string,
): Promise<TranscriptAnnotation | undefined> {
  const db = getDatabase();

  try {
    return await db.annotations.get(id);
  } catch (error) {
    throw new DatabaseError(
      `Failed to get annotation: ${error instanceof Error ? error.message : "Unknown error"}`,
      "ANNOTATION_GET_FAILED",
      error instanceof Error ? error : undefined,
    );
  }
}

/**
 * Get all annotations for a transcript, sorted by timestamp.
 *
 * @param transcriptId - The parent transcript ID
 * @returns Array of annotations sorted by timestamp ascending
 * @throws {DatabaseError} If retrieval fails
 */
export async function getAnnotationsByTranscript(
  transcriptId: string,
): Promise<TranscriptAnnotation[]> {
  const db = getDatabase();

  try {
    return await db.annotations
      .where("transcriptId")
      .equals(transcriptId)
      .sortBy("timestamp");
  } catch (error) {
    throw new DatabaseError(
      `Failed to get annotations for transcript: ${error instanceof Error ? error.message : "Unknown error"}`,
      "ANNOTATIONS_GET_FAILED",
      error instanceof Error ? error : undefined,
    );
  }
}

/**
 * Update an existing annotation.
 * Only the text field can be updated.
 *
 * @param id - The annotation ID to update
 * @param updates - The fields to update
 * @throws {DatabaseError} If update fails
 */
export async function updateAnnotation(
  id: string,
  updates: UpdateAnnotationInput,
): Promise<void> {
  const db = getDatabase();

  try {
    const count = await db.annotations.update(id, {
      text: updates.text,
      updatedAt: new Date(),
    });

    if (count === 0) {
      throw new DatabaseError(
        `Annotation not found: ${id}`,
        "ANNOTATION_NOT_FOUND",
      );
    }
  } catch (error) {
    if (error instanceof DatabaseError) throw error;
    throw new DatabaseError(
      `Failed to update annotation: ${error instanceof Error ? error.message : "Unknown error"}`,
      "ANNOTATION_UPDATE_FAILED",
      error instanceof Error ? error : undefined,
    );
  }
}

/**
 * Delete an annotation by its ID.
 *
 * @param id - The annotation ID to delete
 * @throws {DatabaseError} If deletion fails
 */
export async function deleteAnnotation(id: string): Promise<void> {
  const db = getDatabase();

  try {
    await db.annotations.delete(id);
  } catch (error) {
    throw new DatabaseError(
      `Failed to delete annotation: ${error instanceof Error ? error.message : "Unknown error"}`,
      "ANNOTATION_DELETE_FAILED",
      error instanceof Error ? error : undefined,
    );
  }
}

/**
 * Delete all annotations for a transcript.
 * Used when deleting a transcript to cascade the deletion.
 *
 * @param transcriptId - The parent transcript ID
 * @returns The number of annotations deleted
 * @throws {DatabaseError} If deletion fails
 */
export async function deleteAnnotationsByTranscript(
  transcriptId: string,
): Promise<number> {
  const db = getDatabase();

  try {
    return await db.annotations
      .where("transcriptId")
      .equals(transcriptId)
      .delete();
  } catch (error) {
    throw new DatabaseError(
      `Failed to delete annotations for transcript: ${error instanceof Error ? error.message : "Unknown error"}`,
      "ANNOTATIONS_DELETE_FAILED",
      error instanceof Error ? error : undefined,
    );
  }
}

/**
 * Count annotations for a transcript.
 *
 * @param transcriptId - The parent transcript ID
 * @returns The number of annotations
 * @throws {DatabaseError} If count fails
 */
export async function countAnnotationsByTranscript(
  transcriptId: string,
): Promise<number> {
  const db = getDatabase();

  try {
    return await db.annotations
      .where("transcriptId")
      .equals(transcriptId)
      .count();
  } catch (error) {
    throw new DatabaseError(
      `Failed to count annotations: ${error instanceof Error ? error.message : "Unknown error"}`,
      "ANNOTATIONS_COUNT_FAILED",
      error instanceof Error ? error : undefined,
    );
  }
}

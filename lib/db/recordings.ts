/**
 * Recording DB Operations
 */

import type { SavedRecording } from "@/types/recording";
import { DatabaseError, getDatabase } from "./core";

/**
 * Recording status enum.
 */
export type RecordingStatus = "saved" | "transcribed";

// Re-export SavedRecording from types/recording.ts for consistency
// This ensures a single source of truth for the recording types
export type { SavedRecording, RecordingMetadata, RecordingMode } from "@/types/recording";

export async function saveRecording(recording: Omit<SavedRecording, "id">): Promise<number> {
  try {
    const db = getDatabase();

    // Ensure metadata.createdAt is a Date object
    const recordingToSave: Omit<SavedRecording, "id"> = {
      ...recording,
      metadata: {
        ...recording.metadata,
        createdAt:
          recording.metadata.createdAt instanceof Date
            ? recording.metadata.createdAt
            : new Date(recording.metadata.createdAt),
      },
    };

    // add() returns the auto-generated id for auto-increment keys
    const id = await db.recordings.add(recordingToSave);
    return id;
  } catch (error) {
    if (error instanceof Error && error.name === "QuotaExceededError") {
      throw new DatabaseError(
        "Storage quota exceeded. Please delete some recordings to free up space.",
        "QUOTA_EXCEEDED",
        error
      );
    }
    throw new DatabaseError(
      "Failed to save recording",
      "SAVE_FAILED",
      error instanceof Error ? error : undefined
    );
  }
}

export async function getRecording(id: number): Promise<SavedRecording | undefined> {
  try {
    const db = getDatabase();
    return await db.recordings.get(id);
  } catch (error) {
    throw new DatabaseError(
      `Failed to retrieve recording with ID: ${id}`,
      "GET_FAILED",
      error instanceof Error ? error : undefined
    );
  }
}

export async function getAllRecordings(): Promise<SavedRecording[]> {
  try {
    const db = getDatabase();
    return await db.recordings.orderBy("metadata.createdAt").reverse().toArray();
  } catch (error) {
    throw new DatabaseError(
      "Failed to retrieve recordings",
      "GET_ALL_FAILED",
      error instanceof Error ? error : undefined
    );
  }
}

export async function deleteRecording(id: number): Promise<void> {
  try {
    const db = getDatabase();
    await db.recordings.delete(id);
  } catch (error) {
    throw new DatabaseError(
      `Failed to delete recording with ID: ${id}`,
      "DELETE_FAILED",
      error instanceof Error ? error : undefined
    );
  }
}

export async function updateRecordingStatus(
  id: number,
  status: RecordingStatus,
  transcriptId?: string
): Promise<void> {
  try {
    const db = getDatabase();

    // Build update object conditionally
    const updates: Partial<SavedRecording> = { status };
    if (transcriptId !== undefined) {
      updates.transcriptId = transcriptId;
    }

    await db.recordings.update(id, updates);
  } catch (error) {
    throw new DatabaseError(
      `Failed to update recording status for ID: ${id}`,
      "UPDATE_FAILED",
      error instanceof Error ? error : undefined
    );
  }
}


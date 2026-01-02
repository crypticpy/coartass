/**
 * Transcript DB Operations
 */

import type { Transcript } from "@/types/transcript";
import { DatabaseError, getDatabase } from "./core";
import type { PaginatedResult, PaginationOptions } from "./pagination";

export async function findTranscriptByFingerprint(
  hash: string
): Promise<Transcript | undefined> {
  try {
    const db = getDatabase();
    return await db.transcripts.where("fingerprint.fileHash").equals(hash).first();
  } catch (error) {
    console.error("Failed to lookup transcript fingerprint", error);
    return undefined;
  }
}

export async function countTranscriptVersions(hash: string): Promise<number> {
  try {
    const db = getDatabase();
    return await db.transcripts.where("fingerprint.fileHash").equals(hash).count();
  } catch (error) {
    console.error("Failed to count transcript versions", error);
    return 0;
  }
}

/**
 * Saves a transcript to the database.
 *
 * @param transcript - The transcript to save
 * @returns The saved transcript's ID
 * @throws {DatabaseError} If the save operation fails
 */
export async function saveTranscript(transcript: Transcript): Promise<string> {
  try {
    const db = getDatabase();

    // Ensure dates are Date objects
    const transcriptToSave: Transcript = {
      ...transcript,
      createdAt:
        transcript.createdAt instanceof Date
          ? transcript.createdAt
          : new Date(transcript.createdAt),
    };

    await db.transcripts.put(transcriptToSave);
    return transcript.id;
  } catch (error) {
    if (error instanceof Error && error.name === "QuotaExceededError") {
      throw new DatabaseError(
        "Storage quota exceeded. Please delete some transcripts to free up space.",
        "QUOTA_EXCEEDED",
        error
      );
    }
    throw new DatabaseError(
      "Failed to save transcript",
      "SAVE_FAILED",
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Retrieves a transcript by ID.
 *
 * @param id - The transcript ID
 * @returns The transcript if found, undefined otherwise
 * @throws {DatabaseError} If the retrieval operation fails
 */
export async function getTranscript(id: string): Promise<Transcript | undefined> {
  try {
    const db = getDatabase();
    return await db.transcripts.get(id);
  } catch (error) {
    throw new DatabaseError(
      `Failed to retrieve transcript with ID: ${id}`,
      "GET_FAILED",
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Retrieves all transcripts, sorted by creation date (newest first).
 *
 * @returns Array of all transcripts
 * @throws {DatabaseError} If the retrieval operation fails
 */
export async function getAllTranscripts(): Promise<Transcript[]> {
  try {
    const db = getDatabase();
    return await db.transcripts.orderBy("createdAt").reverse().toArray();
  } catch (error) {
    throw new DatabaseError(
      "Failed to retrieve transcripts",
      "GET_ALL_FAILED",
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Retrieves transcripts with pagination for better performance on large datasets.
 */
export async function getTranscriptsPaginated(
  options: PaginationOptions = {}
): Promise<PaginatedResult<Transcript>> {
  try {
    const { limit = 50, offset = 0, orderBy = "createdAt", orderDirection = "desc" } = options;

    const db = getDatabase();

    // Get total count for pagination metadata
    const total = await db.transcripts.count();

    // Build query with proper ordering
    let query = db.transcripts.orderBy(orderBy);

    // Reverse for descending order
    if (orderDirection === "desc") {
      query = query.reverse();
    }

    // Apply pagination
    const items = await query.offset(offset).limit(limit).toArray();

    return {
      items,
      total,
      hasMore: offset + items.length < total,
      offset,
      limit,
    };
  } catch (error) {
    throw new DatabaseError(
      "Failed to retrieve paginated transcripts",
      "GET_PAGINATED_FAILED",
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Searches transcripts with pagination for better performance.
 *
 * Filters transcripts by filename or text content matching the search term.
 * Uses in-memory filtering (IndexedDB doesn't support LIKE queries).
 */
export async function searchTranscriptsPaginated(
  searchTerm: string,
  options: PaginationOptions = {}
): Promise<PaginatedResult<Transcript>> {
  try {
    const { limit = 50, offset = 0 } = options;

    const db = getDatabase();
    const lowerSearch = searchTerm.toLowerCase();

    // Get all matching items (IndexedDB doesn't support LIKE queries)
    // Note: For very large datasets, consider using a separate search index
    const allMatches = await db.transcripts
      .filter(
        (t) =>
          t.filename.toLowerCase().includes(lowerSearch) ||
          t.text.toLowerCase().includes(lowerSearch)
      )
      .toArray();

    // Sort by createdAt desc
    allMatches.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    const total = allMatches.length;
    const items = allMatches.slice(offset, offset + limit);

    return {
      items,
      total,
      hasMore: offset + items.length < total,
      offset,
      limit,
    };
  } catch (error) {
    throw new DatabaseError(
      "Failed to search transcripts",
      "SEARCH_FAILED",
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Deletes a transcript by ID.
 *
 * Also deletes all associated analyses and conversations to maintain referential integrity.
 */
export async function deleteTranscript(id: string): Promise<void> {
  try {
    const db = getDatabase();

    // Use a transaction to ensure all deletions succeed or fail together
    await db.transaction("rw", [db.transcripts, db.analyses, db.conversations], async () => {
      // Delete the transcript
      await db.transcripts.delete(id);

      // Delete all associated analyses
      await db.analyses.where("transcriptId").equals(id).delete();

      // Delete all associated conversations
      await db.conversations.where("transcriptId").equals(id).delete();
    });
  } catch (error) {
    throw new DatabaseError(
      `Failed to delete transcript with ID: ${id}`,
      "DELETE_FAILED",
      error instanceof Error ? error : undefined
    );
  }
}

// ============================================================================
// BULK TRANSCRIPT OPERATIONS
// ============================================================================

export async function saveTranscriptsBulk(transcripts: Transcript[]): Promise<number> {
  try {
    if (transcripts.length === 0) {
      return 0;
    }

    const db = getDatabase();

    // Ensure dates are Date objects for all transcripts
    const transcriptsToSave = transcripts.map((transcript) => ({
      ...transcript,
      createdAt:
        transcript.createdAt instanceof Date
          ? transcript.createdAt
          : new Date(transcript.createdAt),
    }));

    // bulkPut is much faster than multiple put() calls
    await db.transcripts.bulkPut(transcriptsToSave);

    return transcriptsToSave.length;
  } catch (error) {
    if (error instanceof Error && error.name === "QuotaExceededError") {
      throw new DatabaseError(
        "Storage quota exceeded. Please delete some transcripts to free up space.",
        "QUOTA_EXCEEDED",
        error
      );
    }
    throw new DatabaseError(
      "Failed to bulk save transcripts",
      "BULK_SAVE_FAILED",
      error instanceof Error ? error : undefined
    );
  }
}

export async function deleteOldTranscripts(daysOld: number): Promise<number> {
  try {
    const db = getDatabase();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    // Get IDs of transcripts to delete
    const idsToDelete = await db.transcripts.where("createdAt").below(cutoffDate).primaryKeys();

    if (idsToDelete.length === 0) {
      return 0;
    }

    // Use transaction to ensure both deletions succeed or fail together
    await db.transaction("rw", [db.transcripts, db.analyses], async () => {
      // Delete transcripts
      await db.transcripts.bulkDelete(idsToDelete);

      // Delete all associated analyses
      for (const transcriptId of idsToDelete) {
        await db.analyses.where("transcriptId").equals(transcriptId).delete();
      }
    });

    return idsToDelete.length;
  } catch (error) {
    throw new DatabaseError(
      `Failed to delete old transcripts (older than ${daysOld} days)`,
      "BULK_DELETE_FAILED",
      error instanceof Error ? error : undefined
    );
  }
}

// ============================================================================
// SORTED TRANSCRIPT QUERIES
// ============================================================================

/**
 * Sort options for transcript queries.
 */
export type TranscriptSortField = "createdAt" | "metadata.duration" | "filename" | "metadata.fileSize";

export async function getTranscriptsSorted(
  sortBy: TranscriptSortField = "createdAt",
  order: "asc" | "desc" = "desc"
): Promise<Transcript[]> {
  try {
    const db = getDatabase();

    // For nested properties, we need to sort in memory
    if (sortBy === "metadata.fileSize") {
      const all = await db.transcripts.toArray();
      return all.sort((a, b) => {
        const aVal = a.metadata?.fileSize ?? 0;
        const bVal = b.metadata?.fileSize ?? 0;
        return order === "asc" ? aVal - bVal : bVal - aVal;
      });
    }

    // For indexed fields, use Dexie's orderBy
    let query = db.transcripts.orderBy(sortBy);
    if (order === "desc") {
      query = query.reverse();
    }
    return await query.toArray();
  } catch (error) {
    throw new DatabaseError(
      "Failed to retrieve sorted transcripts",
      "GET_SORTED_FAILED",
      error instanceof Error ? error : undefined
    );
  }
}

export async function deleteTranscriptsBulk(ids: string[]): Promise<number> {
  try {
    if (ids.length === 0) {
      return 0;
    }

    const db = getDatabase();

    // Use a transaction to ensure all deletions succeed or fail together
    await db.transaction("rw", [db.transcripts, db.analyses, db.conversations], async () => {
      // Delete transcripts
      await db.transcripts.bulkDelete(ids);

      // Delete all associated analyses and conversations
      for (const id of ids) {
        await db.analyses.where("transcriptId").equals(id).delete();
        await db.conversations.where("transcriptId").equals(id).delete();
      }
    });

    return ids.length;
  } catch (error) {
    throw new DatabaseError(
      "Failed to bulk delete transcripts",
      "BULK_DELETE_FAILED",
      error instanceof Error ? error : undefined
    );
  }
}

export async function updateTranscriptSummary(id: string, summary: string): Promise<void> {
  try {
    const db = getDatabase();
    await db.transcripts.update(id, { summary });
  } catch (error) {
    throw new DatabaseError(
      `Failed to update transcript summary for ID: ${id}`,
      "UPDATE_FAILED",
      error instanceof Error ? error : undefined
    );
  }
}


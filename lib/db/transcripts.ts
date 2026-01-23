/**
 * Transcript DB Operations
 */

import type { Transcript } from "@/types/transcript";
import { DatabaseError, getDatabase } from "./core";
import type { PaginatedResult, PaginationOptions } from "./pagination";
import { computeTranscriptSearchTokens, tokenizeSearchQuery } from "./search";

export async function findTranscriptByFingerprint(
  hash: string,
): Promise<Transcript | undefined> {
  try {
    const db = getDatabase();
    return await db.transcripts
      .where("fingerprint.fileHash")
      .equals(hash)
      .first();
  } catch (error) {
    console.error("Failed to lookup transcript fingerprint", error);
    return undefined;
  }
}

export async function countTranscriptVersions(hash: string): Promise<number> {
  try {
    const db = getDatabase();
    return await db.transcripts
      .where("fingerprint.fileHash")
      .equals(hash)
      .count();
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
      searchTokens:
        Array.isArray(transcript.searchTokens) &&
        transcript.searchTokens.length > 0
          ? transcript.searchTokens
          : computeTranscriptSearchTokens(transcript),
    };

    await db.transcripts.put(transcriptToSave);
    return transcript.id;
  } catch (error) {
    if (error instanceof Error && error.name === "QuotaExceededError") {
      throw new DatabaseError(
        "Storage quota exceeded. Please delete some transcripts to free up space.",
        "QUOTA_EXCEEDED",
        error,
      );
    }
    throw new DatabaseError(
      "Failed to save transcript",
      "SAVE_FAILED",
      error instanceof Error ? error : undefined,
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
export async function getTranscript(
  id: string,
): Promise<Transcript | undefined> {
  try {
    const db = getDatabase();
    return await db.transcripts.get(id);
  } catch (error) {
    throw new DatabaseError(
      `Failed to retrieve transcript with ID: ${id}`,
      "GET_FAILED",
      error instanceof Error ? error : undefined,
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
      error instanceof Error ? error : undefined,
    );
  }
}

/**
 * Retrieves transcripts with pagination for better performance on large datasets.
 */
export async function getTranscriptsPaginated(
  options: PaginationOptions = {},
): Promise<PaginatedResult<Transcript>> {
  try {
    const {
      limit = 50,
      offset = 0,
      orderBy = "createdAt",
      orderDirection = "desc",
    } = options;

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
      error instanceof Error ? error : undefined,
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
  options: PaginationOptions = {},
): Promise<PaginatedResult<Transcript>> {
  try {
    const {
      limit = 50,
      offset = 0,
      orderBy = "createdAt",
      orderDirection = "desc",
    } = options;

    const db = getDatabase();

    const trimmedSearch = searchTerm.trim();
    if (!trimmedSearch) {
      return await getTranscriptsPaginated(options);
    }

    const tokens = tokenizeSearchQuery(trimmedSearch);
    let allMatches: Transcript[];

    if (tokens.length === 0) {
      // Avoid a full-table scan for short/stopword-only searches.
      // Best-effort fallback: filename prefix match (uses the filename index).
      allMatches = await db.transcripts
        .where("filename")
        .startsWithIgnoreCase(trimmedSearch)
        .toArray();
    } else {
      // Use the rarest token as the seed set to minimize candidate expansion.
      const tokenCounts = await Promise.all(
        tokens.map(async (token) =>
          db.transcripts.where("searchTokens").equals(token).count(),
        ),
      );
      let seedIndex = 0;
      let minCount = tokenCounts[0] ?? 0;
      for (let i = 1; i < tokenCounts.length; i++) {
        const count = tokenCounts[i] ?? 0;
        if (count < minCount) {
          minCount = count;
          seedIndex = i;
        }
      }
      const seedToken = tokens[seedIndex]!;

      const candidates = await db.transcripts
        .where("searchTokens")
        .equals(seedToken)
        .toArray();
      allMatches = candidates.filter((t) => {
        const tokenList =
          Array.isArray(t.searchTokens) && t.searchTokens.length > 0
            ? t.searchTokens
            : computeTranscriptSearchTokens(t);
        return tokens.every((token) => tokenList.includes(token));
      });
    }

    allMatches.sort((a, b) => {
      let aVal: string | number | Date;
      let bVal: string | number | Date;

      switch (orderBy) {
        case "filename":
          aVal = a.filename.toLowerCase();
          bVal = b.filename.toLowerCase();
          break;
        case "metadata.duration":
          aVal = a.metadata?.duration ?? 0;
          bVal = b.metadata?.duration ?? 0;
          break;
        case "metadata.fileSize":
          aVal = a.metadata?.fileSize ?? 0;
          bVal = b.metadata?.fileSize ?? 0;
          break;
        case "createdAt":
        default:
          aVal =
            a.createdAt instanceof Date ? a.createdAt : new Date(a.createdAt);
          bVal =
            b.createdAt instanceof Date ? b.createdAt : new Date(b.createdAt);
          break;
      }

      if (aVal < bVal) return orderDirection === "asc" ? -1 : 1;
      if (aVal > bVal) return orderDirection === "asc" ? 1 : -1;
      return 0;
    });

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
      error instanceof Error ? error : undefined,
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
    await db.transaction(
      "rw",
      [
        db.transcripts,
        db.analyses,
        db.conversations,
        db.audioFiles,
        db.rtassScorecards,
        db.annotations,
        db.supplementalDocuments,
      ],
      async () => {
        const transcript = await db.transcripts.get(id);
        const audioUrl = transcript?.audioUrl;

        if (
          audioUrl &&
          typeof URL !== "undefined" &&
          audioUrl.startsWith("blob:")
        ) {
          URL.revokeObjectURL(audioUrl);
        }

        // Delete audio blob (stored separately) if present
        await db.audioFiles.delete(id);

        // Delete the transcript
        await db.transcripts.delete(id);

        // Delete all associated analyses
        await db.analyses.where("transcriptId").equals(id).delete();

        // Delete all associated conversations
        await db.conversations.where("transcriptId").equals(id).delete();

        // Delete all associated RTASS scorecards
        await db.rtassScorecards.where("transcriptId").equals(id).delete();

        // Delete all associated annotations
        await db.annotations.where("transcriptId").equals(id).delete();

        // Delete all associated supplemental documents
        await db.supplementalDocuments
          .where("transcriptId")
          .equals(id)
          .delete();
      },
    );
  } catch (error) {
    throw new DatabaseError(
      `Failed to delete transcript with ID: ${id}`,
      "DELETE_FAILED",
      error instanceof Error ? error : undefined,
    );
  }
}

// ============================================================================
// BULK TRANSCRIPT OPERATIONS
// ============================================================================

export async function saveTranscriptsBulk(
  transcripts: Transcript[],
): Promise<number> {
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
      searchTokens:
        Array.isArray(transcript.searchTokens) &&
        transcript.searchTokens.length > 0
          ? transcript.searchTokens
          : computeTranscriptSearchTokens(transcript),
    }));

    // bulkPut is much faster than multiple put() calls
    await db.transcripts.bulkPut(transcriptsToSave);

    return transcriptsToSave.length;
  } catch (error) {
    if (error instanceof Error && error.name === "QuotaExceededError") {
      throw new DatabaseError(
        "Storage quota exceeded. Please delete some transcripts to free up space.",
        "QUOTA_EXCEEDED",
        error,
      );
    }
    throw new DatabaseError(
      "Failed to bulk save transcripts",
      "BULK_SAVE_FAILED",
      error instanceof Error ? error : undefined,
    );
  }
}

export async function deleteOldTranscripts(daysOld: number): Promise<number> {
  try {
    const db = getDatabase();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    // Get IDs of transcripts to delete
    const idsToDelete = await db.transcripts
      .where("createdAt")
      .below(cutoffDate)
      .primaryKeys();

    if (idsToDelete.length === 0) {
      return 0;
    }

    // Use transaction to ensure all deletions succeed or fail together
    await db.transaction(
      "rw",
      [
        db.transcripts,
        db.analyses,
        db.conversations,
        db.audioFiles,
        db.rtassScorecards,
        db.annotations,
        db.supplementalDocuments,
      ],
      async () => {
        // Delete transcripts
        await db.transcripts.bulkDelete(idsToDelete);

        // Delete all associated records
        await db.analyses.where("transcriptId").anyOf(idsToDelete).delete();
        await db.conversations
          .where("transcriptId")
          .anyOf(idsToDelete)
          .delete();
        await db.rtassScorecards
          .where("transcriptId")
          .anyOf(idsToDelete)
          .delete();
        await db.annotations.where("transcriptId").anyOf(idsToDelete).delete();
        await db.supplementalDocuments
          .where("transcriptId")
          .anyOf(idsToDelete)
          .delete();
        await db.audioFiles.bulkDelete(idsToDelete);
      },
    );

    return idsToDelete.length;
  } catch (error) {
    throw new DatabaseError(
      `Failed to delete old transcripts (older than ${daysOld} days)`,
      "BULK_DELETE_FAILED",
      error instanceof Error ? error : undefined,
    );
  }
}

// ============================================================================
// SORTED TRANSCRIPT QUERIES
// ============================================================================

/**
 * Sort options for transcript queries.
 */
export type TranscriptSortField =
  | "createdAt"
  | "metadata.duration"
  | "filename"
  | "metadata.fileSize";

export async function getTranscriptsSorted(
  sortBy: TranscriptSortField = "createdAt",
  order: "asc" | "desc" = "desc",
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
      error instanceof Error ? error : undefined,
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
    await db.transaction(
      "rw",
      [
        db.transcripts,
        db.analyses,
        db.conversations,
        db.audioFiles,
        db.rtassScorecards,
        db.annotations,
        db.supplementalDocuments,
      ],
      async () => {
        // Delete transcripts
        await db.transcripts.bulkDelete(ids);

        // Delete all associated records
        await db.analyses.where("transcriptId").anyOf(ids).delete();
        await db.conversations.where("transcriptId").anyOf(ids).delete();
        await db.rtassScorecards.where("transcriptId").anyOf(ids).delete();
        await db.annotations.where("transcriptId").anyOf(ids).delete();
        await db.supplementalDocuments
          .where("transcriptId")
          .anyOf(ids)
          .delete();
        await db.audioFiles.bulkDelete(ids);
      },
    );

    return ids.length;
  } catch (error) {
    throw new DatabaseError(
      "Failed to bulk delete transcripts",
      "BULK_DELETE_FAILED",
      error instanceof Error ? error : undefined,
    );
  }
}

export async function updateTranscriptSummary(
  id: string,
  summary: string,
): Promise<void> {
  try {
    const db = getDatabase();
    await db.transcripts.update(id, { summary });
  } catch (error) {
    throw new DatabaseError(
      `Failed to update transcript summary for ID: ${id}`,
      "UPDATE_FAILED",
      error instanceof Error ? error : undefined,
    );
  }
}

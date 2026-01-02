/**
 * Analysis DB Operations
 */

import Dexie from "dexie";
import type { Analysis } from "@/types/analysis";
import { DatabaseError, getDatabase } from "./core";
import type { PaginatedResult, PaginationOptions } from "./pagination";

export async function saveAnalysis(analysis: Analysis): Promise<string> {
  try {
    const db = getDatabase();

    // Ensure dates are Date objects
    const analysisToSave: Analysis = {
      ...analysis,
      createdAt: analysis.createdAt instanceof Date ? analysis.createdAt : new Date(analysis.createdAt),
    };

    await db.analyses.put(analysisToSave);
    return analysis.id;
  } catch (error) {
    if (error instanceof Error && error.name === "QuotaExceededError") {
      throw new DatabaseError(
        "Storage quota exceeded. Please delete some analyses to free up space.",
        "QUOTA_EXCEEDED",
        error
      );
    }
    throw new DatabaseError(
      "Failed to save analysis",
      "SAVE_FAILED",
      error instanceof Error ? error : undefined
    );
  }
}

export async function getAnalysisByTranscript(transcriptId: string): Promise<Analysis[]> {
  try {
    const db = getDatabase();
    return await db.analyses.where("transcriptId").equals(transcriptId).toArray();
  } catch (error) {
    throw new DatabaseError(
      `Failed to retrieve analyses for transcript ID: ${transcriptId}`,
      "GET_FAILED",
      error instanceof Error ? error : undefined
    );
  }
}

export async function getAnalysesPaginated(
  transcriptId: string,
  options: PaginationOptions = {}
): Promise<PaginatedResult<Analysis>> {
  try {
    const { limit = 20, offset = 0, orderDirection = "desc" } = options;

    const db = getDatabase();

    // Use compound index [transcriptId+createdAt] for efficient filtering
    // This avoids scanning all analyses and filtering in memory
    const total = await db.analyses
      .where("[transcriptId+createdAt]")
      .between([transcriptId, Dexie.minKey], [transcriptId, Dexie.maxKey])
      .count();

    let query = db.analyses
      .where("[transcriptId+createdAt]")
      .between([transcriptId, Dexie.minKey], [transcriptId, Dexie.maxKey]);

    // Reverse for descending order (newest first)
    if (orderDirection === "desc") {
      query = query.reverse();
    }

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
      `Failed to retrieve paginated analyses for transcript ID: ${transcriptId}`,
      "GET_PAGINATED_FAILED",
      error instanceof Error ? error : undefined
    );
  }
}

export async function deleteAnalysis(id: string): Promise<void> {
  try {
    const db = getDatabase();
    await db.analyses.delete(id);
  } catch (error) {
    throw new DatabaseError(
      `Failed to delete analysis with ID: ${id}`,
      "DELETE_FAILED",
      error instanceof Error ? error : undefined
    );
  }
}

export async function deleteAnalysesBulk(analysisIds: string[]): Promise<number> {
  try {
    if (analysisIds.length === 0) {
      return 0;
    }

    const db = getDatabase();
    await db.analyses.bulkDelete(analysisIds);

    return analysisIds.length;
  } catch (error) {
    throw new DatabaseError(
      "Failed to bulk delete analyses",
      "BULK_DELETE_FAILED",
      error instanceof Error ? error : undefined
    );
  }
}


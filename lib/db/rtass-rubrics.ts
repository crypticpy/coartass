/**
 * RTASS Rubric Templates DB Operations
 *
 * CRUD operations for custom RTASS rubric templates stored in IndexedDB.
 */

import type { RtassRubricTemplate } from "@/types/rtass";
import { DatabaseError, getDatabase } from "./core";

/**
 * Save a custom RTASS rubric template to IndexedDB.
 */
export async function saveRtassRubricTemplate(
  rubric: RtassRubricTemplate
): Promise<string> {
  try {
    const db = getDatabase();
    const rubricToSave: RtassRubricTemplate = {
      ...rubric,
      createdAt:
        rubric.createdAt instanceof Date
          ? rubric.createdAt
          : new Date(rubric.createdAt),
      updatedAt:
        rubric.updatedAt instanceof Date
          ? rubric.updatedAt
          : rubric.updatedAt
            ? new Date(rubric.updatedAt)
            : undefined,
    };
    await db.rtassRubricTemplates.put(rubricToSave);
    return rubric.id;
  } catch (error) {
    if (error instanceof Error && error.name === "QuotaExceededError") {
      throw new DatabaseError(
        "Storage quota exceeded. Please delete some rubrics to free up space.",
        "QUOTA_EXCEEDED",
        error
      );
    }
    throw new DatabaseError(
      "Failed to save RTASS rubric template",
      "SAVE_FAILED",
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Get a single RTASS rubric template by ID.
 */
export async function getRtassRubricTemplate(
  id: string
): Promise<RtassRubricTemplate | undefined> {
  try {
    const db = getDatabase();
    return await db.rtassRubricTemplates.get(id);
  } catch (error) {
    throw new DatabaseError(
      `Failed to retrieve RTASS rubric template with ID: ${id}`,
      "GET_FAILED",
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Get all custom RTASS rubric templates from IndexedDB.
 */
export async function getAllRtassRubricTemplates(): Promise<
  RtassRubricTemplate[]
> {
  try {
    const db = getDatabase();
    return await db.rtassRubricTemplates.toArray();
  } catch (error) {
    throw new DatabaseError(
      "Failed to retrieve RTASS rubric templates",
      "GET_ALL_FAILED",
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Delete a custom RTASS rubric template.
 */
export async function deleteRtassRubricTemplate(id: string): Promise<void> {
  try {
    const db = getDatabase();
    const rubric = await db.rtassRubricTemplates.get(id);
    if (!rubric) {
      throw new DatabaseError(
        `RTASS rubric template with ID ${id} not found`,
        "NOT_FOUND"
      );
    }
    await db.transaction(
      "rw",
      [db.rtassRubricTemplates, db.rtassScorecards],
      async () => {
        await db.rtassRubricTemplates.delete(id);
      }
    );
  } catch (error) {
    if (error instanceof DatabaseError) {
      throw error;
    }
    throw new DatabaseError(
      `Failed to delete RTASS rubric template with ID: ${id}`,
      "DELETE_FAILED",
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Search RTASS rubric templates by name or tags.
 */
export async function searchRtassRubricTemplates(
  searchTerm: string
): Promise<RtassRubricTemplate[]> {
  try {
    const db = getDatabase();
    const allRubrics = await db.rtassRubricTemplates.toArray();
    if (!searchTerm.trim()) {
      return allRubrics;
    }
    const lowerSearch = searchTerm.toLowerCase();
    return allRubrics.filter((rubric) => {
      return (
        rubric.name.toLowerCase().includes(lowerSearch) ||
        rubric.description.toLowerCase().includes(lowerSearch) ||
        rubric.jurisdiction?.toLowerCase().includes(lowerSearch) ||
        rubric.tags?.some((tag) => tag.toLowerCase().includes(lowerSearch))
      );
    });
  } catch (error) {
    throw new DatabaseError(
      "Failed to search RTASS rubric templates",
      "SEARCH_FAILED",
      error instanceof Error ? error : undefined
    );
  }
}

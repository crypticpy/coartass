/**
 * Custom hook for fetching and managing RTASS rubric templates
 * Provides live updates when rubrics change in IndexedDB
 */

import { useLiveQuery } from "dexie-react-hooks";
import { useCallback, useState } from "react";
import {
  getAllRtassRubricTemplates,
  getRtassRubricTemplate,
  saveRtassRubricTemplate,
  deleteRtassRubricTemplate as dbDeleteRubric,
  searchRtassRubricTemplates,
} from "@/lib/db";
import type { RtassRubricTemplate } from "@/types/rtass";
import { createLogger } from "@/lib/logger";

const log = createLogger("useRtassRubrics");

export interface BuiltInRubric {
  id: string;
  name: string;
  description: string;
  version: string;
  jurisdiction?: string;
  tags?: string[];
  isBuiltIn: true;
}

export interface RubricWithSource extends RtassRubricTemplate {
  isBuiltIn: boolean;
}

/**
 * Hook to fetch all custom RTASS rubric templates with live updates
 */
export function useRtassRubrics() {
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const rubrics = useLiveQuery(
    async () => {
      try {
        return await getAllRtassRubricTemplates();
      } catch (error) {
        log.error("Error fetching rubrics", {
          message: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    },
    [],
    []
  );

  const deleteRubric = useCallback(async (id: string) => {
    try {
      setIsDeleting(id);
      await dbDeleteRubric(id);
    } catch (error) {
      log.error("Error deleting rubric", {
        message: error instanceof Error ? error.message : String(error),
      });
      throw error;
    } finally {
      setIsDeleting(null);
    }
  }, []);

  const saveRubric = useCallback(async (rubric: RtassRubricTemplate) => {
    try {
      return await saveRtassRubricTemplate(rubric);
    } catch (error) {
      log.error("Error saving rubric", {
        message: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }, []);

  return {
    rubrics: rubrics || [],
    isLoading: rubrics === undefined,
    isDeleting,
    deleteRubric,
    saveRubric,
  };
}

/**
 * Hook to fetch a single RTASS rubric template by ID
 */
export function useRtassRubric(id: string | null) {
  const rubric = useLiveQuery(
    async () => {
      if (!id) return undefined;
      try {
        return await getRtassRubricTemplate(id);
      } catch (error) {
        log.error("Error fetching rubric", {
          message: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    },
    [id],
    undefined
  );

  return {
    rubric,
    isLoading: id !== null && rubric === undefined,
  };
}

/**
 * Hook to search RTASS rubric templates
 */
export function useSearchRtassRubrics(searchTerm: string) {
  const rubrics = useLiveQuery(
    async () => {
      try {
        return await searchRtassRubricTemplates(searchTerm);
      } catch (error) {
        log.error("Error searching rubrics", {
          message: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    },
    [searchTerm],
    []
  );

  return {
    rubrics: rubrics || [],
    isLoading: rubrics === undefined,
  };
}

/**
 * Hook to fetch all rubrics (built-in from API + custom from IndexedDB)
 * Merges both sources and marks each with isBuiltIn flag
 */
export function useAllRtassRubrics() {
  const [builtInRubrics, setBuiltInRubrics] = useState<BuiltInRubric[]>([]);
  const [builtInLoading, setBuiltInLoading] = useState(true);
  const [builtInError, setBuiltInError] = useState<Error | null>(null);

  // Fetch built-in rubrics from API on mount
  useState(() => {
    async function fetchBuiltIn() {
      try {
        const response = await fetch("/api/rtass/rubrics");
        if (!response.ok) {
          throw new Error("Failed to fetch built-in rubrics");
        }
        const data = await response.json();
        setBuiltInRubrics(
          data.rubrics.map((r: BuiltInRubric) => ({ ...r, isBuiltIn: true }))
        );
      } catch (error) {
        log.error("Error fetching built-in rubrics", {
          message: error instanceof Error ? error.message : String(error),
        });
        setBuiltInError(error instanceof Error ? error : new Error(String(error)));
      } finally {
        setBuiltInLoading(false);
      }
    }
    fetchBuiltIn();
  });

  // Fetch custom rubrics from IndexedDB with live updates
  const customRubrics = useLiveQuery(
    async () => {
      try {
        const rubrics = await getAllRtassRubricTemplates();
        return rubrics.map((r) => ({ ...r, isBuiltIn: false }));
      } catch (error) {
        log.error("Error fetching custom rubrics", {
          message: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    },
    [],
    []
  );

  // Merge both sources
  const allRubrics: RubricWithSource[] = [
    ...(builtInRubrics as unknown as RubricWithSource[]),
    ...(customRubrics || []),
  ];

  return {
    rubrics: allRubrics,
    builtInRubrics,
    customRubrics: customRubrics || [],
    isLoading: builtInLoading || customRubrics === undefined,
    error: builtInError,
  };
}

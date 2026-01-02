/**
 * Custom hook for fetching and managing transcripts from IndexedDB
 * Provides real-time updates when transcripts change
 *
 * IMPORTANT: Demo transcripts (ID starting with 'demo-') are automatically
 * filtered out to prevent tour demo data from polluting the user's transcript list.
 */

import { useLiveQuery } from 'dexie-react-hooks';
import {
  getAllTranscripts,
  getTranscriptsPaginated,
  searchTranscriptsPaginated,
  deleteTranscript as dbDeleteTranscript,
  type PaginationOptions,
  type PaginatedResult
} from '@/lib/db';
import type { Transcript } from '@/types/transcript';
import { useCallback } from 'react';
import { createLogger } from '@/lib/logger';

const log = createLogger('useTranscripts');

/**
 * Filter out demo transcripts from a list
 * Demo transcripts have IDs starting with 'demo-'
 */
function filterOutDemoTranscripts(transcripts: Transcript[]): Transcript[] {
  return transcripts.filter(t => !t.id.startsWith('demo-'));
}

/**
 * Hook to fetch all transcripts with live updates
 * Automatically re-fetches when transcripts are added, updated, or deleted
 * NOTE: Demo transcripts (ID starting with 'demo-') are automatically filtered out
 *
 * @returns Object containing transcripts array, loading state, error, and delete function
 */
export function useTranscripts() {
  const transcripts = useLiveQuery(
    async () => {
      try {
        const allTranscripts = await getAllTranscripts();
        // Filter out demo transcripts to prevent tour data from polluting the list
        return filterOutDemoTranscripts(allTranscripts);
      } catch (error) {
        log.error('Error fetching transcripts', {
          message: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    },
    [], // Dependencies - empty array means run once and listen for changes
    [] // Default value while loading
  );

  const deleteTranscript = useCallback(async (id: string) => {
    try {
      await dbDeleteTranscript(id);
    } catch (error) {
      log.error('Error deleting transcript', {
        message: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }, []);

  return {
    transcripts: transcripts || [],
    isLoading: transcripts === undefined,
    deleteTranscript,
  };
}

/**
 * Hook to get recent transcripts (limited number)
 * NOTE: Demo transcripts (ID starting with 'demo-') are automatically filtered out
 *
 * @param limit - Maximum number of transcripts to return (default: 5)
 * @returns Object containing recent transcripts array and loading state
 */
export function useRecentTranscripts(limit: number = 5) {
  const transcripts = useLiveQuery(
    async () => {
      try {
        const allTranscripts = await getAllTranscripts();
        // Filter out demo transcripts first, then slice
        return filterOutDemoTranscripts(allTranscripts).slice(0, limit);
      } catch (error) {
        log.error('Error fetching recent transcripts', {
          message: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    },
    [limit],
    []
  );

  return {
    transcripts: transcripts || [],
    isLoading: transcripts === undefined,
  };
}

/**
 * Hook to search/filter transcripts
 * NOTE: Demo transcripts (ID starting with 'demo-') are automatically filtered out
 *
 * @param searchTerm - Search term to filter transcripts
 * @returns Object containing filtered transcripts array and loading state
 */
export function useSearchTranscripts(searchTerm: string) {
  const transcripts = useLiveQuery(
    async () => {
      try {
        const allTranscripts = await getAllTranscripts();
        // Filter out demo transcripts first
        const realTranscripts = filterOutDemoTranscripts(allTranscripts);

        if (!searchTerm.trim()) {
          return realTranscripts;
        }

        const lowerSearch = searchTerm.toLowerCase();
        return realTranscripts.filter((transcript) => {
          return (
            transcript.filename.toLowerCase().includes(lowerSearch) ||
            transcript.text.toLowerCase().includes(lowerSearch)
          );
        });
      } catch (error) {
        log.error('Error searching transcripts', {
          message: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    },
    [searchTerm],
    []
  );

  return {
    transcripts: transcripts || [],
    isLoading: transcripts === undefined,
  };
}

/**
 * Hook to fetch transcripts with pagination (optimized for large datasets)
 * NOTE: Demo transcripts (ID starting with 'demo-') are automatically filtered out
 *
 * @param options - Pagination options (limit, offset, orderBy, orderDirection)
 * @returns Object containing paginated result and loading state
 *
 * @example
 * ```tsx
 * function TranscriptList() {
 *   const { result, isLoading } = useTranscriptsPaginated({ limit: 50, offset: 0 });
 *
 *   if (isLoading) return <Loader />;
 *
 *   return (
 *     <div>
 *       {result.items.map(transcript => (
 *         <TranscriptCard key={transcript.id} transcript={transcript} />
 *       ))}
 *       {result.hasMore && <button>Load More</button>}
 *     </div>
 *   );
 * }
 * ```
 */
export function useTranscriptsPaginated(options: PaginationOptions = {}) {
  const result = useLiveQuery(
    async () => {
      try {
        const paginatedResult = await getTranscriptsPaginated(options);
        // Filter out demo transcripts and adjust counts
        const filteredItems = filterOutDemoTranscripts(paginatedResult.items);
        const demoCount = paginatedResult.items.length - filteredItems.length;
        return {
          ...paginatedResult,
          items: filteredItems,
          total: paginatedResult.total - demoCount,
          hasMore: paginatedResult.offset + filteredItems.length < (paginatedResult.total - demoCount),
        };
      } catch (error) {
        log.error('Error fetching paginated transcripts', {
          message: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    },
    [options.limit, options.offset, options.orderBy, options.orderDirection],
    { items: [], total: 0, hasMore: false, offset: 0, limit: 50 } as PaginatedResult<Transcript>
  );

  return {
    result: result || { items: [], total: 0, hasMore: false, offset: 0, limit: 50 },
    isLoading: result === undefined,
  };
}

/**
 * Hook to search transcripts with pagination (optimized for large result sets)
 * NOTE: Demo transcripts (ID starting with 'demo-') are automatically filtered out
 *
 * @param searchTerm - Search term to filter transcripts
 * @param options - Pagination options (limit, offset)
 * @returns Object containing paginated search results and loading state
 *
 * @example
 * ```tsx
 * function SearchResults({ query }: { query: string }) {
 *   const { result, isLoading } = useSearchTranscriptsPaginated(query, { limit: 50 });
 *
 *   if (isLoading) return <Loader />;
 *
 *   return (
 *     <div>
 *       <p>Found {result.total} results</p>
 *       {result.items.map(transcript => (
 *         <TranscriptCard key={transcript.id} transcript={transcript} />
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 */
export function useSearchTranscriptsPaginated(
  searchTerm: string,
  options: PaginationOptions = {}
) {
  const result = useLiveQuery(
    async () => {
      try {
        const searchResult = await searchTranscriptsPaginated(searchTerm, options);
        // Filter out demo transcripts and adjust counts
        const filteredItems = filterOutDemoTranscripts(searchResult.items);
        const demoCount = searchResult.items.length - filteredItems.length;
        return {
          ...searchResult,
          items: filteredItems,
          total: searchResult.total - demoCount,
          hasMore: searchResult.offset + filteredItems.length < (searchResult.total - demoCount),
        };
      } catch (error) {
        log.error('Error searching paginated transcripts', {
          message: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    },
    [searchTerm, options.limit, options.offset],
    { items: [], total: 0, hasMore: false, offset: 0, limit: 50 } as PaginatedResult<Transcript>
  );

  return {
    result: result || { items: [], total: 0, hasMore: false, offset: 0, limit: 50 },
    isLoading: result === undefined,
  };
}

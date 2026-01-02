/**
 * Pagination Types
 *
 * Shared pagination utilities for IndexedDB (Dexie) queries.
 */

/**
 * Pagination options for querying data.
 */
export interface PaginationOptions {
  /** Maximum number of items to return (default: varies by query) */
  limit?: number;
  /** Number of items to skip (default: 0) */
  offset?: number;
  /** Field to order results by */
  orderBy?: "createdAt" | "filename";
  /** Sort direction (default: 'desc') */
  orderDirection?: "asc" | "desc";
}

/**
 * Paginated result container.
 */
export interface PaginatedResult<T> {
  /** Items in the current page */
  items: T[];
  /** Total number of items matching the query */
  total: number;
  /** Whether there are more items after this page */
  hasMore: boolean;
  /** Current offset */
  offset: number;
  /** Current limit */
  limit: number;
}


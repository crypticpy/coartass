/**
 * Custom Hook for Transcript Search Functionality
 *
 * Provides debounced search, match navigation, and highlighting
 * for transcript text with keyboard shortcuts support.
 */

'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { findMatches, type SearchMatch } from '@/lib/transcript-utils';

/**
 * Search options configuration
 */
export interface SearchOptions {
  /** Debounce delay in milliseconds (default: 300) */
  debounceMs?: number;
  /** Case-sensitive search (default: false) */
  caseSensitive?: boolean;
}

/**
 * Search state and controls
 */
export interface UseTranscriptSearchResult {
  /** Current search query */
  searchQuery: string;
  /** Set the search query */
  setSearchQuery: (query: string) => void;
  /** Clear the search */
  clearSearch: () => void;
  /** All matches found in the text */
  matches: SearchMatch[];
  /** Total number of matches */
  matchCount: number;
  /** Current match index (0-based) */
  currentMatchIndex: number;
  /** Navigate to next match */
  nextMatch: () => void;
  /** Navigate to previous match */
  previousMatch: () => void;
  /** Jump to a specific match index */
  goToMatch: (index: number) => void;
  /** Whether there are any matches */
  hasMatches: boolean;
  /** Debounced search query (actual query being searched) */
  debouncedQuery: string;
}

/**
 * Custom hook for transcript search functionality
 *
 * @param text - The text to search in
 * @param options - Search configuration options
 * @returns Search state and control functions
 *
 * @example
 * ```tsx
 * const search = useTranscriptSearch(transcript.text);
 *
 * // In component
 * <input value={search.searchQuery} onChange={(e) => search.setSearchQuery(e.target.value)} />
 * <div>{search.matchCount} matches</div>
 * <button onClick={search.nextMatch}>Next</button>
 * ```
 */
export function useTranscriptSearch(
  text: string,
  options: SearchOptions = {}
): UseTranscriptSearchResult {
  const { debounceMs = 300 } = options;

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);

  // Debounce the search query
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedQuery(searchQuery);
      // Reset to first match when query changes
      setCurrentMatchIndex(0);
    }, debounceMs);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, debounceMs]);

  // Find all matches using the debounced query
  const matches = useMemo(() => {
    if (!debouncedQuery || !text) {
      return [];
    }
    return findMatches(text, debouncedQuery);
  }, [text, debouncedQuery]);

  const matchCount = matches.length;
  const hasMatches = matchCount > 0;

  // Navigate to next match
  const nextMatch = useCallback(() => {
    if (matchCount === 0) return;
    setCurrentMatchIndex((prev) => (prev + 1) % matchCount);
  }, [matchCount]);

  // Navigate to previous match
  const previousMatch = useCallback(() => {
    if (matchCount === 0) return;
    setCurrentMatchIndex((prev) => (prev - 1 + matchCount) % matchCount);
  }, [matchCount]);

  // Jump to specific match
  const goToMatch = useCallback((index: number) => {
    if (index >= 0 && index < matchCount) {
      setCurrentMatchIndex(index);
    }
  }, [matchCount]);

  // Clear search
  const clearSearch = useCallback(() => {
    setSearchQuery('');
    setDebouncedQuery('');
    setCurrentMatchIndex(0);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle if user is typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        // Only handle Enter for navigation within search inputs
        if (e.key === 'Enter' && hasMatches) {
          e.preventDefault();
          if (e.shiftKey) {
            previousMatch();
          } else {
            nextMatch();
          }
        }
        return;
      }

      // Global keyboard shortcuts
      // Cmd/Ctrl + F to focus search (handled by parent component)
      // Cmd/Ctrl + G or F3 for next match
      if ((e.metaKey || e.ctrlKey) && e.key === 'g') {
        e.preventDefault();
        if (e.shiftKey) {
          previousMatch();
        } else {
          nextMatch();
        }
      } else if (e.key === 'F3') {
        e.preventDefault();
        if (e.shiftKey) {
          previousMatch();
        } else {
          nextMatch();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hasMatches, nextMatch, previousMatch]);

  return {
    searchQuery,
    setSearchQuery,
    clearSearch,
    matches,
    matchCount,
    currentMatchIndex,
    nextMatch,
    previousMatch,
    goToMatch,
    hasMatches,
    debouncedQuery
  };
}

/**
 * Hook for managing search within transcript segments
 *
 * @param segments - Array of transcript segments
 * @param options - Search configuration options
 * @returns Search state including which segments contain matches
 */
export function useSegmentSearch(
  segments: Array<{ text: string; start: number; end: number }>,
  options: SearchOptions = {}
) {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const { debounceMs = 300 } = options;

  // Debounce the search query
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, debounceMs);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, debounceMs]);

  // Find segments that contain matches
  const matchingSegments = useMemo(() => {
    if (!debouncedQuery) {
      return new Set<number>();
    }

    const matching = new Set<number>();
    segments.forEach((segment, index) => {
      const matches = findMatches(segment.text, debouncedQuery);
      if (matches.length > 0) {
        matching.add(index);
      }
    });

    return matching;
  }, [segments, debouncedQuery]);

  // Get total match count across all segments
  const totalMatches = useMemo(() => {
    if (!debouncedQuery) return 0;

    return segments.reduce((total, segment) => {
      const matches = findMatches(segment.text, debouncedQuery);
      return total + matches.length;
    }, 0);
  }, [segments, debouncedQuery]);

  // Clear search
  const clearSearch = useCallback(() => {
    setSearchQuery('');
    setDebouncedQuery('');
  }, []);

  return {
    searchQuery,
    setSearchQuery,
    clearSearch,
    debouncedQuery,
    matchingSegments,
    totalMatches,
    hasMatches: totalMatches > 0
  };
}

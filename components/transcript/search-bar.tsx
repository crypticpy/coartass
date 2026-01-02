/**
 * Search Bar Component for Transcript Search
 *
 * Provides search input with match navigation, keyboard shortcuts,
 * and real-time match counting.
 */

'use client';

import React from 'react';
import { Search, X, ChevronUp, ChevronDown } from 'lucide-react';
import { TextInput, ActionIcon, Group, Text, Box, Kbd } from '@mantine/core';

export interface SearchBarProps {
  /** Current search query */
  searchQuery: string;
  /** Callback when search query changes */
  onSearchChange: (query: string) => void;
  /** Callback to clear search */
  onClear: () => void;
  /** Total number of matches */
  matchCount: number;
  /** Current match index (0-based) */
  currentMatchIndex: number;
  /** Callback to navigate to next match */
  onNextMatch: () => void;
  /** Callback to navigate to previous match */
  onPreviousMatch: () => void;
  /** Optional placeholder text */
  placeholder?: string;
  /** Optional className for styling */
  className?: string;
}

/**
 * Search bar component with match navigation
 *
 * Features:
 * - Real-time search with debouncing (handled by parent)
 * - Match counter display ("3 of 15 matches")
 * - Next/Previous navigation buttons
 * - Clear search button
 * - Keyboard shortcuts (Enter for next, Shift+Enter for previous)
 * - Accessible with ARIA labels
 *
 * @example
 * ```tsx
 * <SearchBar
 *   searchQuery={search.searchQuery}
 *   onSearchChange={search.setSearchQuery}
 *   onClear={search.clearSearch}
 *   matchCount={search.matchCount}
 *   currentMatchIndex={search.currentMatchIndex}
 *   onNextMatch={search.nextMatch}
 *   onPreviousMatch={search.previousMatch}
 * />
 * ```
 */
export function SearchBar({
  searchQuery,
  onSearchChange,
  onClear,
  matchCount,
  currentMatchIndex,
  onNextMatch,
  onPreviousMatch,
  placeholder = 'Search transcript...',
  className
}: SearchBarProps) {
  const hasMatches = matchCount > 0;
  const hasQuery = searchQuery.length > 0;

  // Handle keyboard shortcuts within the input
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && hasMatches) {
      e.preventDefault();
      if (e.shiftKey) {
        onPreviousMatch();
      } else {
        onNextMatch();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClear();
      e.currentTarget.blur();
    }
  };

  return (
    <Box
      className={className}
      role="search"
      aria-label="Transcript search"
      p="md"
      style={{
        backgroundColor: 'var(--mantine-color-default)',
        borderRadius: 'var(--mantine-radius-md)',
        border: '1px solid var(--mantine-color-default-border)',
      }}
    >
      <Group gap="sm" wrap="nowrap">
        {/* Search Input with Icon */}
        <TextInput
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          leftSection={<Search size={16} />}
          rightSection={
            hasQuery ? (
              <ActionIcon
                variant="subtle"
                color="gray"
                onClick={onClear}
                aria-label="Clear search"
                style={{ minWidth: 44, minHeight: 44 }}
              >
                <X size={16} />
              </ActionIcon>
            ) : null
          }
          styles={{
            input: {
              minHeight: 44,
            },
          }}
          style={{ flex: 1 }}
          aria-label="Search input"
          aria-describedby="search-results-count"
        />

        {/* Match Counter */}
        {hasQuery && (
          <Text
            id="search-results-count"
            size="sm"
            fw={500}
            c={hasMatches ? undefined : 'dimmed'}
            style={{
              minWidth: 100,
              textAlign: 'center',
              fontVariantNumeric: 'tabular-nums',
            }}
            aria-live="polite"
            aria-atomic="true"
          >
            {hasMatches
              ? `${currentMatchIndex + 1} of ${matchCount}`
              : 'No matches'}
          </Text>
        )}

        {/* Navigation Buttons */}
        {hasQuery && (
          <Group gap="xs" wrap="nowrap">
            <ActionIcon
              variant="default"
              onClick={onPreviousMatch}
              disabled={!hasMatches}
              aria-label="Previous match (Shift+Enter)"
              title="Previous match (Shift+Enter)"
              style={{ minWidth: 44, minHeight: 44 }}
            >
              <ChevronUp size={16} />
            </ActionIcon>

            <ActionIcon
              variant="default"
              onClick={onNextMatch}
              disabled={!hasMatches}
              aria-label="Next match (Enter)"
              title="Next match (Enter)"
              style={{ minWidth: 44, minHeight: 44 }}
            >
              <ChevronDown size={16} />
            </ActionIcon>
          </Group>
        )}

        {/* Keyboard Shortcuts Hint */}
        {!hasQuery && (
          <Group gap={4} visibleFrom="md">
            <Text size="xs" c="dimmed">
              <Kbd size="xs">Ctrl</Kbd>
              {' '}+{' '}
              <Kbd size="xs">F</Kbd>
            </Text>
          </Group>
        )}
      </Group>
    </Box>
  );
}

/**
 * Compact search bar variant for mobile or tight spaces
 */
export function CompactSearchBar({
  searchQuery,
  onSearchChange,
  onClear,
  matchCount,
  currentMatchIndex,
  onNextMatch,
  onPreviousMatch,
  placeholder = 'Search...',
  className
}: SearchBarProps) {
  const hasMatches = matchCount > 0;
  const hasQuery = searchQuery.length > 0;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && hasMatches) {
      e.preventDefault();
      if (e.shiftKey) {
        onPreviousMatch();
      } else {
        onNextMatch();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClear();
    }
  };

  return (
    <Group gap="xs" wrap="nowrap" className={className} role="search">
      <TextInput
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        leftSection={<Search size={14} />}
        rightSection={
          hasQuery ? (
            <ActionIcon
              variant="subtle"
              color="gray"
              onClick={onClear}
              size="sm"
              aria-label="Clear"
            >
              <X size={14} />
            </ActionIcon>
          ) : null
        }
        size="sm"
        style={{ flex: 1 }}
        aria-label="Search"
      />

      {hasQuery && (
        <>
          <Text
            size="xs"
            c="dimmed"
            style={{
              minWidth: 60,
              textAlign: 'center',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {hasMatches ? `${currentMatchIndex + 1}/${matchCount}` : '0'}
          </Text>
          <Group gap={2} wrap="nowrap">
            <ActionIcon
              variant="default"
              size="sm"
              onClick={onPreviousMatch}
              disabled={!hasMatches}
              aria-label="Previous"
            >
              <ChevronUp size={14} />
            </ActionIcon>
            <ActionIcon
              variant="default"
              size="sm"
              onClick={onNextMatch}
              disabled={!hasMatches}
              aria-label="Next"
            >
              <ChevronDown size={14} />
            </ActionIcon>
          </Group>
        </>
      )}
    </Group>
  );
}

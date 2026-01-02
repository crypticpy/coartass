/**
 * Transcript Viewer Component
 *
 * Main component for viewing and interacting with transcripts.
 * Supports full text view, segmented view, search, and navigation.
 */

'use client';

import React, { useState, useCallback, memo } from 'react';
import { Copy, Check, FileText, List } from 'lucide-react';
import {
  Button,
  Tabs,
  Stack,
  Alert,
  Group,
  Text,
  Box,
  ScrollArea,
} from '@mantine/core';
import { useTranscriptSearch } from '@/hooks/use-transcript-search';
import {
  highlightText,
  copyToClipboard,
  calculateWordCount
} from '@/lib/transcript-utils';
import { SearchBar } from './search-bar';
import { SegmentList } from './segment-list';
import type { Transcript } from '@/types/transcript';

export interface TranscriptViewerProps {
  /** The transcript to display */
  transcript: Transcript;
  /** Default view mode */
  defaultView?: 'full' | 'segments';
  /** Optional className for styling */
  className?: string;
  /** Active segment index from audio player */
  activeSegmentIndex?: number;
  /** Callback when user clicks on a segment timestamp */
  onSegmentClick?: (index: number) => void;
}

/**
 * Main transcript viewer component
 *
 * Features:
 * - Toggle between full text and segmented view
 * - Search with highlighting and navigation
 * - Copy to clipboard functionality
 * - Responsive layout
 * - Keyboard shortcuts
 *
 * @example
 * ```tsx
 * <TranscriptViewer
 *   transcript={transcript}
 *   defaultView="segments"
 * />
 * ```
 */
export const TranscriptViewer = memo(function TranscriptViewer({
  transcript,
  defaultView = 'segments',
  className,
  activeSegmentIndex: externalActiveSegmentIndex,
  onSegmentClick: externalOnSegmentClick,
}: TranscriptViewerProps) {
  const [viewMode, setViewMode] = useState<'full' | 'segments'>(defaultView);
  const [copiedToClipboard, setCopiedToClipboard] = useState(false);
  const [internalActiveSegmentIndex, setInternalActiveSegmentIndex] = useState<number | undefined>();

  // Use external active segment if provided, otherwise use internal
  const activeSegmentIndex = externalActiveSegmentIndex !== undefined
    ? externalActiveSegmentIndex
    : internalActiveSegmentIndex;

  // Search functionality
  const search = useTranscriptSearch(transcript.text);

  // Handle copy to clipboard
  const handleCopyToClipboard = useCallback(async () => {
    try {
      await copyToClipboard(transcript.text);
      setCopiedToClipboard(true);
      setTimeout(() => setCopiedToClipboard(false), 2000);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  }, [transcript.text]);

  // Handle segment click
  const handleSegmentClick = useCallback((index: number) => {
    // Call external handler if provided
    if (externalOnSegmentClick) {
      externalOnSegmentClick(index);
    } else {
      // Otherwise use internal state
      setInternalActiveSegmentIndex(index);
    }
  }, [externalOnSegmentClick]);

  const wordCount = calculateWordCount(transcript.text);

  return (
    <Stack gap="md" className={className}>
      {/* Search Bar */}
      <SearchBar
        searchQuery={search.searchQuery}
        onSearchChange={search.setSearchQuery}
        onClear={search.clearSearch}
        matchCount={search.matchCount}
        currentMatchIndex={search.currentMatchIndex}
        onNextMatch={search.nextMatch}
        onPreviousMatch={search.previousMatch}
      />

      {/* View Toggle, Copy Button, and Keyboard Shortcuts */}
      <Group justify="space-between" align="center">
        <Tabs
          value={viewMode}
          onChange={(value) => setViewMode(value as 'full' | 'segments')}
        >
          <Tabs.List>
            <Tabs.Tab
              value="full"
              leftSection={<FileText size={16} />}
              styles={{ tab: { minHeight: 44 } }}
            >
              Full Text
            </Tabs.Tab>
            <Tabs.Tab
              value="segments"
              leftSection={<List size={16} />}
              styles={{ tab: { minHeight: 44 } }}
            >
              Segments ({transcript.segments.length})
            </Tabs.Tab>
          </Tabs.List>
        </Tabs>

        <Group gap="sm">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyToClipboard}
            leftSection={
              copiedToClipboard ? (
                <Check size={16} style={{ color: 'green' }} />
              ) : (
                <Copy size={16} />
              )
            }
            styles={{ root: { minHeight: 44 } }}
          >
            {copiedToClipboard ? 'Copied!' : 'Copy Text'}
          </Button>
        </Group>
      </Group>

      {/* Empty State */}
      {!transcript.text && (
        <Alert variant="light" color="blue" title="No transcript text available" />
      )}

      {/* Content Views */}
      {transcript.text && (
        <Box style={{ flex: 1, minHeight: 0 }}>
          {viewMode === 'full' ? (
            <FullTextView
              text={transcript.text}
              searchQuery={search.debouncedQuery}
              currentMatchIndex={search.currentMatchIndex}
              wordCount={wordCount}
            />
          ) : (
            <SegmentView
              segments={transcript.segments}
              searchQuery={search.debouncedQuery}
              currentMatchIndex={search.currentMatchIndex}
              activeSegmentIndex={activeSegmentIndex}
              onSegmentClick={handleSegmentClick}
            />
          )}
        </Box>
      )}
    </Stack>
  );
}, (prevProps, nextProps) => {
  // Only re-render if transcript or key props change
  return prevProps.transcript.id === nextProps.transcript.id &&
         prevProps.transcript.text === nextProps.transcript.text &&
         prevProps.activeSegmentIndex === nextProps.activeSegmentIndex &&
         prevProps.onSegmentClick === nextProps.onSegmentClick;
});

/**
 * Full text view component
 */
interface FullTextViewProps {
  text: string;
  searchQuery: string;
  currentMatchIndex: number;
  wordCount: number;
}

const FullTextView = memo(function FullTextView({
  text,
  searchQuery,
  currentMatchIndex,
  wordCount
}: FullTextViewProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Scroll to current match when it changes
  React.useEffect(() => {
    if (searchQuery && containerRef.current) {
      const currentMatch = containerRef.current.querySelector('#current-search-match');
      if (currentMatch) {
        currentMatch.scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        });
      }
    }
  }, [currentMatchIndex, searchQuery]);

  return (
    <Stack gap={0} style={{ height: '100%' }}>
      {/* Stats Bar */}
      <Group
        justify="space-between"
        px="md"
        py="sm"
        style={{
          backgroundColor: 'var(--mantine-color-default)',
          borderBottom: '1px solid var(--mantine-color-default-border)',
        }}
      >
        <Text size="sm" c="dimmed">{wordCount.toLocaleString()} words</Text>
        <Text size="sm" c="dimmed">{text.length.toLocaleString()} characters</Text>
      </Group>

      {/* Text Content */}
      <ScrollArea
        ref={containerRef}
        style={{
          flex: 1,
          backgroundColor: 'var(--mantine-color-body)',
          border: '1px solid var(--mantine-color-default-border)',
          borderRadius: 'var(--mantine-radius-md)',
        }}
        p="lg"
        type="auto"
        role="article"
        aria-label="Transcript full text"
      >
        <Text
          size="md"
          style={{
            lineHeight: 1.6,
            whiteSpace: 'pre-wrap',
          }}
        >
          {searchQuery
            ? highlightText(text, searchQuery, currentMatchIndex)
            : text}
        </Text>
      </ScrollArea>
    </Stack>
  );
}, (prevProps, nextProps) => {
  // Only re-render if text or search changes
  return prevProps.text === nextProps.text &&
         prevProps.searchQuery === nextProps.searchQuery &&
         prevProps.currentMatchIndex === nextProps.currentMatchIndex;
});

/**
 * Segment view component
 */
interface SegmentViewProps {
  segments: Transcript['segments'];
  searchQuery: string;
  currentMatchIndex: number;
  activeSegmentIndex?: number;
  onSegmentClick: (index: number) => void;
}

const SegmentView = memo(function SegmentView({
  segments,
  searchQuery,
  currentMatchIndex,
  activeSegmentIndex,
  onSegmentClick
}: SegmentViewProps) {
  if (segments.length === 0) {
    return (
      <Alert
        variant="light"
        color="blue"
        title="No segments available"
      >
        The transcript may not have been processed with timestamps.
      </Alert>
    );
  }

  return (
    <Box style={{ paddingRight: 8 }}>
      <SegmentList
        segments={segments}
        searchQuery={searchQuery}
        currentMatchIndex={currentMatchIndex}
        activeSegmentIndex={activeSegmentIndex}
        onSegmentClick={onSegmentClick}
      />
    </Box>
  );
}, (prevProps, nextProps) => {
  // Only re-render if segments or search changes
  return prevProps.segments === nextProps.segments &&
         prevProps.searchQuery === nextProps.searchQuery &&
         prevProps.currentMatchIndex === nextProps.currentMatchIndex &&
         prevProps.activeSegmentIndex === nextProps.activeSegmentIndex &&
         prevProps.onSegmentClick === nextProps.onSegmentClick;
});

/**
 * Compact transcript viewer for mobile or embedded use
 */
export const CompactTranscriptViewer = memo(function CompactTranscriptViewer({
  transcript,
  className
}: Omit<TranscriptViewerProps, 'defaultView'>) {
  const [showSearch, setShowSearch] = useState(false);
  const search = useTranscriptSearch(transcript.text);

  return (
    <Stack gap="sm" className={className}>
      {/* Search Toggle */}
      <Group justify="space-between" align="center">
        <Text size="sm" fw={600}>
          {transcript.segments.length} segments
        </Text>
        <Button
          variant="subtle"
          size="xs"
          onClick={() => setShowSearch(!showSearch)}
        >
          {showSearch ? 'Hide' : 'Search'}
        </Button>
      </Group>

      {/* Search Bar (collapsible) */}
      {showSearch && (
        <SearchBar
          searchQuery={search.searchQuery}
          onSearchChange={search.setSearchQuery}
          onClear={search.clearSearch}
          matchCount={search.matchCount}
          currentMatchIndex={search.currentMatchIndex}
          onNextMatch={search.nextMatch}
          onPreviousMatch={search.previousMatch}
          placeholder="Search..."
        />
      )}

      {/* Segments */}
      <Box style={{ maxHeight: 400 }}>
        <SegmentList
          segments={transcript.segments}
          searchQuery={search.debouncedQuery}
          currentMatchIndex={search.currentMatchIndex}
        />
      </Box>
    </Stack>
  );
}, (prevProps, nextProps) => {
  return prevProps.transcript.id === nextProps.transcript.id &&
         prevProps.transcript.text === nextProps.transcript.text;
});

/**
 * Transcript viewer with split view (segments + full text side by side)
 */
export const SplitTranscriptViewer = memo(function SplitTranscriptViewer({
  transcript,
  className
}: Omit<TranscriptViewerProps, 'defaultView'>) {
  const [activeSegmentIndex, setActiveSegmentIndex] = useState<number>();
  const search = useTranscriptSearch(transcript.text);

  return (
    <Stack gap="md" className={className}>
      {/* Search Bar */}
      <SearchBar
        searchQuery={search.searchQuery}
        onSearchChange={search.setSearchQuery}
        onClear={search.clearSearch}
        matchCount={search.matchCount}
        currentMatchIndex={search.currentMatchIndex}
        onNextMatch={search.nextMatch}
        onPreviousMatch={search.previousMatch}
      />

      {/* Split View */}
      <Box
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
          gap: 16,
          height: 600,
        }}
      >
        {/* Segments Panel */}
        <Stack gap={0} style={{ border: '1px solid var(--mantine-color-default-border)', borderRadius: 'var(--mantine-radius-md)', overflow: 'hidden' }}>
          <Box px="md" py="sm" style={{ backgroundColor: 'var(--mantine-color-default)', borderBottom: '1px solid var(--mantine-color-default-border)' }}>
            <Text size="sm" fw={600}>
              Segments ({transcript.segments.length})
            </Text>
          </Box>
          <Box style={{ flex: 1, overflow: 'auto', padding: 16 }}>
            <SegmentList
              segments={transcript.segments}
              searchQuery={search.debouncedQuery}
              currentMatchIndex={search.currentMatchIndex}
              activeSegmentIndex={activeSegmentIndex}
              onSegmentClick={setActiveSegmentIndex}
            />
          </Box>
        </Stack>

        {/* Full Text Panel */}
        <Stack gap={0} style={{ border: '1px solid var(--mantine-color-default-border)', borderRadius: 'var(--mantine-radius-md)', overflow: 'hidden' }}>
          <Box px="md" py="sm" style={{ backgroundColor: 'var(--mantine-color-default)', borderBottom: '1px solid var(--mantine-color-default-border)' }}>
            <Text size="sm" fw={600}>Full Text</Text>
          </Box>
          <ScrollArea style={{ flex: 1 }} p="lg">
            <Text size="sm" style={{ lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
              {search.debouncedQuery
                ? highlightText(
                    transcript.text,
                    search.debouncedQuery,
                    search.currentMatchIndex
                  )
                : transcript.text}
            </Text>
          </ScrollArea>
        </Stack>
      </Box>
    </Stack>
  );
}, (prevProps, nextProps) => {
  return prevProps.transcript.id === nextProps.transcript.id &&
         prevProps.transcript.text === nextProps.transcript.text;
});

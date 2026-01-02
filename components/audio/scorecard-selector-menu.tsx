/**
 * Scorecard Selector Menu Component
 *
 * Dropdown menu for selecting which RTASS scorecard to overlay
 * in the Interactive Review Mode. Displays scorecard metadata
 * including score, status, date, and model info.
 *
 * Design: Matches the dark command-center aesthetic of interactive-review-mode.tsx
 */

'use client';

import React, { useMemo } from 'react';
import { Menu, Button, Text, Box, Badge, Group } from '@mantine/core';
import {
  ChevronDown,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  FileSearch,
  X,
} from 'lucide-react';
import type { RtassScorecard } from '@/types/rtass';

/**
 * Props for the ScorecardSelectorMenu component
 */
export interface ScorecardSelectorMenuProps {
  /** List of available scorecards for the transcript */
  scorecards: RtassScorecard[];
  /** Currently selected scorecard ID */
  selectedScorecardId: string | null;
  /** Callback when user selects a scorecard */
  onSelect: (id: string | null) => void;
  /** Optional styling */
  className?: string;
}

/**
 * Format date for display in menu items
 */
function formatScorecardDate(date: Date): string {
  const d = new Date(date);
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * Get status color based on scorecard status
 */
function getStatusColor(status: 'pass' | 'needs_improvement' | 'fail'): string {
  switch (status) {
    case 'pass':
      return 'var(--review-green, #22c55e)';
    case 'needs_improvement':
      return 'var(--review-amber, #f59e0b)';
    case 'fail':
      return 'var(--review-red, #ef4444)';
    default:
      return 'var(--review-text-dim, #71717a)';
  }
}

/**
 * Get Mantine badge color based on scorecard status
 */
function getBadgeColor(status: 'pass' | 'needs_improvement' | 'fail'): string {
  switch (status) {
    case 'pass':
      return 'green';
    case 'needs_improvement':
      return 'yellow';
    case 'fail':
      return 'red';
    default:
      return 'gray';
  }
}

/**
 * Get status icon component based on scorecard status
 */
function getStatusIcon(status: 'pass' | 'needs_improvement' | 'fail') {
  const iconProps = { size: 14, style: { color: getStatusColor(status) } };
  switch (status) {
    case 'pass':
      return <CheckCircle2 {...iconProps} />;
    case 'needs_improvement':
      return <AlertTriangle {...iconProps} />;
    case 'fail':
      return <XCircle {...iconProps} />;
    default:
      return null;
  }
}

/**
 * Scorecard Selector Menu Component
 *
 * Provides a dropdown menu for selecting which RTASS scorecard
 * to overlay in the Interactive Review Mode.
 */
export function ScorecardSelectorMenu({
  scorecards,
  selectedScorecardId,
  onSelect,
  className,
}: ScorecardSelectorMenuProps) {
  // Find the currently selected scorecard
  const selectedScorecard = useMemo(
    () => scorecards.find((sc) => sc.id === selectedScorecardId),
    [scorecards, selectedScorecardId]
  );

  // Sort scorecards by creation date (newest first)
  const sortedScorecards = useMemo(
    () =>
      [...scorecards].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ),
    [scorecards]
  );

  // Empty state - no scorecards available
  if (scorecards.length === 0) {
    return (
      <Button
        variant="default"
        disabled
        className={className}
        leftSection={<FileSearch size={16} />}
        styles={{
          root: {
            backgroundColor: 'var(--review-surface-elevated, #1c1c1f)',
            borderColor: 'var(--review-border, #2a2a2e)',
            color: 'var(--review-text-dim, #71717a)',
            cursor: 'not-allowed',
          },
        }}
      >
        No Scorecards Available
      </Button>
    );
  }

  return (
    <Menu
      position="bottom-start"
      width={320}
      shadow="lg"
      withinPortal
      styles={{
        dropdown: {
          backgroundColor: 'var(--review-surface, #141416)',
          borderColor: 'var(--review-border, #2a2a2e)',
          border: '1px solid var(--review-border, #2a2a2e)',
        },
        item: {
          color: 'var(--review-text, #f5f5f4)',
          backgroundColor: 'transparent',
        },
        label: {
          color: 'var(--review-text-dim, #71717a)',
          fontSize: '11px',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
        },
        divider: {
          borderColor: 'var(--review-border, #2a2a2e)',
        },
      }}
    >
      <Menu.Target>
        <Button
          variant="default"
          className={className}
          rightSection={<ChevronDown size={14} />}
          styles={{
            root: {
              backgroundColor: selectedScorecard
                ? 'var(--review-amber-glow, rgba(245, 158, 11, 0.15))'
                : 'var(--review-surface-elevated, #1c1c1f)',
              borderColor: selectedScorecard
                ? 'var(--review-amber, #f59e0b)'
                : 'var(--review-border, #2a2a2e)',
              color: 'var(--review-text, #f5f5f4)',
              '&:hover': {
                backgroundColor: 'var(--review-surface, #141416)',
              },
            },
          }}
        >
          {selectedScorecard ? (
            <Group gap="xs" wrap="nowrap">
              {getStatusIcon(selectedScorecard.overall.status)}
              <Text size="sm" fw={500}>
                {Math.round(selectedScorecard.overall.score * 100)}%
              </Text>
            </Group>
          ) : (
            <Group gap="xs" wrap="nowrap">
              <FileSearch size={16} />
              <Text size="sm">Select Scorecard</Text>
            </Group>
          )}
        </Button>
      </Menu.Target>

      <Menu.Dropdown>
        <Menu.Label>Available Scorecards</Menu.Label>

        {/* Clear selection option */}
        {selectedScorecardId && (
          <>
            <Menu.Item
              onClick={() => onSelect(null)}
              leftSection={<X size={14} style={{ color: 'var(--review-text-dim, #71717a)' }} />}
            >
              <Text size="sm" c="dimmed">
                Clear Selection
              </Text>
            </Menu.Item>
            <Menu.Divider />
          </>
        )}

        {/* Scorecard list */}
        {sortedScorecards.map((scorecard) => {
          const isSelected = scorecard.id === selectedScorecardId;
          const scorePercent = Math.round(scorecard.overall.score * 100);

          return (
            <Menu.Item
              key={scorecard.id}
              onClick={() => onSelect(scorecard.id)}
              style={{
                backgroundColor: isSelected
                  ? 'var(--review-amber-glow, rgba(245, 158, 11, 0.15))'
                  : undefined,
              }}
            >
              <Box>
                {/* Top row: Score badge and status icon */}
                <Group justify="space-between" mb={4}>
                  <Group gap="xs">
                    <Badge
                      size="sm"
                      color={getBadgeColor(scorecard.overall.status)}
                      variant="filled"
                      style={{
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {scorePercent}%
                    </Badge>
                    {getStatusIcon(scorecard.overall.status)}
                  </Group>
                  {isSelected && (
                    <CheckCircle2
                      size={14}
                      style={{ color: 'var(--review-amber, #f59e0b)' }}
                    />
                  )}
                </Group>

                {/* Bottom row: Date */}
                <Text size="xs" c="dimmed">
                  {formatScorecardDate(scorecard.createdAt)}
                </Text>
              </Box>
            </Menu.Item>
          );
        })}
      </Menu.Dropdown>
    </Menu>
  );
}

export default ScorecardSelectorMenu;

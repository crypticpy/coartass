/**
 * Evidence Card Component
 *
 * Displays a single piece of evidence with timestamp, quote, and relevance score.
 * Provides click-to-timestamp functionality for jumping to the source in the transcript.
 */

'use client';

import React from 'react';
import { Clock, TrendingUp } from 'lucide-react';
import { Paper, Badge, Flex, Box, Group, Text, Stack } from '@mantine/core';
import type { Evidence } from '@/types/analysis';

/**
 * Format seconds to MM:SS or HH:MM:SS format
 */
function formatTimestamp(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Get relevance color based on score (Austin brand colors)
 */
function getRelevanceColor(score: number): string {
  if (score >= 0.9) return 'var(--compliant-green)'; // High relevance - Austin green
  if (score >= 0.8) return 'var(--compliant-green)'; // Very relevant - Austin green
  if (score >= 0.7) return 'var(--aph-cyan)'; // Relevant - Austin cyan
  if (score >= 0.6) return 'var(--aph-cyan)'; // Somewhat relevant - Austin cyan
  return 'var(--mantine-color-gray-5)'; // Moderate - gray
}

/**
 * Get relevance label based on score
 */
function getRelevanceLabel(score: number): string {
  if (score >= 0.9) return 'Highly Relevant';
  if (score >= 0.8) return 'Very Relevant';
  if (score >= 0.7) return 'Relevant';
  if (score >= 0.6) return 'Somewhat Relevant';
  return 'Moderately Relevant';
}

export interface EvidenceCardProps {
  /** The evidence data to display */
  evidence: Evidence;

  /** Optional callback when timestamp is clicked */
  onTimestampClick?: (timestamp: number) => void;

  /** Whether to show the relevance score */
  showRelevance?: boolean;

  /** Compact display mode */
  compact?: boolean;
}

/**
 * Evidence Card component displaying a single piece of supporting evidence
 * with timestamp navigation and relevance indicator.
 */
export function EvidenceCard({
  evidence,
  onTimestampClick,
  showRelevance = true,
  compact = false,
}: EvidenceCardProps) {
  // Defensive validation: ensure evidence has all required fields
  if (!evidence ||
      typeof evidence.start !== 'number' ||
      typeof evidence.end !== 'number' ||
      typeof evidence.relevance !== 'number' ||
      typeof evidence.text !== 'string') {
    console.error('Invalid evidence object:', evidence);
    return null;
  }

  const handleTimestampClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (onTimestampClick) {
      onTimestampClick(evidence.start);
    }
  };

  const relevanceColor = getRelevanceColor(evidence.relevance);
  const relevanceLabel = getRelevanceLabel(evidence.relevance);
  const relevancePercentage = Math.round(evidence.relevance * 100);

  if (compact) {
    return (
      <Box
        py="sm"
        pl="sm"
        style={{
          borderLeft: '2px solid var(--mantine-color-default-border)',
        }}
      >
        <Stack gap="xs">
          <Group gap="sm">
            <Box
              component="button"
              onClick={handleTimestampClick}
              title="Jump to timestamp"
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                transition: 'color 150ms',
              }}
            >
              <Group gap={4}>
                <Clock size={12} style={{ color: 'var(--mantine-color-dimmed)' }} />
                <Text size="xs" ff="monospace" c="dimmed">
                  {formatTimestamp(evidence.start)}
                </Text>
              </Group>
            </Box>
            {showRelevance && (
              <Badge size="xs" variant="light">
                {relevancePercentage}%
              </Badge>
            )}
          </Group>
          <Text size="sm" c="dimmed" fs="italic">
            &quot;{evidence.text}&quot;
          </Text>
        </Stack>
      </Box>
    );
  }

  return (
    <Paper
      p="md"
      shadow="sm"
      withBorder
      style={{
        transition: 'box-shadow 150ms',
        cursor: 'default',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = 'var(--mantine-shadow-md)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = 'var(--mantine-shadow-sm)';
      }}
    >
      <Stack gap="md">
        {/* Header: Timestamp and Relevance */}
        <Flex align="center" justify="space-between" gap="md">
          <Box
            component="button"
            onClick={handleTimestampClick}
            title="Click to jump to this timestamp"
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              transition: 'color 150ms',
            }}
          >
            <Group gap="sm">
              <Clock size={16} style={{ color: 'var(--mantine-color-dimmed)' }} />
              <Text size="sm" fw={500} ff="monospace">
                {formatTimestamp(evidence.start)} - {formatTimestamp(evidence.end)}
              </Text>
            </Group>
          </Box>

          {showRelevance && (
            <Group gap="sm">
              <Group gap={6}>
                <TrendingUp size={14} style={{ color: 'var(--mantine-color-dimmed)' }} />
                <Text size="xs" c="dimmed">
                  {relevanceLabel}
                </Text>
              </Group>
              <Box
                style={{
                  position: 'relative',
                  width: 64,
                  height: 8,
                  backgroundColor: 'var(--mantine-color-default-hover)',
                  borderRadius: 'var(--mantine-radius-xl)',
                  overflow: 'hidden',
                }}
              >
                <Box
                  style={{
                    position: 'absolute',
                    top: 0,
                    bottom: 0,
                    left: 0,
                    backgroundColor: relevanceColor,
                    borderRadius: 'var(--mantine-radius-xl)',
                    width: `${relevancePercentage}%`,
                    transition: 'width 200ms',
                  }}
                />
              </Box>
              <Text size="xs" fw={500} c="dimmed" style={{ minWidth: '3ch', textAlign: 'right' }}>
                {relevancePercentage}%
              </Text>
            </Group>
          )}
        </Flex>

        {/* Evidence Quote */}
        <Box
          component="blockquote"
          pl="md"
          py="xs"
          style={{
            borderLeft: '2px solid var(--logo-blue)',
            opacity: 0.8,
          }}
        >
          <Text size="sm" c="dimmed" fs="italic">
            &quot;{evidence.text}&quot;
          </Text>
        </Box>

        {/* Context Indicator */}
        <Group gap="sm">
          <Text size="xs" c="dimmed">
            Duration: {Math.round(evidence.end - evidence.start)}s
          </Text>
        </Group>
      </Stack>
    </Paper>
  );
}

/**
 * Phase Timeline Component
 *
 * Displays a visual timeline of analysis phases showing:
 * - Completed phases (checkmark)
 * - Current phase (animated indicator)
 * - Upcoming phases (empty state)
 *
 * Shows users exactly where they are in the analysis process
 * with strategy-specific phase names and progress ranges.
 */

'use client';

import React from 'react';
import { Stack, Group, Text, Box, ThemeIcon, Progress } from '@mantine/core';
import { CheckCircle, Circle, Loader2 } from 'lucide-react';
import type { ProgressPhase } from '@/lib/analysis-progress-metadata';

interface PhaseTimelineProps {
  /** All phases for the current strategy */
  phases: ProgressPhase[];
  /** Current progress percentage (0-100) */
  currentProgress: number;
  /** Compact mode for smaller displays */
  compact?: boolean;
  /** Whether to show the header (default: true, set to false when used inside accordion) */
  showHeader?: boolean;
}

/**
 * Get phase status based on current progress
 */
function getPhaseStatus(
  phase: ProgressPhase,
  currentProgress: number
): 'completed' | 'current' | 'pending' {
  const [start, end] = phase.range;

  if (currentProgress > end) {
    return 'completed';
  } else if (currentProgress >= start && currentProgress <= end) {
    return 'current';
  } else {
    return 'pending';
  }
}

/**
 * Calculate progress within a phase (0-100)
 */
function getProgressWithinPhase(phase: ProgressPhase, currentProgress: number): number {
  const [start, end] = phase.range;
  const phaseSpan = end - start;

  // Guard against division by zero if phase has zero span
  if (phaseSpan === 0) return currentProgress >= start ? 100 : 0;

  if (currentProgress < start) return 0;
  if (currentProgress > end) return 100;

  const progressInPhase = currentProgress - start;
  return Math.round((progressInPhase / phaseSpan) * 100);
}

/**
 * Phase Timeline Component
 */
export function PhaseTimeline({
  phases,
  currentProgress,
  compact = false,
  showHeader = true,
}: PhaseTimelineProps) {
  return (
    <Stack gap={compact ? "xs" : "sm"}>
      {/* Header - hidden when showHeader=false (e.g., when inside an accordion) */}
      {showHeader && !compact && (
        <Group justify="space-between" align="center">
          <Text size="sm" fw={600} c="dimmed">
            Analysis Phases
          </Text>
          <Text size="xs" c="dimmed">
            {phases.filter(p => getPhaseStatus(p, currentProgress) === 'completed').length} of{' '}
            {phases.length} complete
          </Text>
        </Group>
      )}

      {/* Phase List */}
      <Stack gap={compact ? 4 : "xs"}>
        {phases.map((phase, index) => {
          const status = getPhaseStatus(phase, currentProgress);
          const phaseProgress = getProgressWithinPhase(phase, currentProgress);

          return (
            <Box key={phase.id}>
              <Group gap="sm" align="flex-start" wrap="nowrap">
                {/* Status Icon */}
                <ThemeIcon
                  size={compact ? 20 : 24}
                  radius="xl"
                  variant={status === 'completed' ? 'filled' : 'light'}
                  color={
                    status === 'completed'
                      ? 'green'
                      : status === 'current'
                      ? 'blue'
                      : 'gray'
                  }
                  style={{
                    flexShrink: 0,
                    marginTop: 2,
                  }}
                >
                  {status === 'completed' ? (
                    <CheckCircle size={compact ? 12 : 14} aria-label="Completed" />
                  ) : status === 'current' ? (
                    <Loader2 size={compact ? 12 : 14} className="animate-spin" aria-label="Processing" role="status" />
                  ) : (
                    <Circle size={compact ? 12 : 14} aria-label="Pending" />
                  )}
                </ThemeIcon>

                {/* Phase Info */}
                <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
                  <Group justify="space-between" align="center" wrap="nowrap">
                    <Text
                      size={compact ? "xs" : "sm"}
                      fw={status === 'current' ? 600 : 500}
                      c={
                        status === 'completed'
                          ? 'dimmed'
                          : status === 'current'
                          ? undefined
                          : 'dimmed'
                      }
                      style={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {phase.name}
                    </Text>
                    {/* Show phase-specific progress: completed=100%, current=X%, pending=0% */}
                    <Text
                      size="xs"
                      c={status === 'current' ? 'blue' : 'dimmed'}
                      fw={status === 'current' ? 500 : 400}
                      style={{ flexShrink: 0 }}
                    >
                      {status === 'completed' ? '100%' : status === 'current' ? `${phaseProgress}%` : '0%'}
                    </Text>
                  </Group>

                  {/* Progress bar for current phase with 0-100 scale markers */}
                  {status === 'current' && !compact && (
                    <Box style={{ marginTop: 4 }}>
                      <Progress
                        value={phaseProgress}
                        size="xs"
                        color="blue"
                        animated
                      />
                      <Group justify="space-between" mt={2}>
                        <Text size="xs" c="dimmed">0%</Text>
                        <Text size="xs" c="dimmed">100%</Text>
                      </Group>
                    </Box>
                  )}

                  {/* Phase description (only for current phase in non-compact mode) */}
                  {status === 'current' && phase.description && !compact && (
                    <Text size="xs" c="dimmed" style={{ marginTop: 2 }}>
                      {phase.description}
                    </Text>
                  )}
                </Stack>
              </Group>

              {/* Connector line (not for last phase) */}
              {index < phases.length - 1 && (
                <Box
                  style={{
                    width: 2,
                    height: compact ? 12 : 16,
                    backgroundColor:
                      status === 'completed'
                        ? 'var(--mantine-color-green-6)'
                        : 'var(--mantine-color-gray-3)',
                    marginLeft: compact ? 9 : 11,
                    marginTop: 4,
                    marginBottom: 4,
                  }}
                />
              )}
            </Box>
          );
        })}
      </Stack>
    </Stack>
  );
}

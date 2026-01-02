/**
 * Analysis Progress Card Component
 *
 * Displays the progress UI during transcript analysis including:
 * - Strategy badge and title
 * - GPT-5.2 upgrade notice
 * - Progress bar with time estimate
 * - Phase timeline (for hybrid/advanced)
 * - Section checklist (for advanced)
 * - Saving indicator
 *
 * Extracted from analyze/page.tsx to improve maintainability.
 */

'use client';

import React, { useMemo } from 'react';
import {
  Card,
  Stack,
  Group,
  Text,
  Title,
  Button,
  Alert,
  Progress,
  Box,
  Divider,
  Accordion,
} from '@mantine/core';
import {
  Loader2,
  X,
  Sparkles,
  Clock,
} from 'lucide-react';
import type { AnalysisProgress } from '@/types/analysis';
import type { Template } from '@/types/template';
import type { AnalysisStrategy } from '@/lib/analysis-strategy';
import { StrategyBadge } from '@/components/analysis/strategy-badge';
import { PhaseTimeline } from '@/components/analysis/phase-timeline';
import {
  getStrategyPhases,
  calculateEstimatedTime,
  getDisplayTimeRange,
} from '@/lib/analysis-progress-metadata';

/**
 * Props for AnalysisProgressCard component
 */
export interface AnalysisProgressCardProps {
  /** Current progress state */
  progress: AnalysisProgress;
  /** Resolved strategy being used (after 'auto' resolution) */
  resolvedStrategy: AnalysisStrategy | null;
  /** User-selected strategy (may be 'auto') */
  selectedStrategy: AnalysisStrategy | 'auto';
  /** Selected template for analysis */
  template: Template;
  /** Whether self-evaluation is enabled */
  runEvaluation: boolean;
  /** Whether phases accordion is expanded */
  phasesExpanded: boolean;
  /** Callback when phases accordion state changes */
  onPhasesExpandedChange: (expanded: boolean) => void;
  /** Callback to cancel analysis */
  onCancel: () => void;
}

/**
 * Analysis Progress Card Component
 *
 * Displays progress UI with strategy-specific phases and time estimates.
 */
export function AnalysisProgressCard({
  progress,
  resolvedStrategy,
  selectedStrategy,
  template,
  runEvaluation,
  phasesExpanded,
  onPhasesExpandedChange,
  onCancel,
}: AnalysisProgressCardProps) {
  // Memoize time remaining calculation for performance
  const remainingMinutes = useMemo(() => {
    if (!resolvedStrategy || progress.progress <= 5 || progress.progress >= 90) {
      return null;
    }
    const totalSeconds = calculateEstimatedTime(
      resolvedStrategy,
      template.sections.length,
      runEvaluation
    );
    const remainingSeconds = totalSeconds * (1 - progress.progress / 100);
    return Math.max(1, Math.ceil(remainingSeconds / 60));
  }, [resolvedStrategy, template.sections.length, runEvaluation, progress.progress]);

  return (
    <Card padding="lg" radius="md" withBorder style={{ position: 'relative' }}>
      <Stack gap="md">
        {/* Header with strategy badge and cancel button */}
        <Group justify="space-between" align="flex-start">
          <Group gap="sm">
            <StrategyBadge
              strategy={(resolvedStrategy || 'basic') as AnalysisStrategy}
              wasAutoSelected={selectedStrategy === 'auto'}
              size="md"
            />
            <Loader2
              size={20}
              className="animate-spin"
              aria-label="Analysis in progress"
              role="status"
            />
            <Title order={3} size="h4">
              Analyzing Transcript
            </Title>
          </Group>
          <Button
            variant="subtle"
            color="red"
            size="sm"
            onClick={onCancel}
            leftSection={<X size={16} />}
            styles={{ root: { minHeight: 36 } }}
          >
            Cancel
          </Button>
        </Group>

        {/* Progress message - aria-live for screen reader announcements */}
        <Text size="sm" c="dimmed" aria-live="polite">
          {progress.message}
        </Text>

        {/* GPT-5.2 Upgrade Notice */}
        <Alert variant="light" color="blue" icon={<Sparkles size={16} />} py="xs" mb="xs">
          <Text size="xs">
            <strong>GPT-5.2 Model:</strong> Enhanced analysis quality. Processing typically takes{' '}
            {getDisplayTimeRange(resolvedStrategy ?? 'basic')} minutes.
          </Text>
        </Alert>

        {/* Progress Bar with Time Estimate */}
        {progress.progress > 0 && (
          <Box>
            <Progress
              value={progress.progress}
              size="md"
              mb="xs"
              animated
              color="blue"
              style={{ transition: 'width 0.3s ease' }}
            />
            <Group justify="space-between">
              <Text size="sm" c="dimmed" fw={500}>
                {progress.progress}% Complete
              </Text>
              {remainingMinutes !== null && (
                <Group gap="xs">
                  <Clock size={14} aria-hidden="true" />
                  <Text size="xs" c="dimmed">
                    Est. {remainingMinutes} min remaining
                  </Text>
                </Group>
              )}
            </Group>
          </Box>
        )}

        {/* Phase Timeline - Strategy-Aware Progress (Hybrid/Advanced Only) */}
        {resolvedStrategy && resolvedStrategy !== 'basic' && progress.progress < 90 && (
          <>
            <Divider />
            <Accordion
              variant="subtle"
              value={phasesExpanded ? 'phases' : null}
              onChange={(value) => onPhasesExpandedChange(value === 'phases')}
            >
              <Accordion.Item value="phases">
                <Accordion.Control>
                  <Text size="sm" fw={600}>Analysis Phases</Text>
                </Accordion.Control>
                <Accordion.Panel>
                  {/* resolvedStrategy is guaranteed non-null and not 'basic' by parent condition */}
                  <PhaseTimeline
                    phases={getStrategyPhases(
                      resolvedStrategy!,
                      template,
                      runEvaluation
                    )}
                    currentProgress={progress.progress}
                    showHeader={false}
                  />
                </Accordion.Panel>
              </Accordion.Item>
            </Accordion>
          </>
        )}

        {/* Saving indicator */}
        {progress.progress >= 90 && progress.progress < 100 && (
          <Group gap="sm" p="md" style={{ backgroundColor: 'var(--aph-highlight-saving)', borderRadius: '8px' }}>
            <Loader2
              size={16}
              className="animate-spin"
              color="var(--aph-blue)"
              aria-label="Saving"
              role="status"
            />
            <Text size="sm" c="dimmed" fw={500}>
              Saving analysis results...
            </Text>
          </Group>
        )}
      </Stack>
    </Card>
  );
}

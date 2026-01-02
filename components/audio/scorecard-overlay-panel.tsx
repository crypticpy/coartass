/**
 * Scorecard Overlay Panel Component
 *
 * Displays detailed RTASS scorecard results in the Interactive Review Mode sidebar.
 * Features:
 * - Overall score header with percentage and status badge
 * - Collapsible accordion sections for each rubric section
 * - Criteria with verdict badges, confidence, rationale, and evidence
 * - Clickable evidence timestamps for audio navigation
 * - Highlights criteria near current playback time
 *
 * Design: Matches the dark command-center aesthetic from interactive-review-mode.tsx
 */

'use client';

import React, { useMemo, useState } from 'react';
import {
  Accordion,
  Badge,
  Text,
  Stack,
  Group,
  ScrollArea,
  Paper,
  Tooltip,
  Box,
} from '@mantine/core';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  AlertCircle,
  Clock,
  Quote,
  ChevronDown,
  EyeOff,
} from 'lucide-react';
import type {
  RtassScorecard,
  RtassScorecardCriterion,
  RtassScorecardSection,
  RtassVerdict,
} from '@/types/rtass';

/**
 * Props for the ScorecardOverlayPanel component
 */
interface ScorecardOverlayPanelProps {
  /** The selected scorecard to display */
  scorecard: RtassScorecard | null;
  /** Callback when user clicks a criterion or evidence */
  onCriterionClick?: (criterion: RtassScorecardCriterion, evidenceIndex?: number) => void;
  /** Current playback time for highlighting relevant criteria */
  currentTime: number;
  /** Additional CSS class name */
  className?: string;
}

/**
 * Time window (in seconds) for highlighting criteria with nearby evidence
 */
const HIGHLIGHT_WINDOW = 5;

/**
 * Maximum characters to show in truncated rationale
 */
const RATIONALE_TRUNCATE_LENGTH = 120;

/**
 * Maximum evidence quotes to display by default
 */
const MAX_VISIBLE_EVIDENCE = 2;

/**
 * Format timestamp as MM:SS
 */
function formatTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Get verdict color based on verdict type
 */
function getVerdictColor(verdict: RtassVerdict): string {
  switch (verdict) {
    case 'met':
      return 'var(--review-green)';
    case 'missed':
      return 'var(--review-red)';
    case 'partial':
      return 'var(--review-amber)';
    case 'not_observed':
      return 'var(--review-text-dim)';
    case 'not_applicable':
      return 'rgba(113, 113, 122, 0.6)';
    default:
      return 'var(--review-text-dim)';
  }
}

/**
 * Get verdict background color for badges
 */
function getVerdictBgColor(verdict: RtassVerdict): string {
  switch (verdict) {
    case 'met':
      return 'rgba(34, 197, 94, 0.15)';
    case 'missed':
      return 'rgba(239, 68, 68, 0.15)';
    case 'partial':
      return 'rgba(245, 158, 11, 0.15)';
    case 'not_observed':
      return 'rgba(113, 113, 122, 0.15)';
    case 'not_applicable':
      return 'rgba(113, 113, 122, 0.1)';
    default:
      return 'rgba(113, 113, 122, 0.15)';
  }
}

/**
 * Get verdict icon component
 */
function getVerdictIcon(verdict: RtassVerdict) {
  switch (verdict) {
    case 'met':
      return <CheckCircle2 size={14} />;
    case 'missed':
      return <XCircle size={14} />;
    case 'partial':
      return <AlertTriangle size={14} />;
    case 'not_observed':
      return <EyeOff size={14} />;
    case 'not_applicable':
      return <AlertCircle size={14} />;
    default:
      return <AlertCircle size={14} />;
  }
}

/**
 * Get status badge color
 */
function getStatusColor(status: 'pass' | 'needs_improvement' | 'fail'): string {
  switch (status) {
    case 'pass':
      return 'var(--review-green)';
    case 'needs_improvement':
      return 'var(--review-amber)';
    case 'fail':
      return 'var(--review-red)';
    default:
      return 'var(--review-text-dim)';
  }
}

/**
 * Get status badge background
 */
function getStatusBgColor(status: 'pass' | 'needs_improvement' | 'fail'): string {
  switch (status) {
    case 'pass':
      return 'rgba(34, 197, 94, 0.15)';
    case 'needs_improvement':
      return 'rgba(245, 158, 11, 0.15)';
    case 'fail':
      return 'rgba(239, 68, 68, 0.15)';
    default:
      return 'rgba(113, 113, 122, 0.15)';
  }
}

/**
 * Format status label for display
 */
function formatStatusLabel(status: 'pass' | 'needs_improvement' | 'fail'): string {
  switch (status) {
    case 'pass':
      return 'Pass';
    case 'needs_improvement':
      return 'Needs Improvement';
    case 'fail':
      return 'Fail';
    default:
      return status;
  }
}

/**
 * Format verdict label for display
 */
function formatVerdictLabel(verdict: RtassVerdict): string {
  switch (verdict) {
    case 'met':
      return 'Met';
    case 'missed':
      return 'Missed';
    case 'partial':
      return 'Partial';
    case 'not_observed':
      return 'Not Observed';
    case 'not_applicable':
      return 'N/A';
    default:
      return verdict;
  }
}

/**
 * Check if a criterion has evidence near the current time
 */
function hasNearbyEvidence(criterion: RtassScorecardCriterion, currentTime: number): boolean {
  return criterion.evidence.some((e) => {
    const evidenceStart = e.start;
    const evidenceEnd = e.end ?? e.start;
    return (
      Math.abs(currentTime - evidenceStart) <= HIGHLIGHT_WINDOW ||
      Math.abs(currentTime - evidenceEnd) <= HIGHLIGHT_WINDOW ||
      (currentTime >= evidenceStart && currentTime <= evidenceEnd)
    );
  });
}

/**
 * Individual criterion display component
 */
function CriterionItem({
  criterion,
  onCriterionClick,
  isHighlighted,
}: {
  criterion: RtassScorecardCriterion;
  onCriterionClick?: (criterion: RtassScorecardCriterion, evidenceIndex?: number) => void;
  isHighlighted: boolean;
}) {
  const [rationaleExpanded, setRationaleExpanded] = useState(false);
  const [evidenceExpanded, setEvidenceExpanded] = useState(false);

  const shouldTruncateRationale = criterion.rationale.length > RATIONALE_TRUNCATE_LENGTH;
  const displayedRationale =
    shouldTruncateRationale && !rationaleExpanded
      ? criterion.rationale.slice(0, RATIONALE_TRUNCATE_LENGTH) + '...'
      : criterion.rationale;

  const visibleEvidence = evidenceExpanded
    ? criterion.evidence
    : criterion.evidence.slice(0, MAX_VISIBLE_EVIDENCE);
  const hasMoreEvidence = criterion.evidence.length > MAX_VISIBLE_EVIDENCE;

  // Check for timing data in observed events
  const hasTimingData = criterion.observedEvents && criterion.observedEvents.length > 0;

  return (
    <Paper
      className="criterion-item"
      style={{
        backgroundColor: isHighlighted
          ? 'rgba(245, 158, 11, 0.1)'
          : 'var(--review-surface-elevated)',
        border: isHighlighted
          ? '1px solid var(--review-amber)'
          : '1px solid var(--review-border)',
        padding: '12px',
        borderRadius: '8px',
        marginBottom: '8px',
        cursor: onCriterionClick ? 'pointer' : 'default',
        transition: 'all 0.2s ease',
      }}
      onClick={() => onCriterionClick?.(criterion)}
    >
      {/* Criterion header */}
      <Group justify="space-between" align="flex-start" mb={8}>
        <Text
          size="sm"
          fw={600}
          style={{ color: 'var(--review-text)', flex: 1 }}
        >
          {criterion.title}
        </Text>
        <Badge
          size="sm"
          variant="light"
          leftSection={getVerdictIcon(criterion.verdict)}
          style={{
            backgroundColor: getVerdictBgColor(criterion.verdict),
            color: getVerdictColor(criterion.verdict),
            border: 'none',
          }}
        >
          {formatVerdictLabel(criterion.verdict)}
        </Badge>
      </Group>

      {/* Confidence */}
      <Text size="xs" style={{ color: 'var(--review-text-dim)', marginBottom: '8px' }}>
        Confidence: {Math.round(criterion.confidence * 100)}%
      </Text>

      {/* Rationale */}
      <Box mb={8}>
        <Text size="xs" style={{ color: 'var(--review-text)', lineHeight: 1.5 }}>
          {displayedRationale}
        </Text>
        {shouldTruncateRationale && (
          <Text
            component="button"
            size="xs"
            style={{
              color: 'var(--review-amber)',
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              marginTop: '4px',
            }}
            onClick={(e) => {
              e.stopPropagation();
              setRationaleExpanded(!rationaleExpanded);
            }}
          >
            {rationaleExpanded ? 'Show less' : 'Show more'}
          </Text>
        )}
      </Box>

      {/* Timing data */}
      {hasTimingData && (
        <Box mb={8}>
          <Group gap={4} mb={4}>
            <Clock size={12} style={{ color: 'var(--review-amber)' }} />
            <Text size="xs" fw={600} style={{ color: 'var(--review-amber)' }}>
              Timing Events
            </Text>
          </Group>
          <Stack gap={4}>
            {criterion.observedEvents?.map((event, idx) => (
              <Group key={idx} gap={8}>
                <Badge
                  size="xs"
                  variant="light"
                  style={{
                    backgroundColor: 'rgba(59, 130, 246, 0.15)',
                    color: 'var(--review-blue)',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onCriterionClick?.(criterion, -1);
                  }}
                >
                  {formatTimestamp(event.at)}
                </Badge>
                <Text size="xs" style={{ color: 'var(--review-text-dim)' }}>
                  {event.name}
                </Text>
              </Group>
            ))}
          </Stack>
        </Box>
      )}

      {/* Evidence quotes */}
      {criterion.evidence.length > 0 && (
        <Box>
          <Group gap={4} mb={8}>
            <Quote size={12} style={{ color: 'var(--review-text-dim)' }} />
            <Text size="xs" fw={600} style={{ color: 'var(--review-text-dim)' }}>
              Evidence ({criterion.evidence.length})
            </Text>
          </Group>
          <Stack gap={6}>
            {visibleEvidence.map((evidence, idx) => (
              <Box
                key={idx}
                style={{
                  backgroundColor: 'rgba(0, 0, 0, 0.2)',
                  borderRadius: '6px',
                  padding: '8px 10px',
                  borderLeft: '3px solid var(--review-border)',
                }}
              >
                <Group justify="space-between" align="flex-start" gap={8}>
                  <Text
                    size="xs"
                    style={{
                      color: 'var(--review-text)',
                      fontStyle: 'italic',
                      flex: 1,
                      lineHeight: 1.4,
                    }}
                  >
                    &quot;{evidence.quote}&quot;
                  </Text>
                  <Tooltip label={`Jump to ${formatTimestamp(evidence.start)}`} withArrow>
                    <Badge
                      size="xs"
                      variant="light"
                      style={{
                        backgroundColor: 'rgba(59, 130, 246, 0.15)',
                        color: 'var(--review-blue)',
                        border: 'none',
                        cursor: 'pointer',
                        flexShrink: 0,
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        onCriterionClick?.(criterion, idx);
                      }}
                    >
                      {formatTimestamp(evidence.start)}
                    </Badge>
                  </Tooltip>
                </Group>
                {evidence.speaker && (
                  <Text
                    size="xs"
                    mt={4}
                    style={{ color: 'var(--review-text-dim)' }}
                  >
                    - {evidence.speaker}
                  </Text>
                )}
              </Box>
            ))}
          </Stack>
          {hasMoreEvidence && (
            <Text
              component="button"
              size="xs"
              style={{
                color: 'var(--review-amber)',
                background: 'none',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                marginTop: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
              onClick={(e) => {
                e.stopPropagation();
                setEvidenceExpanded(!evidenceExpanded);
              }}
            >
              <ChevronDown
                size={12}
                style={{
                  transform: evidenceExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.2s ease',
                }}
              />
              {evidenceExpanded
                ? 'Show less'
                : `Show ${criterion.evidence.length - MAX_VISIBLE_EVIDENCE} more`}
            </Text>
          )}
        </Box>
      )}
    </Paper>
  );
}

/**
 * Section accordion item component
 */
function SectionAccordionItem({
  section,
  onCriterionClick,
  currentTime,
}: {
  section: RtassScorecardSection;
  onCriterionClick?: (criterion: RtassScorecardCriterion, evidenceIndex?: number) => void;
  currentTime: number;
}) {
  return (
    <Accordion.Item value={section.sectionId}>
      <Accordion.Control
        style={{
          backgroundColor: 'var(--review-surface)',
          color: 'var(--review-text)',
          borderRadius: '8px',
          padding: '12px 16px',
        }}
      >
        <Group justify="space-between" align="center" style={{ width: '100%' }}>
          <Box style={{ flex: 1 }}>
            <Text size="sm" fw={600} style={{ color: 'var(--review-text)' }}>
              {section.title}
            </Text>
          </Box>
          <Group gap={8}>
            <Text
              size="sm"
              fw={700}
              style={{ color: getStatusColor(section.status), fontVariantNumeric: 'tabular-nums' }}
            >
              {Math.round(section.score)}%
            </Text>
            <Badge
              size="sm"
              variant="light"
              style={{
                backgroundColor: getStatusBgColor(section.status),
                color: getStatusColor(section.status),
                border: 'none',
              }}
            >
              {formatStatusLabel(section.status)}
            </Badge>
          </Group>
        </Group>
      </Accordion.Control>
      <Accordion.Panel
        style={{
          backgroundColor: 'transparent',
          padding: '12px 0',
        }}
      >
        <Stack gap={0}>
          {section.criteria.map((criterion) => (
            <CriterionItem
              key={criterion.criterionId}
              criterion={criterion}
              onCriterionClick={onCriterionClick}
              isHighlighted={hasNearbyEvidence(criterion, currentTime)}
            />
          ))}
        </Stack>
      </Accordion.Panel>
    </Accordion.Item>
  );
}

/**
 * Scorecard Overlay Panel Component
 *
 * Displays detailed RTASS scorecard results in a sidebar format
 * matching the Interactive Review Mode aesthetic.
 */
export function ScorecardOverlayPanel({
  scorecard,
  onCriterionClick,
  currentTime,
  className,
}: ScorecardOverlayPanelProps) {
  // Determine which sections to expand by default
  const defaultExpandedSections = useMemo(() => {
    if (!scorecard) return [];
    // Expand sections that need improvement or failed
    return scorecard.sections
      .filter((s) => s.status !== 'pass')
      .map((s) => s.sectionId);
  }, [scorecard]);

  if (!scorecard) {
    return (
      <Box
        className={className}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          padding: '24px',
        }}
      >
        <Text size="sm" style={{ color: 'var(--review-text-dim)', textAlign: 'center' }}>
          No scorecard selected. Generate or select a scorecard to view detailed results.
        </Text>
      </Box>
    );
  }

  return (
    <Box
      className={className}
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      {/* Panel styles */}
      <style jsx global>{`
        .scorecard-overlay-panel {
          --review-bg: #0a0a0b;
          --review-surface: #141416;
          --review-surface-elevated: #1c1c1f;
          --review-border: #2a2a2e;
          --review-text: #f5f5f4;
          --review-text-dim: #71717a;
          --review-amber: #f59e0b;
          --review-amber-glow: rgba(245, 158, 11, 0.15);
          --review-red: #ef4444;
          --review-green: #22c55e;
          --review-blue: #3b82f6;
        }

        .scorecard-overlay-panel .mantine-Accordion-control {
          background-color: var(--review-surface) !important;
          border: 1px solid var(--review-border) !important;
        }

        .scorecard-overlay-panel .mantine-Accordion-control:hover {
          background-color: var(--review-surface-elevated) !important;
        }

        .scorecard-overlay-panel .mantine-Accordion-chevron {
          color: var(--review-text-dim) !important;
        }

        .scorecard-overlay-panel .mantine-Accordion-item {
          border: none !important;
          margin-bottom: 8px;
        }

        .scorecard-overlay-panel .mantine-Accordion-panel {
          background: transparent !important;
        }

        .scorecard-overlay-panel .mantine-ScrollArea-scrollbar {
          background: var(--review-surface) !important;
        }

        .scorecard-overlay-panel .mantine-ScrollArea-thumb {
          background: var(--review-border) !important;
        }

        .scorecard-overlay-panel .mantine-ScrollArea-thumb:hover {
          background: var(--review-text-dim) !important;
        }
      `}</style>

      {/* Section header */}
      <Box
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid var(--review-border)',
          background: 'var(--review-surface)',
        }}
      >
        <Text
          size="xs"
          fw={600}
          style={{
            color: 'var(--review-text-dim)',
            textTransform: 'uppercase',
            letterSpacing: '0.15em',
          }}
        >
          Scorecard Results
        </Text>
      </Box>

      {/* Sections accordion */}
      <ScrollArea
        style={{ flex: 1 }}
        scrollbarSize={8}
      >
        <Box p="md" className="scorecard-overlay-panel">
          <Accordion
            multiple
            defaultValue={defaultExpandedSections}
            styles={{
              root: {
                backgroundColor: 'transparent',
              },
            }}
          >
            {scorecard.sections.map((section) => (
              <SectionAccordionItem
                key={section.sectionId}
                section={section}
                onCriterionClick={onCriterionClick}
                currentTime={currentTime}
              />
            ))}
          </Accordion>
        </Box>
      </ScrollArea>

    </Box>
  );
}

export default ScorecardOverlayPanel;

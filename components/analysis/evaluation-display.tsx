/**
 * Evaluation Display Component
 *
 * Displays the results of the self-evaluation pass, including:
 * - Quality score with color-coded indicator
 * - Improvements and additions made
 * - Warnings and reasoning
 * - Orphaned items detection
 * - Toggle to view draft vs final results
 *
 * Features:
 * - Collapsible sections using Mantine Accordion
 * - Color-coded quality indicators
 * - Responsive design
 * - Austin Public Health theme colors
 */

"use client";

import React from "react";
import {
  Paper,
  Stack,
  Group,
  Text,
  Badge,
  Alert,
  Accordion,
  Switch,
  Box,
  Title,
  ThemeIcon,
  List,
  Grid,
} from "@mantine/core";
import {
  Sparkles,
  TrendingUp,
  Plus,
  AlertTriangle,
  MessageSquare,
  CheckCircle2,
  Eye,
} from "lucide-react";
import type { EvaluationResults, AnalysisResults } from "@/types";

/**
 * Props for EvaluationDisplay component
 */
export interface EvaluationDisplayProps {
  /** Evaluation results metadata */
  evaluation: EvaluationResults;

  /** Draft results before evaluation */
  draftResults: AnalysisResults;

  /** Final results after evaluation */
  finalResults: AnalysisResults;

  /** Current view mode */
  currentView: "draft" | "final";

  /** Callback when view changes */
  onViewChange: (view: "draft" | "final") => void;

  /** Optional: Disable controls */
  disabled?: boolean;
}

/**
 * Calculate statistics for comparison
 */
function calculateStats(results: AnalysisResults): {
  sections: number;
  benchmarks: number;
  radioReports: number;
  safetyEvents: number;
  evidence: number;
} {
  return {
    sections: results.sections.length,
    benchmarks: results.benchmarks?.length || 0,
    radioReports: results.radioReports?.length || 0,
    safetyEvents: results.safetyEvents?.length || 0,
    evidence: results.sections.reduce((sum, s) => sum + (s.evidence?.length || 0), 0),
  };
}

/**
 * Evaluation Display Component
 *
 * Shows evaluation results with collapsible sections and draft/final comparison.
 */
export function EvaluationDisplay({
  evaluation,
  draftResults,
  finalResults,
  currentView,
  onViewChange,
  disabled = false,
}: EvaluationDisplayProps) {
  const draftStats = calculateStats(draftResults);
  const finalStats = calculateStats(finalResults);

  // Calculate differences
  const statsDiff = {
    benchmarks: finalStats.benchmarks - draftStats.benchmarks,
    radioReports: finalStats.radioReports - draftStats.radioReports,
    safetyEvents: finalStats.safetyEvents - draftStats.safetyEvents,
    evidence: finalStats.evidence - draftStats.evidence,
  };

  return (
    <Paper p="lg" radius="md" withBorder shadow="sm">
      <Stack gap="lg">
        {/* Header */}
        <Box>
          <Group gap="xs" mb="xs">
            <Sparkles size={20} style={{ color: "var(--mantine-color-aphGreen-6)" }} />
            <Title order={3} size="lg">
              Self-Evaluation Results
            </Title>
          </Group>
          <Text size="sm" c="dimmed">
            The AI reviewed and improved the analysis. View the changes and quality assessment
            below.
          </Text>
        </Box>

        {/* Draft vs Final Toggle */}
        <Paper p="md" radius="md" withBorder>
          <Group justify="space-between" align="center">
            <Group gap="xs">
              <Eye size={18} style={{ color: "var(--mantine-color-gray-6)" }} />
              <Text fw={600} size="md">
                View Results
              </Text>
            </Group>

            <Switch
              id="view-results-toggle"
              checked={currentView === "final"}
              onChange={(event) =>
                onViewChange(event.currentTarget.checked ? "final" : "draft")
              }
              disabled={disabled}
              size="md"
              onLabel="Final"
              offLabel="Draft"
              color="aphGreen"
              aria-label="Toggle between draft and final results view"
              aria-describedby="view-results-description"
              styles={{
                track: {
                  cursor: disabled ? "not-allowed" : "pointer",
                },
              }}
            />
          </Group>

          <Text id="view-results-description" size="xs" c="dimmed" mt="xs">
            Toggle to compare draft results before evaluation with final improved results
          </Text>

          {/* Stats Comparison */}
          <Grid mt="md" gutter="xs">
            <Grid.Col span={6}>
              <Box
                p="xs"
                style={{
                  backgroundColor:
                    currentView === "draft"
                      ? "var(--mantine-color-gray-1)"
                      : "var(--mantine-color-gray-0)",
                  borderRadius: "var(--mantine-radius-sm)",
                }}
              >
                <Text size="xs" c="dimmed" mb={4}>
                  Draft
                </Text>
                <Group gap={4} wrap="wrap">
                  <Badge size="xs" variant="dot" color="gray">
                    {draftStats.sections} sections
                  </Badge>
                  <Badge size="xs" variant="dot" color="gray">
                    {draftStats.benchmarks} benchmarks
                  </Badge>
                  <Badge size="xs" variant="dot" color="gray">
                    {draftStats.radioReports} reports
                  </Badge>
                  <Badge size="xs" variant="dot" color="gray">
                    {draftStats.safetyEvents} safety
                  </Badge>
                </Group>
              </Box>
            </Grid.Col>

            <Grid.Col span={6}>
              <Box
                p="xs"
                style={{
                  backgroundColor:
                    currentView === "final"
                      ? "var(--mantine-color-aphGreen-0)"
                      : "var(--mantine-color-gray-0)",
                  borderRadius: "var(--mantine-radius-sm)",
                }}
              >
                <Text size="xs" c="dimmed" mb={4}>
                  Final
                </Text>
                <Group gap={4} wrap="wrap">
                  <Group gap={4} wrap="nowrap">
                    <Badge size="xs" variant="dot" color="aphGreen">
                      {finalStats.sections} sections
                    </Badge>
                  </Group>
                  <Group gap={4} wrap="nowrap">
                    <Badge size="xs" variant="dot" color="aphGreen">
                      {finalStats.benchmarks} benchmarks
                    </Badge>
                    {statsDiff.benchmarks > 0 && (
                      <Text size="xs" c="aphGreen" fw={600}>
                        (+{statsDiff.benchmarks})
                      </Text>
                    )}
                  </Group>
                  <Group gap={4} wrap="nowrap">
                    <Badge size="xs" variant="dot" color="aphGreen">
                      {finalStats.radioReports} reports
                    </Badge>
                    {statsDiff.radioReports > 0 && (
                      <Text size="xs" c="aphGreen" fw={600}>
                        (+{statsDiff.radioReports})
                      </Text>
                    )}
                  </Group>
                  <Group gap={4} wrap="nowrap">
                    <Badge size="xs" variant="dot" color="aphGreen">
                      {finalStats.safetyEvents} safety
                    </Badge>
                    {statsDiff.safetyEvents > 0 && (
                      <Text size="xs" c="aphGreen" fw={600}>
                        (+{statsDiff.safetyEvents})
                      </Text>
                    )}
                  </Group>
                </Group>
              </Box>
            </Grid.Col>
          </Grid>
        </Paper>

        {/* Detailed Information - Accordion */}
        <Accordion variant="separated" radius="md" multiple>
          {/* Improvements */}
          {evaluation.improvements.length > 0 && (
            <Accordion.Item value="improvements">
              <Accordion.Control
                icon={
                  <ThemeIcon size="sm" radius="xl" variant="light" color="aphCyan">
                    <TrendingUp size={16} />
                  </ThemeIcon>
                }
              >
                <Group gap="xs">
                  <Text fw={600}>Improvements Made</Text>
                  <Badge size="sm" variant="light" color="aphCyan" radius="xl">
                    {evaluation.improvements.length}
                  </Badge>
                </Group>
              </Accordion.Control>
              <Accordion.Panel>
                <List spacing="sm" size="sm" icon={<CheckCircle2 size={16} color="var(--mantine-color-aphCyan-6)" />}>
                  {evaluation.improvements.map((improvement, idx) => (
                    <List.Item key={idx}>
                      <Text size="sm" style={{ lineHeight: 1.6 }}>
                        {improvement}
                      </Text>
                    </List.Item>
                  ))}
                </List>
              </Accordion.Panel>
            </Accordion.Item>
          )}

          {/* Additions */}
          {evaluation.additions.length > 0 && (
            <Accordion.Item value="additions">
              <Accordion.Control
                icon={
                  <ThemeIcon size="sm" radius="xl" variant="light" color="aphGreen">
                    <Plus size={16} />
                  </ThemeIcon>
                }
              >
                <Group gap="xs">
                  <Text fw={600}>Additions Made</Text>
                  <Badge size="sm" variant="light" color="aphGreen" radius="xl">
                    {evaluation.additions.length}
                  </Badge>
                </Group>
              </Accordion.Control>
              <Accordion.Panel>
                <List spacing="sm" size="sm" icon={<Plus size={16} color="var(--mantine-color-aphGreen-6)" />}>
                  {evaluation.additions.map((addition, idx) => (
                    <List.Item key={idx}>
                      <Text size="sm" style={{ lineHeight: 1.6 }}>
                        {addition}
                      </Text>
                    </List.Item>
                  ))}
                </List>
              </Accordion.Panel>
            </Accordion.Item>
          )}

          {/* Reasoning */}
          <Accordion.Item value="reasoning">
            <Accordion.Control
              icon={
                <ThemeIcon size="sm" radius="xl" variant="light" color="aphBlue">
                  <MessageSquare size={16} />
                </ThemeIcon>
              }
            >
              <Text fw={600}>Evaluation Reasoning</Text>
            </Accordion.Control>
            <Accordion.Panel>
              <Paper p="md" radius="md" style={{ backgroundColor: "var(--mantine-color-gray-0)" }}>
                <Text size="sm" style={{ lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
                  {evaluation.reasoning}
                </Text>
              </Paper>
            </Accordion.Panel>
          </Accordion.Item>

          {/* Warnings */}
          {evaluation.warnings && evaluation.warnings.length > 0 && (
            <Accordion.Item value="warnings">
              <Accordion.Control
                icon={
                  <ThemeIcon size="sm" radius="xl" variant="light" color="aphOrange">
                    <AlertTriangle size={16} />
                  </ThemeIcon>
                }
              >
                <Group gap="xs">
                  <Text fw={600}>Warnings</Text>
                  <Badge size="sm" variant="light" color="aphOrange" radius="xl">
                    {evaluation.warnings.length}
                  </Badge>
                </Group>
              </Accordion.Control>
              <Accordion.Panel>
                <Stack gap="sm">
                  {evaluation.warnings.map((warning, idx) => (
                    <Alert
                      key={idx}
                      icon={<AlertTriangle size={16} />}
                      color="aphOrange"
                      variant="light"
                      radius="md"
                    >
                      <Text size="sm">{warning}</Text>
                    </Alert>
                  ))}
                </Stack>
              </Accordion.Panel>
            </Accordion.Item>
          )}

        </Accordion>

        {/* Summary Footer */}
        <Alert icon={<Sparkles size={16} />} color="aphGreen" variant="light">
          <Text size="xs" c="dimmed">
            Self-evaluation completed successfully. The final results have been refined based on
            quality checks across completeness, accuracy, consistency, clarity, evidence quality,
            and relationship integrity.
          </Text>
        </Alert>
      </Stack>
    </Paper>
  );
}

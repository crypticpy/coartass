/**
 * Analysis Viewer Component
 *
 * Main component for displaying complete analysis results including:
 * - Summary
 * - Sections with evidence
 * - Benchmarks & milestones
 * - Radio reports (incl. CAN)
 * - Safety & accountability events
 * - Export functionality
 */

"use client";

import React, { useState } from "react";
import {
  FileText,
  Download,
  Share2,
  Lightbulb,
  Copy,
  Check,
  Trash2,
} from "lucide-react";
import {
  Paper,
  Button,
  Badge,
  Divider,
  Tabs,
  Alert,
  Text,
  Group,
  Tooltip,
  Stack,
  Box,
  Flex,
  Title,
  Table,
  List,
} from "@mantine/core";
import { modals } from "@mantine/modals";
import { SectionDisplay } from "./section-display";
import { buildAnalysisSummaryText, normalizeEvidence, stripTimestamps } from "@/lib/analysis-utils";
import { formatTimestamp } from "@/lib/transcript-utils";
import type { Analysis } from "@/types/analysis";
import type { Template } from "@/types/template";

/**
 * Format date for display
 */
function formatDate(date: Date | string | number): string {
  try {
    const d = new Date(date);
    // Check if date is valid
    if (isNaN(d.getTime())) {
      return "Invalid Date";
    }

    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(d);
  } catch (e) {
    console.error("Error formatting date:", e);
    return "Date Unavailable";
  }
}

/**
 * Parse summary text into intro paragraph and bullet points
 */
function parseSummary(summaryText: string): {
  intro: string;
  bullets: string[];
} {
  // Split by lines
  const lines = summaryText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  // Find where bullets start (look for "Key Takeaways:" or first bullet point)
  const bulletStartIndex = lines.findIndex(
    (line) =>
      line.toLowerCase().includes("key takeaways") ||
      line.startsWith("-") ||
      line.startsWith("•") ||
      line.startsWith("*")
  );

  if (bulletStartIndex === -1) {
    // No bullets found, treat entire text as intro
    return {
      intro: summaryText,
      bullets: [],
    };
  }

  // Collect intro paragraphs (before bullets)
  const introParts: string[] = [];
  for (let i = 0; i < bulletStartIndex; i++) {
    const line = lines[i];
    if (!line.toLowerCase().includes("key takeaways")) {
      introParts.push(line);
    }
  }

  // Collect bullets (after intro)
  const bullets: string[] = [];
  for (let i = bulletStartIndex; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith("-") || line.startsWith("•") || line.startsWith("*")) {
      // Remove bullet character and trim
      const bulletText = line.replace(/^[-•*]\s*/, "").trim();
      if (bulletText) {
        bullets.push(bulletText);
      }
    } else if (!line.toLowerCase().includes("key takeaways")) {
      // If it's not a bullet or the heading, add it to bullets as plain text
      if (line && bullets.length > 0) {
        // Append to last bullet if it seems like a continuation
        bullets[bullets.length - 1] += " " + line;
      } else if (line) {
        introParts.push(line);
      }
    }
  }

  return {
    intro: introParts.join(" "),
    bullets,
  };
}

export interface AnalysisViewerProps {
  /** The analysis to display */
  analysis: Analysis;

  /** Optional template for additional context */
  template?: Template;

  /** Optional callback to (re)generate supporting evidence for this analysis */
  onGenerateEvidence?: () => void | Promise<void>;

  /** Whether supporting evidence generation is in progress */
  isGeneratingEvidence?: boolean;

  /** Optional callback when timestamp is clicked */
  onTimestampClick?: (timestamp: number) => void;

  /** Optional callback for export */
  onExport?: () => void;

  /** Optional callback for share */
  onShare?: () => void;

  /** Optional callback for deleting this analysis */
  onDelete?: () => void | Promise<void>;

  /** Whether delete is in progress */
  isDeleting?: boolean;

  /** Whether to show draft results instead of final results */
  showDraftResults?: boolean;
}

/**
 * Analysis Viewer component displaying complete analysis results with
 * sections, evidence, benchmarks, radio reports, and safety events.
 */
export function AnalysisViewer({
  analysis,
  template,
  onGenerateEvidence,
  isGeneratingEvidence = false,
  onTimestampClick,
  onExport,
  onShare,
  onDelete,
  isDeleting = false,
  showDraftResults = false,
}: AnalysisViewerProps) {
  const [copied, setCopied] = useState(false);

  // Handle delete with confirmation
  const handleDeleteClick = () => {
    modals.openConfirmModal({
      title: 'Delete Analysis',
      centered: true,
      children: (
        <Stack gap="sm">
          <Text size="sm">
            Are you sure you want to delete this analysis?
          </Text>
          <Text size="sm" c="dimmed">
            {template ? `Template: ${template.name}` : 'Unknown template'}
          </Text>
          <Text size="sm" c="dimmed">
            Created: {formatDate(analysis.createdAt)}
          </Text>
          <Alert color="red" variant="light" mt="sm">
            <Text size="sm" fw={500}>
              This action cannot be undone. The analysis results will be permanently deleted.
            </Text>
          </Alert>
        </Stack>
      ),
      labels: { confirm: 'Delete Analysis', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: () => onDelete?.(),
    });
  };

  // Use draft results if requested and available, otherwise use final results
  const results = showDraftResults && analysis.draftResults
    ? analysis.draftResults
    : analysis.results;
  const hasBenchmarks = results.benchmarks && results.benchmarks.length > 0;
  const hasRadioReports = results.radioReports && results.radioReports.length > 0;
  const hasSafetyEvents = results.safetyEvents && results.safetyEvents.length > 0;
  const hasSummary = !!results.summary;

  // Calculate statistics
  const totalSections = results.sections.length;
  const totalEvidence = results.sections.reduce(
    (sum, section) => sum + normalizeEvidence(section.evidence).length,
    0
  );
  const citationsEnabled = process.env.NEXT_PUBLIC_CITATIONS_ENABLED !== "false";

  // Handle copy full analysis to clipboard
  const handleCopyAnalysis = async () => {
    try {
      const summaryText = buildAnalysisSummaryText(analysis, template);
      await navigator.clipboard.writeText(summaryText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy analysis:", error);
    }
  };

  return (
    <Stack gap="xl">
      {/* Header Card */}
      <Paper p="xl" radius="md" withBorder shadow="sm">
        <Stack gap="md">
          <Flex align="flex-start" justify="space-between" gap="md">
            <Box flex={1}>
              <Stack gap="xs">
                <Group gap="xs">
                  <FileText size={20} style={{ color: 'var(--logo-blue)' }} />
                  <Title order={2} size="xl">
                    Analysis Results
                  </Title>
                </Group>

                <Group gap="sm">
                  {template && (
                    <>
                      <Text size="sm" fw={500}>
                        Template: {template.name}
                      </Text>
                      <Text size="sm" c="dimmed">•</Text>
                    </>
                  )}
                  <Text size="sm" c="dimmed">{formatDate(analysis.createdAt)}</Text>
                </Group>

                <Group gap="xs" mt="sm">
                  <Badge variant="light" size="sm" radius="sm">
                    {totalSections} {totalSections === 1 ? "section" : "sections"}
                  </Badge>
                  {analysis.analysisStrategy === "advanced" && (
                    <Tooltip
                      label={
                        totalEvidence > 0
                          ? "Supporting evidence extracted from the transcript"
                          : citationsEnabled
                            ? "No supporting evidence is available yet (none found or not generated)"
                            : "Supporting evidence is disabled"
                      }
                      withArrow
                      withinPortal
                    >
                      <Badge
                        variant="light"
                        size="sm"
                        radius="sm"
                        color={totalEvidence > 0 ? "blue" : "gray"}
                      >
                        {totalEvidence > 0
                          ? `${totalEvidence} ${totalEvidence === 1 ? "citation" : "citations"}`
                          : "No citations"}
                      </Badge>
                    </Tooltip>
                  )}
                  {analysis.analysisStrategy === "advanced" &&
                    citationsEnabled &&
                    totalEvidence === 0 &&
                    onGenerateEvidence && (
                      <Button
                        variant="subtle"
                        size="xs"
                        loading={isGeneratingEvidence}
                        onClick={onGenerateEvidence}
                      >
                        Generate evidence
                      </Button>
                    )}
                  {hasBenchmarks && (
                    <Badge variant="light" size="sm" radius="sm" color="teal">
                      {results.benchmarks?.length} benchmarks
                    </Badge>
                  )}
                  {hasRadioReports && (
                    <Badge variant="light" size="sm" radius="sm" color="blue">
                      {results.radioReports?.length} reports
                    </Badge>
                  )}
                  {hasSafetyEvents && (
                    <Badge variant="light" size="sm" radius="sm" color="red">
                      {results.safetyEvents?.length} safety events
                    </Badge>
                  )}
                </Group>
              </Stack>
            </Box>

            {/* Actions */}
            <Group gap="xs">
              <Tooltip
                label={copied ? "Copied!" : "Copy formatted analysis"}
                withArrow
              >
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleCopyAnalysis}
                  leftSection={
                    copied ? (
                      <Check size={16} style={{ color: 'var(--compliant-green)' }} />
                    ) : (
                      <Copy size={16} />
                    )
                  }
                >
                  <Text size="sm" component="span" visibleFrom="sm">
                    {copied ? "Copied" : "Copy"}
                  </Text>
                </Button>
              </Tooltip>

              {onShare && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={onShare}
                  leftSection={<Share2 size={16} />}
                >
                  <Text size="sm" component="span" visibleFrom="sm">Share</Text>
                </Button>
              )}
              {onExport && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={onExport}
                  leftSection={<Download size={16} />}
                >
                  <Text size="sm" component="span" visibleFrom="sm">Export</Text>
                </Button>
              )}
              {onDelete && (
                <Tooltip label="Delete this analysis" withArrow>
                  <Button
                    variant="light"
                    size="sm"
                    color="red"
                    onClick={handleDeleteClick}
                    loading={isDeleting}
                    leftSection={<Trash2 size={16} aria-hidden="true" />}
                    aria-label="Delete this analysis"
                  >
                    <Text size="sm" component="span" visibleFrom="sm">Delete</Text>
                  </Button>
                </Tooltip>
              )}
            </Group>
          </Flex>

          {/* Summary Section */}
          {hasSummary &&
            (() => {
              const { intro, bullets } = parseSummary(results.summary || "");
              // Strip timestamps from executive summary for clean copy/paste
              // (timestamps remain in detailed sections and action items)
              const cleanIntro = stripTimestamps(intro);
              const cleanBullets = bullets.map(stripTimestamps);
              return (
                <>
                  <Divider my="md" />
                  <Box pt="sm">
                    <Paper p="lg" radius="md" withBorder style={{ backgroundColor: 'var(--mantine-color-default)' }}>
                      <Group gap="xs" mb="sm">
                        <Lightbulb size={16} style={{ color: 'var(--aph-yellow)' }} />
                        <Title order={3} size="sm">
                          Executive Summary
                        </Title>
                      </Group>
                      <Stack gap="md">
                        {/* Intro Paragraph */}
                        {cleanIntro && (
                          <Text size="md" c="dimmed" style={{ lineHeight: 1.75 }}>
                            {cleanIntro}
                          </Text>
                        )}

                        {/* Key Takeaways Bullets */}
                        {cleanBullets.length > 0 && (
                          <Box>
                            <Text size="xs" fw={600} tt="uppercase" c="dimmed" mb="sm">
                              Key Takeaways
                            </Text>
                            <Stack gap="sm">
                              {cleanBullets.map((bullet, idx) => (
                                <Flex key={idx} gap="sm" align="flex-start">
                                  <Box
                                    mt={6}
                                    style={{
                                      width: 6,
                                      height: 6,
                                      borderRadius: '50%',
                                      backgroundColor: 'var(--logo-blue)',
                                      flexShrink: 0
                                    }}
                                  />
                                  <Text size="md" c="dimmed" style={{ flex: 1, lineHeight: 1.75 }}>
                                    {bullet}
                                  </Text>
                                </Flex>
                              ))}
                            </Stack>
                          </Box>
                        )}

                        {/* Fallback if parsing fails */}
                        {!cleanIntro && cleanBullets.length === 0 && (
                          <Text size="md" c="dimmed" style={{ lineHeight: 1.75 }}>
                            {stripTimestamps(results.summary || "")}
                          </Text>
                        )}
                      </Stack>
                    </Paper>
                  </Box>
                </>
              );
            })()}
        </Stack>
      </Paper>

      {/* Main Content Tabs */}
      <Tabs defaultValue="sections" variant="outline" radius="md">
        <Tabs.List>
          <Tabs.Tab value="sections">Sections</Tabs.Tab>
          <Tabs.Tab value="benchmarks" disabled={!hasBenchmarks}>
            Benchmarks
            {hasBenchmarks && (
              <Badge size="xs" variant="light" ml="xs" radius="xl">
                {results.benchmarks?.length}
              </Badge>
            )}
          </Tabs.Tab>
          <Tabs.Tab value="radio" disabled={!hasRadioReports}>
            Radio Reports
            {hasRadioReports && (
              <Badge size="xs" variant="light" ml="xs" radius="xl">
                {results.radioReports?.length}
              </Badge>
            )}
          </Tabs.Tab>
          <Tabs.Tab value="safety" disabled={!hasSafetyEvents}>
            Safety
            {hasSafetyEvents && (
              <Badge size="xs" variant="light" ml="xs" radius="xl">
                {results.safetyEvents?.length}
              </Badge>
            )}
          </Tabs.Tab>
        </Tabs.List>

        {/* Sections Tab */}
        <Tabs.Panel value="sections" mt="lg">
          <Stack gap="xl">
            {results.sections.map((section, idx) => (
              <SectionDisplay
                key={idx}
                section={section}
                onTimestampClick={onTimestampClick}
                variant={idx % 2 === 0 ? "default" : "secondary"}
                showEvidence={analysis.analysisStrategy === 'advanced'}
              />
            ))}
          </Stack>
        </Tabs.Panel>

        {hasBenchmarks && (
          <Tabs.Panel value="benchmarks" mt="lg">
            <Table withColumnBorders striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Benchmark</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th>Timestamp</Table.Th>
                  <Table.Th>Unit/Role</Table.Th>
                  <Table.Th>Evidence</Table.Th>
                  <Table.Th>Notes</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {results.benchmarks?.map((b) => (
                  <Table.Tr key={b.id}>
                    <Table.Td>{b.benchmark}</Table.Td>
                    <Table.Td>
                      <Badge
                        color={
                          b.status === "met"
                            ? "green"
                            : b.status === "missed"
                              ? "red"
                              : "gray"
                        }
                        variant="light"
                      >
                        {b.status.replace("_", " ")}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      {b.timestamp !== undefined ? formatTimestamp(b.timestamp) : "-"}
                    </Table.Td>
                    <Table.Td>{b.unitOrRole || "-"}</Table.Td>
                    <Table.Td>{b.evidenceQuote || "-"}</Table.Td>
                    <Table.Td>{b.notes || "-"}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Tabs.Panel>
        )}

        {hasRadioReports && (
          <Tabs.Panel value="radio" mt="lg">
            <Stack gap="sm">
              {results.radioReports?.map((r) => (
                <Paper key={r.id} withBorder p="md" radius="md">
                  <Group justify="space-between" align="flex-start">
                    <Stack gap={4}>
                      <Group gap="xs">
                        <Badge color="blue" variant="light">
                          {r.type.replace(/_/g, " ")}
                        </Badge>
                        <Text size="sm" c="dimmed">
                          {formatTimestamp(r.timestamp)}
                        </Text>
                      </Group>
                      <Text fw={600}>{r.from || "Unknown unit"}</Text>
                      {r.fields && Object.keys(r.fields).length > 0 && (
                        <List size="sm" c="dimmed" spacing={2}>
                          {Object.entries(r.fields).map(([key, value]) => (
                            <List.Item key={key}>
                              <Text span fw={600}>{`${key}: `}</Text>
                              <Text span>{String(value)}</Text>
                            </List.Item>
                          ))}
                        </List>
                      )}
                      {r.evidenceQuote && (
                        <Text size="sm" c="dimmed">
                          “{r.evidenceQuote}”
                        </Text>
                      )}
                    </Stack>
                    {r.missingRequired && r.missingRequired.length > 0 && (
                      <Badge color="orange" variant="light">
                        Missing: {r.missingRequired.join(", ")}
                      </Badge>
                    )}
                  </Group>
                </Paper>
              ))}
            </Stack>
          </Tabs.Panel>
        )}

        {hasSafetyEvents && (
          <Tabs.Panel value="safety" mt="lg">
            <Stack gap="sm">
              {results.safetyEvents?.map((e) => (
                <Paper key={e.id} withBorder p="md" radius="md">
                  <Group gap="xs" align="center">
                    <Badge
                      color={
                        e.severity === "critical"
                          ? "red"
                          : e.severity === "warning"
                            ? "orange"
                            : "gray"
                      }
                      variant="light"
                    >
                      {e.type.replace(/_/g, " ")}
                    </Badge>
                    <Text size="sm" c="dimmed">
                      {formatTimestamp(e.timestamp)}
                    </Text>
                    <Text size="sm" fw={600}>
                      {e.unitOrRole || "Unknown unit"}
                    </Text>
                  </Group>
                  <Text size="sm" mt={4}>
                    {e.details}
                  </Text>
                  {e.evidenceQuote && (
                    <Text size="sm" c="dimmed" mt={4}>
                      “{e.evidenceQuote}”
                    </Text>
                  )}
                </Paper>
              ))}
            </Stack>
          </Tabs.Panel>
        )}

      </Tabs>
    </Stack>
  );
}

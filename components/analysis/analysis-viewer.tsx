/**
 * Analysis Viewer Component
 *
 * Main component for displaying complete analysis results including:
 * - Summary
 * - Sections with evidence
 * - Action items
 * - Decisions timeline
 * - Quotes carousel
 * - Export functionality
 */

"use client";

import React, { useState } from "react";
import {
  FileText,
  Download,
  Share2,
  Clock,
  Quote,
  CheckCircle2,
  Lightbulb,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
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
  Grid,
  VisuallyHidden,
} from "@mantine/core";
import { modals } from "@mantine/modals";
import { SectionDisplay } from "./section-display";
import { ActionItemsList } from "./action-items-list";
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
 * sections, evidence, action items, decisions, and quotes.
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
  const [currentQuoteIndex, setCurrentQuoteIndex] = useState(0);
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
  const hasActionItems = results.actionItems && results.actionItems.length > 0;
  const hasDecisions = results.decisions && results.decisions.length > 0;
  const hasQuotes = results.quotes && results.quotes.length > 0;
  const hasSummary = !!results.summary;

  // Calculate statistics
  const totalSections = results.sections.length;
  const totalEvidence = results.sections.reduce(
    (sum, section) => sum + normalizeEvidence(section.evidence).length,
    0
  );
  const citationsEnabled = process.env.NEXT_PUBLIC_CITATIONS_ENABLED !== "false";

  // Navigate quotes carousel
  const nextQuote = () => {
    if (results.quotes && results.quotes.length > 0) {
      setCurrentQuoteIndex((prev) => (prev + 1) % results.quotes!.length);
    }
  };

  const prevQuote = () => {
    if (results.quotes && results.quotes.length > 0) {
      setCurrentQuoteIndex((prev) =>
        prev === 0 ? results.quotes!.length - 1 : prev - 1
      );
    }
  };

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
                  {hasActionItems && (
                    <Badge variant="light" size="sm" radius="sm" color="green">
                      {results.actionItems?.length} action{" "}
                      {results.actionItems?.length === 1 ? "item" : "items"}
                    </Badge>
                  )}
                  {hasDecisions && (
                    <Badge variant="light" size="sm" radius="sm" color="orange">
                      {results.decisions?.length}{" "}
                      {results.decisions?.length === 1 ? "decision" : "decisions"}
                    </Badge>
                  )}
                  {hasQuotes && (
                    <Badge variant="light" size="sm" radius="sm" color="violet">
                      {results.quotes?.length}{" "}
                      {results.quotes?.length === 1 ? "quote" : "quotes"}
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
          <Tabs.Tab value="actions" disabled={!hasActionItems}>
            Action Items
            {hasActionItems && (
              <Badge size="xs" variant="light" ml="xs" radius="xl">
                {results.actionItems?.length}
              </Badge>
            )}
          </Tabs.Tab>
          <Tabs.Tab value="decisions" disabled={!hasDecisions}>
            Decisions
            {hasDecisions && (
              <Badge size="xs" variant="light" ml="xs" radius="xl">
                {results.decisions?.length}
              </Badge>
            )}
          </Tabs.Tab>
          <Tabs.Tab value="quotes" disabled={!hasQuotes}>
            Quotes
            {hasQuotes && (
              <Badge size="xs" variant="light" ml="xs" radius="xl">
                {results.quotes?.length}
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

        {/* Action Items Tab */}
        <Tabs.Panel value="actions" mt="lg">
          {hasActionItems ? (
            <ActionItemsList
              actionItems={results.actionItems!}
              onTimestampClick={onTimestampClick}
              variant="table"
              showHeader={false}
            />
          ) : (
            <Alert
              icon={<AlertCircle size={16} />}
              title="No Action Items"
              color="gray"
              variant="light"
            >
              No action items were detected in this analysis.
            </Alert>
          )}
        </Tabs.Panel>

        {/* Decisions Tab */}
        <Tabs.Panel value="decisions" mt="lg">
          {hasDecisions ? (
            <Paper p="xl" radius="md" withBorder shadow="sm">
              <Stack gap="md" mb="xl">
                <Group gap="xs">
                  <CheckCircle2 size={20} style={{ color: 'var(--compliant-green)' }} />
                  <Title order={3} size="lg">
                    Decisions Timeline
                  </Title>
                </Group>
                <Text size="sm" c="dimmed">
                  Key decisions made during the discussion, ordered
                  chronologically.
                </Text>
              </Stack>
              <Box>
                <Stack gap="xl" pl="xs">
                  {results.decisions!.map((decision, idx) => (
                    <Box
                      key={idx}
                      pl="xl"
                      pb="xs"
                      style={{
                        position: 'relative',
                        borderLeft: idx < results.decisions!.length - 1 ? `2px solid var(--mantine-color-blue-2)` : 'none'
                      }}
                    >
                      {/* Timeline dot */}
                      <Box
                        style={{
                          position: 'absolute',
                          left: -9,
                          top: 6,
                          width: 16,
                          height: 16,
                          borderRadius: '50%',
                          backgroundColor: 'var(--mantine-color-body)',
                          border: `4px solid var(--compliant-green)`,
                          boxShadow: 'var(--mantine-shadow-sm)'
                        }}
                      />

                      {/* Content */}
                      <Stack gap="xs">
                        {/* Timestamp */}
                        <Button
                          variant="light"
                          size="xs"
                          radius="xl"
                          onClick={() =>
                            onTimestampClick &&
                            onTimestampClick(decision.timestamp)
                          }
                          leftSection={<Clock size={12} aria-hidden="true" />}
                          aria-label={`Jump to decision at ${formatTimestamp(
                            decision.timestamp
                          )}`}
                          style={{ width: 'fit-content' }}
                        >
                          {formatTimestamp(decision.timestamp)}
                        </Button>

                        {/* Decision Statement */}
                        <Paper p="md" radius="md" withBorder shadow="xs" style={{ transition: 'box-shadow 150ms' }}>
                          <Title order={4} size="md" mb="xs" style={{ lineHeight: 1.75 }}>
                            {decision.decision}
                          </Title>

                          {/* Context */}
                          {decision.context && (
                            <Box
                              p="sm"
                              style={{
                                backgroundColor: 'var(--mantine-color-default)',
                                borderLeft: `2px solid var(--mantine-color-blue-3)`,
                                borderRadius: 'var(--mantine-radius-sm)'
                              }}
                            >
                              <Text size="sm" c="dimmed" style={{ lineHeight: 1.7 }}>
                                {decision.context}
                              </Text>
                            </Box>
                          )}
                        </Paper>
                      </Stack>
                    </Box>
                  ))}
                </Stack>
              </Box>
            </Paper>
          ) : (
            <Alert
              icon={<AlertCircle size={16} />}
              title="No Decisions"
              color="gray"
              variant="light"
            >
              No key decisions were detected in this analysis.
            </Alert>
          )}
        </Tabs.Panel>

        {/* Quotes Tab */}
        <Tabs.Panel value="quotes" mt="lg">
          {hasQuotes && results.quotes && results.quotes.length > 0 ? (
            <Paper p="xl" radius="md" withBorder shadow="sm">
              <Stack gap="md" mb="xl">
                <Group gap="xs">
                  <Quote size={20} style={{ color: 'var(--aph-purple)' }} />
                  <Title order={3} size="lg">
                    Notable Quotes
                  </Title>
                </Group>
                <Text size="sm" c="dimmed">
                  Key statements and memorable quotes from the transcript.
                </Text>
              </Stack>
              <Box>
                {/* Carousel */}
                <Box
                  mb="xl"
                  style={{ position: 'relative' }}
                  role="region"
                  aria-label="Quote carousel"
                  aria-roledescription="carousel"
                >
                  <Paper
                    p="xl"
                    radius="xl"
                    style={{
                      background: 'linear-gradient(135deg, var(--mantine-color-violet-0), var(--mantine-color-indigo-0))',
                      minHeight: 200,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                      border: '1px solid var(--mantine-color-violet-1)'
                    }}
                    aria-live="polite"
                    aria-atomic="true"
                  >
                    <Flex direction="column" align="center">
                      <Quote size={32} style={{ color: 'var(--mantine-color-violet-2)', marginBottom: 16 }} />
                      <Text
                        size="xl"
                        fs="italic"
                        ta="center"
                        fw={500}
                        mb="lg"
                        style={{
                          lineHeight: 1.6,
                          color: 'var(--mantine-color-gray-7)'
                        }}
                      >
                        &quot;{results.quotes[currentQuoteIndex].text}&quot;
                      </Text>

                      <Group gap="sm" justify="center">
                        {results.quotes[currentQuoteIndex].speaker && (
                          <>
                            <Text size="sm" fw={600} c="violet.7">
                              — {results.quotes[currentQuoteIndex].speaker}
                            </Text>
                            <Text size="sm" c="violet.2" aria-hidden="true">
                              •
                            </Text>
                          </>
                        )}
                        <Button
                          variant="subtle"
                          size="xs"
                          onClick={() =>
                            onTimestampClick &&
                            onTimestampClick(
                              results.quotes![currentQuoteIndex].timestamp
                            )
                          }
                          leftSection={<Clock size={14} aria-hidden="true" />}
                          aria-label={`Jump to timestamp ${formatTimestamp(
                            results.quotes[currentQuoteIndex].timestamp
                          )}`}
                        >
                          {formatTimestamp(
                            results.quotes[currentQuoteIndex].timestamp
                          )}
                        </Button>
                      </Group>

                      {/* Screen reader only quote counter */}
                      <VisuallyHidden>
                        Quote {currentQuoteIndex + 1} of {results.quotes.length}
                      </VisuallyHidden>
                    </Flex>
                  </Paper>

                  {/* Navigation */}
                  {results.quotes.length > 1 && (
                    <Group
                      justify="center"
                      gap="md"
                      mt="md"
                      role="group"
                      aria-label="Quote navigation"
                    >
                      <Button
                        variant="subtle"
                        color="gray"
                        size="sm"
                        onClick={prevQuote}
                        leftSection={
                          <ChevronLeft size={16} aria-hidden="true" />
                        }
                        aria-label="Previous quote"
                      >
                        Previous
                      </Button>

                      <Badge
                        size="sm"
                        variant="light"
                        radius="xl"
                        aria-hidden="true"
                      >
                        {currentQuoteIndex + 1} / {results.quotes.length}
                      </Badge>

                      <Button
                        variant="subtle"
                        color="gray"
                        size="sm"
                        onClick={nextQuote}
                        rightSection={
                          <ChevronRight size={16} aria-hidden="true" />
                        }
                        aria-label="Next quote"
                      >
                        Next
                      </Button>
                    </Group>
                  )}
                </Box>

                {/* All Quotes List */}
                {results.quotes.length > 1 && (
                  <>
                    <Divider
                      my="xl"
                      label="All Quotes"
                      labelPosition="center"
                    />
                    <Grid gutter="md">
                      {results.quotes.map((quote, idx) => (
                        <Grid.Col key={idx} span={{ base: 12, md: 6 }}>
                          <Paper
                            p="md"
                            radius="md"
                            withBorder={idx === currentQuoteIndex}
                            onClick={() => setCurrentQuoteIndex(idx)}
                            style={{
                              cursor: 'pointer',
                              transition: 'all 150ms',
                              backgroundColor: idx === currentQuoteIndex
                                ? 'var(--mantine-color-violet-0)'
                                : 'transparent',
                              borderColor: idx === currentQuoteIndex
                                ? 'var(--mantine-color-violet-2)'
                                : 'transparent',
                              boxShadow: idx === currentQuoteIndex
                                ? '0 0 0 1px var(--mantine-color-violet-2)'
                                : 'none'
                            }}
                            onMouseEnter={(e) => {
                              if (idx !== currentQuoteIndex) {
                                e.currentTarget.style.backgroundColor = 'var(--mantine-color-gray-0)';
                                e.currentTarget.style.borderColor = 'var(--mantine-color-gray-3)';
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (idx !== currentQuoteIndex) {
                                e.currentTarget.style.backgroundColor = 'transparent';
                                e.currentTarget.style.borderColor = 'transparent';
                              }
                            }}
                          >
                            <Text size="sm" c="dimmed" mb="xs" fs="italic" lineClamp={3}>
                              &quot;{quote.text}&quot;
                            </Text>
                            <Group justify="space-between" mt="xs">
                              <Group gap="xs">
                                {quote.speaker && (
                                  <Text size="xs" c="dimmed" fw={500}>
                                    {quote.speaker}
                                  </Text>
                                )}
                              </Group>
                              <Badge size="xs" variant="light" radius="sm" ff="monospace">
                                {formatTimestamp(quote.timestamp)}
                              </Badge>
                            </Group>
                          </Paper>
                        </Grid.Col>
                      ))}
                    </Grid>
                  </>
                )}
              </Box>
            </Paper>
          ) : (
            <Alert
              icon={<AlertCircle size={16} />}
              title="No Quotes"
              color="gray"
              variant="light"
            >
              No notable quotes were extracted from this transcript.
            </Alert>
          )}
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}

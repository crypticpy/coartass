/**
 * Section Display Component
 *
 * Displays a single analysis section with content, evidence citations,
 * and expand/collapse functionality. Supports copying section content.
 */

'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Copy, Check } from 'lucide-react';
import { Paper, Button, Badge, Stack, Flex, Box, Group, Title, List, Text } from '@mantine/core';
import { EvidenceCard } from './evidence-card';
import { TextWithTimestamps } from './timestamp-link';
import { formatSectionContent, normalizeEvidence } from '@/lib/analysis-utils';
import type { AnalysisSection } from '@/types/analysis';

/**
 * Parse pipe-delimited key-value pairs from a line
 * Example: "Task: Update docs | Owner: John | Due: Friday" => [{key: "Task", value: "Update docs"}, ...]
 */
function parsePipeDelimitedPairs(line: string): Array<{key: string; value: string}> | null {
  // Check if line contains pipe-delimited pairs
  if (!/\w+:\s*[^|]+\s*\|\s*\w+:/.test(line)) {
    return null;
  }

  const pairs: Array<{key: string; value: string}> = [];
  // Split by pipe, then parse each segment
  const segments = line.split('|').map(s => s.trim());

  for (const segment of segments) {
    const match = segment.match(/^([^:]+):\s*(.+)$/);
    if (match) {
      pairs.push({
        key: match[1].trim(),
        value: match[2].trim()
      });
    }
  }

  return pairs.length >= 2 ? pairs : null;
}

export interface SectionDisplayProps {
  /** The section data to display */
  section: AnalysisSection;

  /** Optional callback when evidence timestamp is clicked */
  onTimestampClick?: (timestamp: number) => void;

  /** Whether the section starts expanded */
  defaultExpanded?: boolean;

  /** Optional section color/variant */
  variant?: 'default' | 'primary' | 'secondary';

  /** Whether to show evidence citations */
  showEvidence?: boolean;
}

/**
 * Helper to capitalize the first letter of a string
 */
function capitalizeFirstLetter(string: string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

/**
 * Section Display component for rendering analysis sections with
 * collapsible content and evidence citations.
 */
export function SectionDisplay({
  section,
  onTimestampClick,
  defaultExpanded = true,
  variant = 'default',
  showEvidence = true,
}: SectionDisplayProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [isEvidenceExpanded, setIsEvidenceExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const evidence = React.useMemo(
    () => normalizeEvidence(section.evidence),
    [section.evidence]
  );
  const hasEvidence = evidence.length > 0;
  const evidenceCount = evidence.length;

  // Handle copy section content to clipboard
  const handleCopy = async () => {
    try {
      // Use formatted content for copying
      const formattedContent = formatSectionContent(section.content);
      const contentToCopy = `${section.name}\n${'='.repeat(section.name.length)}\n\n${formattedContent}`;
      await navigator.clipboard.writeText(contentToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy section content:', error);
    }
  };

  // Get border style based on variant
  const getBorderStyle = () => {
    switch (variant) {
      case 'primary':
        return { borderLeft: '4px solid var(--logo-blue)' };
      case 'secondary':
        return { borderLeft: '4px solid var(--logo-green)' };
      default:
        return {};
    }
  };

  return (
    <Paper p="md" withBorder style={{ ...getBorderStyle(), transition: 'all 200ms' }}>
      <Box pb="sm">
        <Flex align="flex-start" justify="space-between" gap="md">
          <Box style={{ flex: 1 }}>
            <Group gap="xs" mb={4}>
              <Title order={3} size="lg">
                {section.name}
              </Title>
              {hasEvidence && showEvidence && (
                <Badge variant="light" size="sm">
                  {evidenceCount} {evidenceCount === 1 ? 'citation' : 'citations'}
                </Badge>
              )}
            </Group>
          </Box>

          {/* Action Buttons */}
          <Group gap="xs">
            <Button
              variant="subtle"
              size="sm"
              onClick={handleCopy}
              title="Copy section content"
              style={{ height: 32, padding: '0 8px' }}
            >
              {copied ? (
                <Check size={16} style={{ color: 'var(--compliant-green)' }} />
              ) : (
                <Copy size={16} />
              )}
            </Button>

            <Button
              variant="subtle"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              style={{ height: 32, padding: '0 8px' }}
              aria-label={isExpanded ? 'Collapse section' : 'Expand section'}
            >
              {isExpanded ? (
                <ChevronUp size={16} />
              ) : (
                <ChevronDown size={16} />
              )}
            </Button>
          </Group>
        </Flex>
      </Box>

      {isExpanded && (
        <Stack gap="md" pt={0}>
          {/* Section Content */}
          <Box>
            {(() => {
              // Pre-format the content using our utility
              const formattedContent = formatSectionContent(section.content);

              // Split by double newlines to detect paragraphs first
              const rawParagraphs = formattedContent.split(/\n\s*\n/);
              const elements: React.ReactNode[] = [];

              rawParagraphs.forEach((paragraph, pIdx) => {
                // Check if this paragraph is actually a list or contains list items
                const lines = paragraph.split('\n').map((line) => line.trim()).filter(Boolean);

                let currentBullets: string[] = [];
                let currentNumbered: string[] = [];

                const flushBullets = () => {
                  if (currentBullets.length > 0) {
                    elements.push(
                      <List key={`ul-${pIdx}-${elements.length}`} spacing="sm" ml="md" mb="lg" style={{ listStyleType: 'disc' }}>
                        {currentBullets.map((bullet, bidx) => (
                          <List.Item key={bidx} style={{ fontSize: '16px', lineHeight: 1.75, paddingLeft: '4px' }}>
                            <TextWithTimestamps text={bullet} onTimestampClick={onTimestampClick} size="md" />
                          </List.Item>
                        ))}
                      </List>
                    );
                    currentBullets = [];
                  }
                };

                const flushNumbered = () => {
                  if (currentNumbered.length > 0) {
                    elements.push(
                      <List key={`ol-${pIdx}-${elements.length}`} type="ordered" spacing="sm" ml="md" mb="lg">
                        {currentNumbered.map((item, nidx) => (
                          <List.Item key={nidx} style={{ fontSize: '16px', lineHeight: 1.75, paddingLeft: '4px' }}>
                            <TextWithTimestamps text={item} onTimestampClick={onTimestampClick} size="md" />
                          </List.Item>
                        ))}
                      </List>
                    );
                    currentNumbered = [];
                  }
                };

                // Check if this block is Q&A format (MEF questionnaire style)
                const isQABlock = lines.some(line =>
                  /^Q\d+\s*[\(\[]/.test(line) ||
                  /^Source:/i.test(line) ||
                  /^Confidence:/i.test(line)
                );

                if (isQABlock) {
                  // Render Q&A format as a styled block
                  // Group lines into Q&A entries (Q line + Source + Confidence)
                  let currentQA: string[] = [];

                  const flushQA = () => {
                    if (currentQA.length > 0) {
                      elements.push(
                        <Box
                          key={`qa-${pIdx}-${elements.length}`}
                          mb="md"
                          pl="md"
                          style={{
                            borderLeft: '3px solid var(--mantine-color-gray-3)',
                            paddingTop: 4,
                            paddingBottom: 4,
                          }}
                        >
                          {currentQA.map((qaLine, qaIdx) => {
                            // Style Q lines differently from Source/Confidence
                            const isQuestionLine = /^Q\d+/.test(qaLine);
                            const isMetaLine = /^(Source:|Confidence:)/i.test(qaLine);
                            return (
                              <Box
                                key={qaIdx}
                                mb={qaIdx < currentQA.length - 1 ? 4 : 0}
                                style={{ lineHeight: 1.6 }}
                              >
                                <TextWithTimestamps
                                  text={qaLine}
                                  onTimestampClick={onTimestampClick}
                                  size={isQuestionLine ? 'md' : 'sm'}
                                  c={isMetaLine ? 'dimmed' : undefined}
                                />
                              </Box>
                            );
                          })}
                        </Box>
                      );
                      currentQA = [];
                    }
                  };

                  lines.forEach((line) => {
                    // New question starts a new block
                    if (/^Q\d+/.test(line)) {
                      flushQA();
                    }
                    currentQA.push(line);
                  });
                  flushQA();
                  return; // Skip normal processing for this block
                }

                // Process lines within this block (non-Q&A format)
                lines.forEach((line, lIdx) => {
                  // Handle bullet points
                  if (line.startsWith('-') || line.startsWith('•') || line.startsWith('*')) {
                    flushNumbered(); // Close any open numbered list
                    const bulletText = line.replace(/^[-•*]\s*/, '');
                    currentBullets.push(capitalizeFirstLetter(bulletText));
                    return;
                  }

                  // Handle numbered lists
                  if (/^\d+\./.test(line)) {
                    flushBullets(); // Close any open bullet list
                    const match = line.match(/^(\d+)\.\s*(.+)$/);
                    if (match) {
                      currentNumbered.push(capitalizeFirstLetter(match[2]));
                      return;
                    }
                  }

                  // Handle checkboxes (action items)
                  if (line.startsWith('- [ ]') || line.startsWith('- [x]')) {
                    flushBullets();
                    flushNumbered();
                    const isChecked = line.includes('[x]');
                    const checkboxText = line.replace(/^-\s*\[(x| )\]\s*/, '');
                    elements.push(
                      <Flex key={`checkbox-${pIdx}-${lIdx}`} gap="sm" align="flex-start" mb="xs">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          readOnly
                          style={{ marginTop: 6, cursor: 'default' }}
                        />
                        <Box
                          style={{
                            lineHeight: 1.75,
                            textDecoration: isChecked ? 'line-through' : 'none',
                            color: isChecked ? 'var(--mantine-color-dimmed)' : 'inherit'
                          }}
                        >
                          <TextWithTimestamps
                            text={capitalizeFirstLetter(checkboxText)}
                            onTimestampClick={onTimestampClick}
                            size="md"
                          />
                        </Box>
                      </Flex>
                    );
                    return;
                  }

                  // Handle pipe-delimited key-value pairs (e.g., "Task: Update docs | Owner: John | Due: Friday")
                  const pipePairs = parsePipeDelimitedPairs(line);
                  if (pipePairs) {
                    flushBullets();
                    flushNumbered();
                    elements.push(
                      <Box
                        key={`pipe-${pIdx}-${lIdx}`}
                        mb="sm"
                        p="sm"
                        style={{
                          background: 'var(--mantine-color-gray-0)',
                          borderRadius: 'var(--mantine-radius-sm)',
                          border: '1px solid var(--mantine-color-gray-2)',
                        }}
                      >
                        <Group gap="md" wrap="wrap">
                          {pipePairs.map((pair, pairIdx) => (
                            <Group key={pairIdx} gap={6} wrap="nowrap">
                              <Text
                                size="xs"
                                fw={600}
                                c="dimmed"
                                tt="uppercase"
                                style={{ letterSpacing: '0.02em' }}
                              >
                                {pair.key}:
                              </Text>
                              <TextWithTimestamps
                                text={pair.value}
                                onTimestampClick={onTimestampClick}
                                size="sm"
                              />
                            </Group>
                          ))}
                        </Group>
                      </Box>
                    );
                    return;
                  }

                  // Regular text line
                  // If we have accumulated bullets/numbers, flush them first
                  if (currentBullets.length > 0 || currentNumbered.length > 0) {
                    flushBullets();
                    flushNumbered();
                  }

                  // If this line doesn't look like a list item, treat it as paragraph text
                  // Render as single paragraph with clickable timestamps
                  elements.push(
                    <Box key={`para-${pIdx}-${lIdx}`} mb="lg" style={{ lineHeight: 1.75 }}>
                      <TextWithTimestamps text={line} onTimestampClick={onTimestampClick} size="md" />
                    </Box>
                  );
                });

                // Flush any remaining lists at end of block
                flushBullets();
                flushNumbered();
              });

              return elements;
            })()}
          </Box>

          {/* Evidence Citations */}
          {hasEvidence && showEvidence && (
            <Box pt="sm" mt="md" style={{ borderTop: '1px solid var(--mantine-color-default-border)' }}>
              <Button
                variant="subtle"
                onClick={() => setIsEvidenceExpanded(!isEvidenceExpanded)}
                fullWidth
                justify="flex-start"
                leftSection={
                  isEvidenceExpanded ? (
                    <ChevronUp size={14} style={{ color: 'var(--mantine-color-dimmed)' }} />
                  ) : (
                    <ChevronDown size={14} style={{ color: 'var(--mantine-color-dimmed)' }} />
                  )
                }
                rightSection={
                  <Badge variant="light" size="sm" color="gray" style={{ fontWeight: 400 }}>
                    {evidenceCount} {evidenceCount === 1 ? 'citation' : 'citations'}
                  </Badge>
                }
                style={{
                  padding: '8px 0',
                  fontSize: '14px',
                  fontWeight: 500,
                  color: 'var(--mantine-color-dimmed)',
                  transition: 'color 150ms',
                }}
                styles={{
                  root: {
                    '&:hover': {
                      color: 'inherit',
                      backgroundColor: 'transparent'
                    }
                  }
                }}
              >
                {isEvidenceExpanded ? 'Hide Supporting Evidence' : 'View Supporting Evidence'}
              </Button>

              {isEvidenceExpanded && (
                <Stack gap="xs" mt="sm" style={{ animation: 'fadeIn 200ms ease-in' }}>
                  {evidence.map((evidence, idx) => (
                    <EvidenceCard
                      key={idx}
                      evidence={evidence}
                      onTimestampClick={onTimestampClick}
                      showRelevance={true}
                      compact={true}
                    />
                  ))}
                </Stack>
              )}
            </Box>
          )}
        </Stack>
      )}
    </Paper>
  );
}

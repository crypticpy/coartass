/**
 * Template Detail Component
 *
 * Reusable component for displaying template details including sections,
 * prompts, and output configuration. Can be used in both analyze page
 * and templates management page.
 */

'use client';

import React from 'react';
import { Badge, Divider, Stack, Group, Text, Title, ThemeIcon, Paper, Box, Tooltip, ActionIcon, useMantineColorScheme } from '@mantine/core';
import type { Template, TemplateSection } from '@/types/template';
import { FileText, MessageSquare, Lightbulb, Check, Copy, Quote } from 'lucide-react';
import { useClipboard } from '@mantine/hooks';

interface TemplateSectionDetailProps {
  section: TemplateSection;
  index: number;
  isLast: boolean;
  isDark: boolean;
}

/**
 * Displays a single section's details with timeline formatting
 */
function TemplateSectionDetail({ section, index, isLast, isDark }: TemplateSectionDetailProps) {
  const clipboard = useClipboard({ timeout: 2000 });

  return (
    <Group align="flex-start" wrap="nowrap" gap={0}>
      {/* Timeline Column */}
      <Stack align="center" gap={0} mr="md" style={{ width: 24 }}>
        <ThemeIcon
          variant={isDark ? "filled" : "light"}
          radius="xl"
          size={24}
          color="blue"
          style={{
            border: isDark ? '2px solid var(--mantine-color-blue-6)' : '1px solid var(--mantine-color-blue-2)',
            zIndex: 1
          }}
        >
          <Text size="xs" fw={700}>{index + 1}</Text>
        </ThemeIcon>
        {!isLast && (
          <Box
            style={{
              width: 2,
              flex: 1,
              backgroundColor: isDark ? 'var(--mantine-color-dark-4)' : 'var(--mantine-color-gray-2)',
              minHeight: 20,
              marginTop: -4,
              marginBottom: -4,
            }}
          />
        )}
      </Stack>

      {/* Content Column */}
      <Box style={{ flex: 1, paddingBottom: isLast ? 0 : 32 }}>
        <Stack gap="xs">
          {/* Section Header */}
          <Box>
            <Text fw={600} size="sm">
              {section.name}
            </Text>
            <Group gap="xs" mt={4}>
              <Badge variant="dot" size="sm" color="gray">
                {section.outputFormat.replace('_', ' ')}
              </Badge>
              {section.extractEvidence && (
                <Badge variant="dot" size="sm" color="blue">
                  with evidence
                </Badge>
              )}
            </Group>
          </Box>

          {/* Prompt Card */}
          <Paper
            p="md"
            radius="md"
            style={{
              backgroundColor: 'var(--mantine-color-default)',
              border: '1px solid var(--mantine-color-default-border)'
            }}
          >
            <Group justify="space-between" align="flex-start" mb="xs">
              <Group gap="xs">
                <MessageSquare size={14} style={{ color: 'var(--mantine-color-dimmed)' }} />
                <Text size="xs" fw={700} c="dimmed" tt="uppercase" lts={0.5}>
                  Analysis Prompt
                </Text>
              </Group>

              <Tooltip label={clipboard.copied ? "Copied!" : "Copy prompt"} position="left" withArrow>
                <ActionIcon
                  variant="subtle"
                  color={clipboard.copied ? "green" : "gray"}
                  size="sm"
                  onClick={() => clipboard.copy(section.prompt)}
                >
                  {clipboard.copied ? <Check size={14} /> : <Copy size={14} />}
                </ActionIcon>
              </Tooltip>
            </Group>

            <Text size="sm" lh={1.6} style={{ whiteSpace: 'pre-wrap' }}>
              {section.prompt}
            </Text>
          </Paper>
        </Stack>
      </Box>
    </Group>
  );
}

interface TemplateDetailProps {
  template: Template;
  compact?: boolean;
}

/**
 * Main template detail component
 *
 * @param template - The template to display
 * @param compact - If true, shows a more condensed view
 */
export function TemplateDetail({ template, compact = false }: TemplateDetailProps) {
  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <Stack gap="xl">
      {/* Template Overview */}
      {!compact && (
        <Paper
          p="lg"
          radius="md"
          style={{
            backgroundColor: isDark ? 'var(--mantine-color-blue-9)' : 'var(--mantine-color-blue-0)',
            border: `1px solid ${isDark ? 'var(--mantine-color-blue-7)' : 'var(--mantine-color-blue-2)'}`
          }}
        >
          <Stack gap="xs">
            <Group gap="xs">
              <Lightbulb size={18} style={{ color: isDark ? 'var(--mantine-color-blue-4)' : 'var(--mantine-color-blue-7)' }} />
              <Title order={4} size="sm" c={isDark ? "blue.2" : "blue.9"}>What This Template Does</Title>
            </Group>
            <Text size="sm" c={isDark ? "blue.1" : "blue.9"} lh={1.6}>
              {template.description}
            </Text>
          </Stack>
        </Paper>
      )}

      {/* Output Types */}
      <Stack gap="xs">
        <Group gap="xs" align="center">
          <FileText size={16} style={{ color: 'var(--mantine-color-dimmed)' }} />
          <Title order={5} size="sm" fw={600} c="dimmed" tt="uppercase" lts={0.5}>
            Generated Outputs
          </Title>
        </Group>
        <Group gap="xs">
          {template.outputs.map((output) => (
            <Badge
              key={output}
              variant="outline"
              size="md"
              radius="sm"
              color="gray"
              leftSection={output === 'quotes' ? <Quote size={12} /> : <FileText size={12} />}
              styles={{ root: { textTransform: 'capitalize' } }}
            >
              {output.replace('_', ' ')}
            </Badge>
          ))}
        </Group>
      </Stack>

      <Divider />

      {/* Sections */}
      <Stack gap="md">
        <Title order={4} size="h5">
          Analysis Flow ({template.sections.length} Steps)
        </Title>
        <Box pl={4}>
          {template.sections.map((section, index) => (
            <TemplateSectionDetail
              key={section.id}
              section={section}
              index={index}
              isLast={index === template.sections.length - 1}
              isDark={isDark}
            />
          ))}
        </Box>
      </Stack>
    </Stack>
  );
}

/**
 * Action Items List Component
 *
 * Displays extracted action items in a table or list format with interactive
 * checkboxes (client-side only, no persistence). Supports exporting to clipboard.
 */

'use client';

import React, { useState } from 'react';
import { CheckSquare, Square, Clock, User, Check, Download } from 'lucide-react';
import { Paper, Button, Badge, Stack, Flex, Box, Title, Text, Table, Group, Progress, ActionIcon } from '@mantine/core';
import { formatTimestamp } from '@/lib/transcript-utils';
import type { ActionItem } from '@/types/analysis';

export interface ActionItemsListProps {
  /** Array of action items to display */
  actionItems: ActionItem[];

  /** Optional callback when timestamp is clicked */
  onTimestampClick?: (timestamp: number) => void;

  /** Display mode */
  variant?: 'table' | 'list';

  /** Show header */
  showHeader?: boolean;
}

/**
 * Action Items List component displaying tasks with interactive checkboxes
 * and export functionality.
 */
export function ActionItemsList({
  actionItems,
  onTimestampClick,
  variant = 'table',
  showHeader = true,
}: ActionItemsListProps) {
  // Track checked state (client-side only, no persistence)
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);

  const handleToggleItem = (id: string) => {
    setCheckedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleTimestampClick = (timestamp?: number) => {
    if (timestamp !== undefined && onTimestampClick) {
      onTimestampClick(timestamp);
    }
  };

  // Export action items to clipboard as markdown
  const handleExport = async () => {
    try {
      const markdown = actionItems
        .map((item) => {
          const checkbox = checkedItems.has(item.id) ? '[x]' : '[ ]';
          const owner = item.owner ? ` - Assigned to: ${item.owner}` : '';
          const deadline = item.deadline ? ` - Due: ${item.deadline}` : '';
          const timestamp = item.timestamp !== undefined ? ` (${formatTimestamp(item.timestamp ?? 0)})` : '';
          return `- ${checkbox} ${item.task}${owner}${deadline}${timestamp}`;
        })
        .join('\n');

      await navigator.clipboard.writeText(`# Action Items\n\n${markdown}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to export action items:', error);
    }
  };

  const completedCount = checkedItems.size;
  const totalCount = actionItems.length;
  const progressPercentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  if (actionItems.length === 0) {
    return (
      <Paper p="md" withBorder>
        {showHeader && (
          <Box mb="md">
            <Title order={3} size="lg">Action Items</Title>
          </Box>
        )}
        <Text size="sm" c="dimmed" ta="center" py="xl">
          No action items found in this analysis.
        </Text>
      </Paper>
    );
  }

  return (
    <Paper p="md" withBorder>
      {showHeader && (
        <Box mb="md">
          <Flex align="center" justify="space-between" gap="md">
            <Box style={{ flex: 1 }}>
              <Title order={3} size="lg" mb="xs">
                Action Items
              </Title>
              <Flex align="center" gap="sm">
                <Badge variant="light">
                  {completedCount} / {totalCount} completed
                </Badge>
                <Box style={{ flex: 1, maxWidth: '300px' }}>
                  <Progress
                    value={progressPercentage}
                    size="sm"
                    color="var(--logo-blue)"
                    style={{ transition: 'all 300ms' }}
                  />
                </Box>
                <Text size="xs" c="dimmed" fw={500}>
                  {progressPercentage}%
                </Text>
              </Flex>
            </Box>

            <Button
              variant="default"
              size="sm"
              onClick={handleExport}
              leftSection={copied ? <Check size={16} style={{ color: 'var(--compliant-green)' }} /> : <Download size={16} />}
            >
              {copied ? 'Copied' : 'Export'}
            </Button>
          </Flex>
        </Box>
      )}

      <Box pt={showHeader ? 0 : undefined}>
        {variant === 'table' ? (
          <Box style={{ overflowX: 'auto' }} mx={{ base: -8, sm: 0 }}>
            <Table striped highlightOnHover style={{ minWidth: '600px', fontSize: 'var(--mantine-font-size-sm)' }}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th w={40} c="dimmed" fw={500}>Done</Table.Th>
                  <Table.Th c="dimmed" fw={500}>Task</Table.Th>
                  <Table.Th c="dimmed" fw={500} visibleFrom="md">Owner</Table.Th>
                  <Table.Th c="dimmed" fw={500} visibleFrom="lg">Deadline</Table.Th>
                  <Table.Th c="dimmed" fw={500} style={{ textAlign: 'right' }}>Time</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {actionItems.map((item) => {
                  const isChecked = checkedItems.has(item.id);
                  return (
                    <Table.Tr
                      key={item.id}
                      style={{
                        opacity: isChecked ? 0.6 : 1,
                        transition: 'opacity 200ms'
                      }}
                    >
                      <Table.Td>
                        <ActionIcon
                          variant="subtle"
                          onClick={() => handleToggleItem(item.id)}
                          aria-label={isChecked ? 'Mark as incomplete' : 'Mark as complete'}
                          style={{
                            transition: 'transform 200ms',
                            minHeight: '44px',
                            minWidth: '44px'
                          }}
                        >
                          {isChecked ? (
                            <CheckSquare size={20} style={{ color: 'var(--logo-blue)' }} />
                          ) : (
                            <Square size={20} color="var(--mantine-color-dimmed)" />
                          )}
                        </ActionIcon>
                      </Table.Td>
                      <Table.Td>
                        <Stack gap={4}>
                          <Text
                            size="sm"
                            td={isChecked ? 'line-through' : undefined}
                            c={isChecked ? 'dimmed' : undefined}
                          >
                            {item.task}
                          </Text>
                          {/* Mobile-only metadata */}
                          <Flex wrap="wrap" align="center" gap="xs" hiddenFrom="md">
                            {item.owner && (
                              <Group gap={4}>
                                <User size={12} />
                                <Text size="xs" c="dimmed">{item.owner}</Text>
                              </Group>
                            )}
                            {item.deadline && (
                              <Text size="xs" c="dimmed">Due: {item.deadline}</Text>
                            )}
                          </Flex>
                        </Stack>
                      </Table.Td>
                      <Table.Td visibleFrom="md">
                        {item.owner ? (
                          <Group gap={6}>
                            <User size={14} color="var(--mantine-color-dimmed)" />
                            <Text size="sm" c="dimmed">{item.owner}</Text>
                          </Group>
                        ) : (
                          <Text size="xs" c="dimmed" opacity={0.5}>Unassigned</Text>
                        )}
                      </Table.Td>
                      <Table.Td visibleFrom="lg">
                        {item.deadline ? (
                          <Text size="sm" c="dimmed">{item.deadline}</Text>
                        ) : (
                          <Text size="xs" c="dimmed" opacity={0.5}>No deadline</Text>
                        )}
                      </Table.Td>
                      <Table.Td style={{ textAlign: 'right' }}>
                        {item.timestamp !== undefined ? (
                          <ActionIcon
                            variant="subtle"
                            onClick={() => handleTimestampClick(item.timestamp)}
                            title="Jump to timestamp"
                            aria-label={`Jump to timestamp ${formatTimestamp(item.timestamp ?? 0)}`}
                            style={{
                              marginLeft: 'auto',
                              minHeight: '44px',
                              minWidth: '44px'
                            }}
                          >
                            <Group gap={4} style={{ color: 'var(--mantine-color-dimmed)' }}>
                              <Clock size={14} />
                              <Text size="xs" visibleFrom="sm">{formatTimestamp(item.timestamp)}</Text>
                            </Group>
                          </ActionIcon>
                        ) : (
                          <Text size="xs" c="dimmed" opacity={0.5}>—</Text>
                        )}
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          </Box>
        ) : (
          <Stack gap="sm">
            {actionItems.map((item) => {
              const isChecked = checkedItems.has(item.id);
              return (
                <Paper
                  key={item.id}
                  p="md"
                  withBorder
                  style={{
                    opacity: isChecked ? 0.6 : 1,
                    backgroundColor: isChecked ? 'var(--mantine-color-gray-0)' : undefined,
                    transition: 'all 200ms'
                  }}
                >
                  <Flex align="flex-start" gap="sm">
                    <ActionIcon
                      variant="subtle"
                      onClick={() => handleToggleItem(item.id)}
                      aria-label={isChecked ? 'Mark as incomplete' : 'Mark as complete'}
                      style={{
                        flexShrink: 0,
                        marginTop: '2px',
                        transition: 'transform 200ms'
                      }}
                    >
                      {isChecked ? (
                        <CheckSquare size={20} style={{ color: 'var(--logo-blue)' }} />
                      ) : (
                        <Square size={20} color="var(--mantine-color-dimmed)" />
                      )}
                    </ActionIcon>

                    <Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
                      <Text
                        size="sm"
                        td={isChecked ? 'line-through' : undefined}
                        c={isChecked ? 'dimmed' : undefined}
                      >
                        {item.task}
                      </Text>
                      <Flex align="center" gap="sm" wrap="wrap">
                        {item.owner && (
                          <Group gap={4}>
                            <User size={12} color="var(--mantine-color-dimmed)" />
                            <Text size="xs" c="dimmed">{item.owner}</Text>
                          </Group>
                        )}
                        {item.deadline && (
                          <Text size="xs" c="dimmed">Due: {item.deadline}</Text>
                        )}
                        {item.timestamp !== undefined && (
                          <ActionIcon
                            variant="subtle"
                            size="sm"
                            onClick={() => handleTimestampClick(item.timestamp)}
                            title="Jump to timestamp"
                            aria-label={`Jump to timestamp ${formatTimestamp(item.timestamp ?? 0)}`}
                          >
                            <Group gap={4}>
                              <Clock size={12} />
                              <Text size="xs" c="dimmed" style={{ transition: 'color 200ms' }}>
                                {formatTimestamp(item.timestamp)}
                              </Text>
                            </Group>
                          </ActionIcon>
                        )}
                      </Flex>
                    </Stack>
                  </Flex>
                </Paper>
              );
            })}
          </Stack>
        )}
      </Box>
    </Paper>
  );
}

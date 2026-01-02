'use client';

import Link from 'next/link';
import {
  Table,
  Checkbox,
  Text,
  Badge,
  ActionIcon,
  Group,
  UnstyledButton,
} from '@mantine/core';
import { Trash2, ChevronUp, ChevronDown, Users } from 'lucide-react';
import type { Transcript } from '@/types/transcript';
import {
  formatDuration,
  formatFileSize,
  formatDate,
  getLanguageBadge,
  getSpeakerCount,
  truncateText,
} from '@/lib/utils/format';
import type { TranscriptSortField } from '@/lib/db';

export interface TranscriptTableProps {
  transcripts: Transcript[];
  selectedIds: Set<string>;
  onSelectAll: (selected: boolean) => void;
  onSelect: (id: string, selected: boolean) => void;
  onDelete: (id: string) => void;
  sortBy: TranscriptSortField;
  sortOrder: 'asc' | 'desc';
  onSort: (field: TranscriptSortField) => void;
}

interface SortableHeaderProps {
  field: TranscriptSortField;
  currentSort: TranscriptSortField;
  sortOrder: 'asc' | 'desc';
  onSort: (field: TranscriptSortField) => void;
  children: React.ReactNode;
}

function SortableHeader({
  field,
  currentSort,
  sortOrder,
  onSort,
  children,
}: SortableHeaderProps) {
  const isActive = currentSort === field;
  const ariaSortValue = isActive ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none';

  return (
    <UnstyledButton
      onClick={() => onSort(field)}
      aria-sort={ariaSortValue}
      aria-label={`Sort by ${children}${isActive ? `, currently sorted ${sortOrder === 'asc' ? 'ascending' : 'descending'}` : ''}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        fontWeight: 600,
        color: isActive ? 'var(--mantine-primary-color-filled)' : 'inherit',
      }}
    >
      {children}
      {isActive && (
        sortOrder === 'asc' ? <ChevronUp size={14} aria-hidden="true" /> : <ChevronDown size={14} aria-hidden="true" />
      )}
    </UnstyledButton>
  );
}

export function TranscriptTable({
  transcripts,
  selectedIds,
  onSelectAll,
  onSelect,
  onDelete,
  sortBy,
  sortOrder,
  onSort,
}: TranscriptTableProps) {
  const allSelected =
    transcripts.length > 0 && selectedIds.size === transcripts.length;
  const someSelected = selectedIds.size > 0 && !allSelected;

  return (
    <Table.ScrollContainer minWidth={800}>
      <Table striped highlightOnHover verticalSpacing="sm">
        <Table.Thead>
          <Table.Tr>
            <Table.Th style={{ width: 40 }}>
              <Checkbox
                checked={allSelected}
                indeterminate={someSelected}
                onChange={(e) => onSelectAll(e.target.checked)}
                aria-label="Select all transcripts"
              />
            </Table.Th>
            <Table.Th>
              <SortableHeader
                field="filename"
                currentSort={sortBy}
                sortOrder={sortOrder}
                onSort={onSort}
              >
                Filename
              </SortableHeader>
            </Table.Th>
            <Table.Th style={{ minWidth: 200 }}>Summary</Table.Th>
            <Table.Th>
              <SortableHeader
                field="metadata.duration"
                currentSort={sortBy}
                sortOrder={sortOrder}
                onSort={onSort}
              >
                Duration
              </SortableHeader>
            </Table.Th>
            <Table.Th>Language</Table.Th>
            <Table.Th>
              <SortableHeader
                field="metadata.fileSize"
                currentSort={sortBy}
                sortOrder={sortOrder}
                onSort={onSort}
              >
                Size
              </SortableHeader>
            </Table.Th>
            <Table.Th>
              <SortableHeader
                field="createdAt"
                currentSort={sortBy}
                sortOrder={sortOrder}
                onSort={onSort}
              >
                Date
              </SortableHeader>
            </Table.Th>
            <Table.Th style={{ width: 60 }}>Actions</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {transcripts.map((transcript) => {
            const speakerCount = getSpeakerCount(transcript.segments);
            const isSelected = selectedIds.has(transcript.id);

            return (
              <Table.Tr
                key={transcript.id}
                bg={isSelected ? 'var(--mantine-primary-color-light)' : undefined}
              >
                <Table.Td>
                  <Checkbox
                    checked={isSelected}
                    onChange={(e) => onSelect(transcript.id, e.target.checked)}
                    aria-label={`Select ${transcript.filename}`}
                  />
                </Table.Td>
                <Table.Td>
                  <Text
                    component={Link}
                    href={`/transcripts/${transcript.id}`}
                    fw={500}
                    style={{
                      color: 'var(--mantine-color-blue-6)',
                      textDecoration: 'none',
                    }}
                    lineClamp={1}
                  >
                    {transcript.filename}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm" c="dimmed" lineClamp={1}>
                    {transcript.summary || truncateText(transcript.text, 80)}
                  </Text>
                </Table.Td>
                <Table.Td>
                  {transcript.metadata?.duration !== undefined && (
                    <Text size="sm">
                      {formatDuration(transcript.metadata.duration)}
                    </Text>
                  )}
                </Table.Td>
                <Table.Td>
                  <Group gap="xs">
                    {transcript.metadata?.language && (
                      <Badge variant="light" color="blue" size="sm">
                        {getLanguageBadge(transcript.metadata.language)}
                      </Badge>
                    )}
                    {speakerCount > 0 && (
                      <Badge
                        variant="light"
                        color="grape"
                        size="xs"
                        leftSection={<Users size={10} />}
                      >
                        {speakerCount}
                      </Badge>
                    )}
                  </Group>
                </Table.Td>
                <Table.Td>
                  {transcript.metadata?.fileSize !== undefined && (
                    <Text size="sm">
                      {formatFileSize(transcript.metadata.fileSize)}
                    </Text>
                  )}
                </Table.Td>
                <Table.Td>
                  <Text size="sm">{formatDate(transcript.createdAt)}</Text>
                </Table.Td>
                <Table.Td>
                  <ActionIcon
                    variant="subtle"
                    color="red"
                    size="md"
                    onClick={() => onDelete(transcript.id)}
                    aria-label="Delete transcript"
                  >
                    <Trash2 size={16} />
                  </ActionIcon>
                </Table.Td>
              </Table.Tr>
            );
          })}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
}

export default TranscriptTable;

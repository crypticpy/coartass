'use client';

import Link from 'next/link';
import {
  Card,
  Group,
  Stack,
  Text,
  Badge,
  ActionIcon,
  Checkbox,
  Title,
} from '@mantine/core';
import { Clock, Trash2, Users } from 'lucide-react';
import type { Transcript } from '@/types/transcript';
import {
  formatDuration,
  formatFileSize,
  formatDate,
  getLanguageBadge,
  getModelDisplay,
  getSpeakerCount,
  truncateText,
} from '@/lib/utils/format';

export interface TranscriptCardProps {
  transcript: Transcript;
  selected?: boolean;
  onSelect?: (id: string, selected: boolean) => void;
  onDelete?: (id: string) => void;
  showCheckbox?: boolean;
}

export function TranscriptCard({
  transcript,
  selected = false,
  onSelect,
  onDelete,
  showCheckbox = false,
}: TranscriptCardProps) {
  const speakerCount = getSpeakerCount(transcript.segments);
  const languageCode = transcript.metadata?.language;
  const fileSize = transcript.metadata?.fileSize;
  const model = transcript.metadata?.model;
  const duration = transcript.metadata?.duration;

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    onSelect?.(transcript.id, e.target.checked);
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onDelete?.(transcript.id);
  };

  return (
    <Card
      padding="lg"
      radius="md"
      withBorder
      component={Link}
      href={`/transcripts/${transcript.id}`}
      style={{
        position: 'relative',
        cursor: 'pointer',
        transition: 'background-color 150ms ease, box-shadow 150ms ease',
      }}
      className="transcript-card-hover"
      data-tour-id="transcript-card"
    >
      <Stack gap="sm">
        {/* Header Row: Checkbox, Filename, Delete */}
        <Group justify="space-between" align="flex-start" wrap="nowrap">
          <Group gap="sm" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
            {showCheckbox && (
              <Checkbox
                checked={selected}
                onChange={handleCheckboxChange}
                onClick={(e) => e.stopPropagation()}
                aria-label={`Select ${transcript.filename}`}
                size="md"
              />
            )}
            <Title
              order={3}
              size="h4"
              lineClamp={1}
              style={{ flex: 1, minWidth: 0 }}
            >
              {transcript.filename}
            </Title>
          </Group>
          <ActionIcon
            variant="subtle"
            color="red"
            size="lg"
            onClick={handleDeleteClick}
            aria-label="Delete transcript"
            style={{ minWidth: 44, minHeight: 44 }}
            className="delete-button-hover"
          >
            <Trash2 size={16} />
          </ActionIcon>
        </Group>

        {/* Summary (if available) */}
        {transcript.summary ? (
          <Text size="sm" c="dimmed" lineClamp={2}>
            {transcript.summary}
          </Text>
        ) : (
          <Text size="sm" c="dimmed" lineClamp={2}>
            {truncateText(transcript.text, 150)}
          </Text>
        )}

        {/* Metadata Badges */}
        <Group gap="xs" wrap="wrap">
          {languageCode && (
            <Badge variant="light" color="blue" size="sm">
              {getLanguageBadge(languageCode)}
            </Badge>
          )}
          {fileSize && fileSize > 0 && (
            <Badge variant="light" color="gray" size="sm">
              {formatFileSize(fileSize)}
            </Badge>
          )}
          {speakerCount > 0 && (
            <Badge
              variant="light"
              color="grape"
              size="sm"
              leftSection={<Users size={12} />}
            >
              {speakerCount} speaker{speakerCount !== 1 ? 's' : ''}
            </Badge>
          )}
          {model && (
            <Badge variant="light" color="teal" size="sm">
              {getModelDisplay(model)}
            </Badge>
          )}
        </Group>

        {/* Footer: Duration and Date */}
        <Group justify="space-between" mt="xs">
          {duration !== undefined && duration > 0 && (
            <Group gap="xs">
              <Clock size={14} style={{ color: 'var(--mantine-color-dimmed)' }} />
              <Text size="xs" c="dimmed">
                {formatDuration(duration)}
              </Text>
            </Group>
          )}
          <Text size="xs" c="dimmed">
            {formatDate(transcript.createdAt)}
          </Text>
        </Group>
      </Stack>
    </Card>
  );
}

export default TranscriptCard;

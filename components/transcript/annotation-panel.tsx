/**
 * Annotation Panel Component
 *
 * Displays all annotations for a transcript in a list view.
 * Allows viewing, editing, and deleting annotations.
 */

"use client";

import { useState, useCallback } from "react";
import {
  Stack,
  Card,
  Text,
  Group,
  ActionIcon,
  Tooltip,
  Badge,
  ScrollArea,
  Center,
  Button,
} from "@mantine/core";
import { StickyNote, Trash2, Pencil, Play, Plus } from "lucide-react";
import type { TranscriptAnnotation } from "@/types/annotation";
import { formatAnnotationTimestamp } from "@/types/annotation";
import { AnnotationEditor } from "./annotation-editor";

export interface AnnotationPanelProps {
  /** All annotations for the transcript */
  annotations: TranscriptAnnotation[];
  /** Callback when clicking an annotation (e.g., to seek to timestamp) */
  onAnnotationClick?: (annotation: TranscriptAnnotation) => void;
  /** Callback when updating an annotation */
  onUpdate?: (id: string, text: string) => Promise<void>;
  /** Callback when deleting an annotation */
  onDelete?: (id: string) => Promise<void>;
  /** Callback when adding a new annotation (opens editor with default timestamp) */
  onAddNew?: () => void;
  /** Whether operations are in progress */
  isLoading?: boolean;
  /** Maximum height for the panel */
  maxHeight?: number | string;
}

/**
 * Panel displaying all annotations with editing capabilities.
 */
export function AnnotationPanel({
  annotations,
  onAnnotationClick,
  onUpdate,
  onDelete,
  onAddNew,
  isLoading = false,
  maxHeight = 400,
}: AnnotationPanelProps) {
  const [editingAnnotation, setEditingAnnotation] =
    useState<TranscriptAnnotation | null>(null);

  const handleEdit = useCallback((annotation: TranscriptAnnotation) => {
    setEditingAnnotation(annotation);
  }, []);

  const handleCloseEditor = useCallback(() => {
    setEditingAnnotation(null);
  }, []);

  const handleUpdate = useCallback(
    async (id: string, text: string) => {
      if (onUpdate) {
        await onUpdate(id, text);
      }
    },
    [onUpdate],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      if (onDelete) {
        await onDelete(id);
      }
    },
    [onDelete],
  );

  // Sort annotations by timestamp
  const sortedAnnotations = [...annotations].sort(
    (a, b) => a.timestamp - b.timestamp,
  );

  if (annotations.length === 0) {
    return (
      <Center py="xl">
        <Stack align="center" gap="md">
          <StickyNote
            size={48}
            strokeWidth={1.5}
            color="var(--mantine-color-dimmed)"
          />
          <Text size="sm" c="dimmed" ta="center">
            No annotations yet.
            <br />
            Add notes to specific moments in the transcript.
          </Text>
          {onAddNew && (
            <Button
              variant="light"
              leftSection={<Plus size={16} />}
              onClick={onAddNew}
            >
              Add First Note
            </Button>
          )}
        </Stack>
      </Center>
    );
  }

  return (
    <>
      <Stack gap="xs">
        {/* Header */}
        <Group justify="space-between" px="xs">
          <Group gap="xs">
            <StickyNote size={18} />
            <Text size="sm" fw={600}>
              Annotations
            </Text>
            <Badge size="sm" variant="light" color="cyan">
              {annotations.length}
            </Badge>
          </Group>
          {onAddNew && (
            <Tooltip label="Add new annotation">
              <ActionIcon variant="subtle" onClick={onAddNew}>
                <Plus size={16} />
              </ActionIcon>
            </Tooltip>
          )}
        </Group>

        {/* Annotation List */}
        <ScrollArea.Autosize mah={maxHeight} offsetScrollbars>
          <Stack gap="sm">
            {sortedAnnotations.map((annotation) => (
              <AnnotationCard
                key={annotation.id}
                annotation={annotation}
                onClick={() => onAnnotationClick?.(annotation)}
                onEdit={() => handleEdit(annotation)}
                onDelete={() => handleDelete(annotation.id)}
                showEditActions={!!onUpdate}
                showDeleteAction={!!onDelete}
                isLoading={isLoading}
              />
            ))}
          </Stack>
        </ScrollArea.Autosize>
      </Stack>

      {/* Edit Modal */}
      {editingAnnotation && (
        <AnnotationEditor
          opened={!!editingAnnotation}
          onClose={handleCloseEditor}
          timestamp={editingAnnotation.timestamp}
          annotation={editingAnnotation}
          onSave={async () => {}}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
          isLoading={isLoading}
        />
      )}
    </>
  );
}

/**
 * Props for individual annotation card.
 */
interface AnnotationCardProps {
  annotation: TranscriptAnnotation;
  onClick?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  showEditActions?: boolean;
  showDeleteAction?: boolean;
  isLoading?: boolean;
}

/**
 * Card displaying a single annotation.
 */
function AnnotationCard({
  annotation,
  onClick,
  onEdit,
  onDelete,
  showEditActions = true,
  showDeleteAction = true,
  isLoading = false,
}: AnnotationCardProps) {
  const formattedTime = formatAnnotationTimestamp(annotation.timestamp);
  const createdDate = annotation.createdAt.toLocaleDateString();
  const wasEdited =
    annotation.updatedAt.getTime() !== annotation.createdAt.getTime();

  return (
    <Card
      padding="sm"
      radius="sm"
      withBorder
      style={{
        cursor: onClick ? "pointer" : "default",
        borderLeftColor: "var(--mantine-color-cyan-5)",
        borderLeftWidth: 3,
      }}
      onClick={onClick}
    >
      <Stack gap="xs">
        {/* Header with timestamp and actions */}
        <Group justify="space-between" wrap="nowrap">
          <Group gap="xs">
            <Badge
              size="sm"
              variant="light"
              color="cyan"
              leftSection={<Play size={10} />}
              style={{ cursor: onClick ? "pointer" : "default" }}
            >
              {formattedTime}
            </Badge>
            <Text size="xs" c="dimmed">
              {createdDate}
              {wasEdited && " (edited)"}
            </Text>
          </Group>

          {/* Action buttons */}
          <Group gap={4} wrap="nowrap">
            {showEditActions && onEdit && (
              <Tooltip label="Edit">
                <ActionIcon
                  size="sm"
                  variant="subtle"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit();
                  }}
                  disabled={isLoading}
                  aria-label="Edit annotation"
                >
                  <Pencil size={14} />
                </ActionIcon>
              </Tooltip>
            )}
            {showDeleteAction && onDelete && (
              <Tooltip label="Delete">
                <ActionIcon
                  size="sm"
                  variant="subtle"
                  color="red"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete();
                  }}
                  disabled={isLoading}
                  aria-label="Delete annotation"
                >
                  <Trash2 size={14} />
                </ActionIcon>
              </Tooltip>
            )}
          </Group>
        </Group>

        {/* Annotation text */}
        <Text size="sm" style={{ whiteSpace: "pre-wrap" }}>
          {annotation.text}
        </Text>
      </Stack>
    </Card>
  );
}

/**
 * Compact annotation list for sidebars.
 */
export function CompactAnnotationList({
  annotations,
  onAnnotationClick,
  maxHeight = 300,
}: Pick<
  AnnotationPanelProps,
  "annotations" | "onAnnotationClick" | "maxHeight"
>) {
  if (annotations.length === 0) {
    return (
      <Text size="xs" c="dimmed" ta="center" py="md">
        No annotations
      </Text>
    );
  }

  const sortedAnnotations = [...annotations].sort(
    (a, b) => a.timestamp - b.timestamp,
  );

  return (
    <ScrollArea.Autosize mah={maxHeight} offsetScrollbars>
      <Stack gap="xs">
        {sortedAnnotations.map((annotation) => {
          const formattedTime = formatAnnotationTimestamp(annotation.timestamp);
          const preview =
            annotation.text.length > 60
              ? `${annotation.text.slice(0, 60)}...`
              : annotation.text;

          return (
            <Card
              key={annotation.id}
              padding="xs"
              radius="sm"
              withBorder
              onClick={() => onAnnotationClick?.(annotation)}
              style={{
                cursor: onAnnotationClick ? "pointer" : "default",
                borderLeftColor: "var(--mantine-color-cyan-5)",
                borderLeftWidth: 2,
              }}
            >
              <Group gap="xs" wrap="nowrap">
                <Text
                  size="xs"
                  fw={500}
                  c="cyan"
                  style={{ fontFamily: "var(--mantine-font-family-monospace)" }}
                >
                  {formattedTime}
                </Text>
                <Text size="xs" lineClamp={1}>
                  {preview}
                </Text>
              </Group>
            </Card>
          );
        })}
      </Stack>
    </ScrollArea.Autosize>
  );
}

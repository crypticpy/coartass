/**
 * Annotation Editor Component
 *
 * Modal/popover for creating or editing transcript annotations.
 * Provides a text area for the note content with save/cancel/delete actions.
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Modal,
  Textarea,
  Button,
  Group,
  Stack,
  Text,
  ActionIcon,
  Tooltip,
} from "@mantine/core";
import { Trash2, Save, X } from "lucide-react";
import type { TranscriptAnnotation } from "@/types/annotation";
import { formatAnnotationTimestamp } from "@/types/annotation";

export interface AnnotationEditorProps {
  /** Whether the editor is open */
  opened: boolean;
  /** Callback to close the editor */
  onClose: () => void;
  /** Timestamp in seconds where the annotation is attached */
  timestamp: number;
  /** Existing annotation to edit (undefined for new) */
  annotation?: TranscriptAnnotation;
  /** Callback when saving a new annotation */
  onSave: (text: string) => Promise<void>;
  /** Callback when updating an existing annotation */
  onUpdate?: (id: string, text: string) => Promise<void>;
  /** Callback when deleting an annotation */
  onDelete?: (id: string) => Promise<void>;
  /** Whether an operation is in progress */
  isLoading?: boolean;
}

/**
 * Modal editor for creating or editing annotations.
 */
export function AnnotationEditor({
  opened,
  onClose,
  timestamp,
  annotation,
  onSave,
  onUpdate,
  onDelete,
  isLoading = false,
}: AnnotationEditorProps) {
  const [text, setText] = useState("");
  const isEditing = !!annotation;

  // Initialize text when annotation changes or modal opens
  useEffect(() => {
    if (opened) {
      setText(annotation?.text ?? "");
    }
  }, [opened, annotation]);

  const handleSave = useCallback(async () => {
    const trimmedText = text.trim();
    if (!trimmedText) return;

    if (isEditing && onUpdate && annotation) {
      await onUpdate(annotation.id, trimmedText);
    } else {
      await onSave(trimmedText);
    }
    onClose();
  }, [text, isEditing, onUpdate, annotation, onSave, onClose]);

  const handleDelete = useCallback(async () => {
    if (annotation && onDelete) {
      await onDelete(annotation.id);
      onClose();
    }
  }, [annotation, onDelete, onClose]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Cmd/Ctrl+Enter to save
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        handleSave();
      }
      // Escape to close
      if (e.key === "Escape") {
        onClose();
      }
    },
    [handleSave, onClose],
  );

  const formattedTime = formatAnnotationTimestamp(timestamp);
  const hasChanges = text.trim() !== (annotation?.text ?? "");
  const canSave = text.trim().length > 0 && (hasChanges || !isEditing);

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          <Text fw={600}>{isEditing ? "Edit Note" : "Add Note"}</Text>
          <Text size="sm" c="dimmed">
            at {formattedTime}
          </Text>
        </Group>
      }
      size="md"
      centered
    >
      <Stack gap="md">
        <Textarea
          placeholder="Enter your observation or note about this moment in the transcript..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          minRows={4}
          maxRows={10}
          autosize
          autoFocus
          disabled={isLoading}
          aria-label="Annotation text"
        />

        <Text size="xs" c="dimmed">
          Tip: These notes will be included when you re-analyze the transcript
          or generate a scorecard.
        </Text>

        <Group justify="space-between">
          {/* Delete button (only for existing annotations) */}
          {isEditing && onDelete && (
            <Tooltip label="Delete note">
              <ActionIcon
                variant="subtle"
                color="red"
                onClick={handleDelete}
                disabled={isLoading}
                aria-label="Delete annotation"
              >
                <Trash2 size={18} />
              </ActionIcon>
            </Tooltip>
          )}
          {!isEditing && <div />}

          {/* Save/Cancel buttons */}
          <Group gap="sm">
            <Button
              variant="subtle"
              onClick={onClose}
              disabled={isLoading}
              leftSection={<X size={16} />}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!canSave || isLoading}
              loading={isLoading}
              leftSection={<Save size={16} />}
            >
              {isEditing ? "Update" : "Save"}
            </Button>
          </Group>
        </Group>
      </Stack>
    </Modal>
  );
}

/**
 * Props for the inline annotation editor variant.
 */
export interface InlineAnnotationEditorProps {
  /** Timestamp in seconds */
  timestamp: number;
  /** Callback when saving */
  onSave: (text: string) => Promise<void>;
  /** Callback to cancel */
  onCancel: () => void;
  /** Whether saving is in progress */
  isLoading?: boolean;
}

/**
 * Compact inline annotation editor for embedding in segment items.
 */
export function InlineAnnotationEditor({
  timestamp,
  onSave,
  onCancel,
  isLoading = false,
}: InlineAnnotationEditorProps) {
  const [text, setText] = useState("");

  const handleSave = useCallback(async () => {
    const trimmedText = text.trim();
    if (!trimmedText) return;
    await onSave(trimmedText);
  }, [text, onSave]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        handleSave();
      }
      if (e.key === "Escape") {
        onCancel();
      }
    },
    [handleSave, onCancel],
  );

  const formattedTime = formatAnnotationTimestamp(timestamp);

  return (
    <Stack
      gap="xs"
      p="sm"
      style={{
        backgroundColor: "var(--mantine-color-cyan-light)",
        borderRadius: "var(--mantine-radius-sm)",
        border: "1px solid var(--mantine-color-cyan-4)",
      }}
    >
      <Text size="xs" c="dimmed">
        Add note at {formattedTime}
      </Text>
      <Textarea
        placeholder="Enter your note..."
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        minRows={2}
        maxRows={4}
        autosize
        autoFocus
        disabled={isLoading}
        size="sm"
      />
      <Group gap="xs" justify="flex-end">
        <Button
          size="xs"
          variant="subtle"
          onClick={onCancel}
          disabled={isLoading}
        >
          Cancel
        </Button>
        <Button
          size="xs"
          onClick={handleSave}
          disabled={!text.trim() || isLoading}
          loading={isLoading}
        >
          Save
        </Button>
      </Group>
    </Stack>
  );
}

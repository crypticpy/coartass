/**
 * Recording Preview Component
 *
 * Shows after recording is complete, allowing preview, save, or transcription.
 *
 * Features:
 * - Audio playback preview with native HTML audio controls
 * - Recording metadata display (duration, size, mode, timestamp)
 * - Optional name input for the recording
 * - Save recording to IndexedDB for later use
 * - Discard recording and start over
 * - Transcribe now: saves to IndexedDB then redirects to /upload page
 *   (which handles auto-splitting for long recordings, format conversion, etc.)
 * - Success state after saving with visual feedback
 *
 * Target users: City of Austin field workers who want to save recordings
 * for later transcription or transcribe immediately after recording.
 */

"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Save, Trash2, FileText, Play, Check } from "lucide-react";
import { Paper, Stack, Group, Button, TextInput, Text, Badge, rem, Alert } from "@mantine/core";
import { saveRecording } from "@/lib/db";
import type { RecordingMode } from "@/types/recording";

/**
 * Props for RecordingPreview component
 */
export interface RecordingPreviewProps {
  /** The recorded audio as a Blob */
  audioBlob: Blob;

  /** Object URL for audio playback */
  audioUrl: string;

  /** Recording mode used (microphone, system-audio, or commentary) */
  mode: RecordingMode;

  /** Duration of the recording in seconds */
  duration: number;

  /** Callback after successful save */
  onSave: () => void;

  /** Callback to discard recording and start over */
  onDiscard: () => void;

  /** @deprecated No longer used - transcription redirects to upload page */
  onTranscribe?: () => void;
}

/**
 * Format seconds to MM:SS
 */
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

/**
 * Format bytes to human-readable string (KB/MB)
 */
function formatSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  if (bytes < k) return `${bytes} Bytes`;
  if (bytes < k * k) return `${(bytes / k).toFixed(2)} KB`;
  return `${(bytes / (k * k)).toFixed(2)} MB`;
}

/**
 * Get display label for recording mode
 */
function getModeLabel(mode: RecordingMode): string {
  switch (mode) {
    case "microphone":
      return "Microphone";
    case "system-audio":
      return "System Audio";
    case "commentary":
      return "Commentary";
    default:
      return "Unknown";
  }
}

/**
 * Get Mantine color for recording mode
 */
function getModeColor(mode: RecordingMode): string {
  switch (mode) {
    case "microphone":
      return "aphBlue";
    case "system-audio":
      return "aphGreen";
    case "commentary":
      return "aphCyan";
    default:
      return "gray";
  }
}

/**
 * Recording Preview Component
 *
 * Provides preview and save functionality after recording is complete.
 *
 * @example
 * ```tsx
 * <RecordingPreview
 *   audioBlob={blob}
 *   audioUrl={url}
 *   mode="microphone"
 *   duration={120.5}
 *   onSave={() => {
 *     console.log("Recording saved");
 *     // Navigate to recordings list
 *   }}
 *   onDiscard={() => {
 *     console.log("Recording discarded");
 *     // Reset to recording UI
 *   }}
 *   onTranscribe={() => {
 *     console.log("Navigate to transcription");
 *     // Navigate to upload flow with recording
 *   }}
 * />
 * ```
 */
export function RecordingPreview({
  audioBlob,
  audioUrl,
  mode,
  duration,
  onSave,
  onDiscard,
}: RecordingPreviewProps) {
  const router = useRouter();

  // Component state
  const [recordingName, setRecordingName] = React.useState("");
  const [isSaving, setIsSaving] = React.useState(false);
  const [saveSuccess, setSaveSuccess] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);

  // Calculate metadata from blob
  const fileSize = audioBlob.size;
  const mimeType = audioBlob.type;
  const createdAt = React.useMemo(() => new Date(), []);

  /**
   * Handle save recording to IndexedDB
   */
  const handleSave = React.useCallback(async () => {
    try {
      setIsSaving(true);
      setSaveError(null);

      // Save recording to IndexedDB using lib/db.ts
      await saveRecording({
        blob: audioBlob,
        metadata: {
          mode,
          duration,
          size: fileSize,
          mimeType,
          createdAt,
        },
        status: "saved",
        name: recordingName.trim() || undefined,
      });

      // Show success state
      setSaveSuccess(true);
      setIsSaving(false);

      // Call onSave callback after a brief delay to show success state
      setTimeout(() => {
        onSave();
      }, 1500);
    } catch (error) {
      console.error("Failed to save recording:", error);
      setIsSaving(false);
      setSaveError(
        error instanceof Error
          ? error.message
          : "Failed to save recording. Please try again."
      );
    }
  }, [audioBlob, mode, duration, fileSize, mimeType, createdAt, recordingName, onSave]);

  /**
   * Handle transcribe now - saves first then redirects to upload page
   */
  const handleTranscribeNow = React.useCallback(async () => {
    try {
      setIsSaving(true);
      setSaveError(null);

      // First, save the recording to IndexedDB
      const recordingId = await saveRecording({
        blob: audioBlob,
        metadata: {
          mode,
          duration,
          size: fileSize,
          mimeType,
          createdAt,
        },
        status: "saved",
        name: recordingName.trim() || undefined,
      });

      setIsSaving(false);

      // Navigate to upload page with recording ID
      // The upload page will load this recording and use the full processing pipeline
      // (including auto-splitting for long recordings)
      sessionStorage.setItem("transcribe-recording-id", String(recordingId));
      router.push("/upload?from=recordings");
    } catch (error) {
      console.error("Failed to save recording:", error);
      setIsSaving(false);
      setSaveError(
        error instanceof Error
          ? error.message
          : "Failed to save recording. Please try again."
      );
    }
  }, [audioBlob, mode, duration, fileSize, mimeType, createdAt, recordingName, router]);

  /**
   * Handle discard recording
   */
  const handleDiscard = React.useCallback(() => {
    if (window.confirm("Are you sure you want to discard this recording?")) {
      onDiscard();
    }
  }, [onDiscard]);

  // Show success state after saving
  if (saveSuccess) {
    return (
      <Paper radius="lg" withBorder shadow="sm" p="xl">
        <Stack gap="md" align="center">
          <Group gap="sm">
            <Check
              style={{
                width: rem(48),
                height: rem(48),
                color: "var(--mantine-color-aphGreen-6)",
              }}
            />
          </Group>
          <Stack gap={4} align="center">
            <Text size="xl" fw={600}>
              Recording Saved!
            </Text>
            <Text size="sm" c="dimmed" ta="center">
              Your recording has been saved successfully. You can find it in the Recordings tab.
            </Text>
          </Stack>
        </Stack>
      </Paper>
    );
  }

  return (
    <Stack gap="md">
      {/* Recording Info Card */}
      <Paper radius="lg" withBorder shadow="sm">
        <Stack gap="md" p="md">
          {/* Header */}
          <Group gap="sm" wrap="nowrap">
            <Play
              style={{
                width: rem(20),
                height: rem(20),
                color: `var(--mantine-color-${getModeColor(mode)}-6)`,
              }}
            />
            <Stack gap={2} style={{ flex: 1 }}>
              <Text size="lg" fw={600}>
                Recording Preview
              </Text>
              <Text size="sm" c="dimmed">
                Review your recording before saving or transcribing
              </Text>
            </Stack>
            <Badge
              variant="outline"
              color={getModeColor(mode)}
              fw={600}
              style={{
                background: `var(--mantine-color-${getModeColor(mode)}-0)`,
                borderColor: `var(--mantine-color-${getModeColor(mode)}-3)`,
              }}
            >
              {getModeLabel(mode)}
            </Badge>
          </Group>

          {/* Audio Player */}
          <Stack gap="xs">
            <Text size="sm" fw={500}>
              Playback
            </Text>
            <audio
              controls
              src={audioUrl}
              style={{
                width: "100%",
                borderRadius: "var(--mantine-radius-md)",
              }}
            />
          </Stack>

          {/* Metadata Display */}
          <Group
            gap="md"
            p="sm"
            style={{
              background: "var(--mantine-color-gray-0)",
              borderRadius: "var(--mantine-radius-md)",
            }}
          >
            <Stack gap={2}>
              <Text size="xs" c="dimmed" tt="uppercase" fw={500}>
                Duration
              </Text>
              <Text size="sm" fw={600}>
                {formatTime(duration)}
              </Text>
            </Stack>
            <Stack gap={2}>
              <Text size="xs" c="dimmed" tt="uppercase" fw={500}>
                Size
              </Text>
              <Text size="sm" fw={600}>
                {formatSize(fileSize)}
              </Text>
            </Stack>
            <Stack gap={2}>
              <Text size="xs" c="dimmed" tt="uppercase" fw={500}>
                Recorded At
              </Text>
              <Text size="sm" fw={600}>
                {createdAt.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </Text>
            </Stack>
          </Group>

          {/* Optional Name Input */}
          <TextInput
            label="Recording Name (Optional)"
            placeholder="e.g., Morning Meeting Notes"
            value={recordingName}
            onChange={(event) => setRecordingName(event.currentTarget.value)}
            size="md"
          />
        </Stack>
      </Paper>

      {/* Error Alert */}
      {saveError && (
        <Alert color="red" variant="light">
          {saveError}
        </Alert>
      )}

      {/* Action Buttons */}
      <Stack gap="sm">
        {/* Save Recording Button */}
        <Button
          size="lg"
          onClick={handleSave}
          loading={isSaving}
          fullWidth
          style={{ minHeight: rem(52) }}
          styles={{
            root: {
              background:
                "linear-gradient(to right, var(--mantine-color-aphBlue-6), var(--mantine-color-aphBlue-9))",
              fontWeight: 600,
              "&:hover": {
                transform: "scale(1.02)",
                boxShadow: "var(--mantine-shadow-lg)",
              },
            },
          }}
          data-tour-id="record-save-button"
        >
          <Save style={{ width: rem(20), height: rem(20), marginRight: rem(8) }} />
          Save Recording
        </Button>

        {/* Transcribe Now Button */}
        <Button
          variant="outline"
          size="lg"
          onClick={handleTranscribeNow}
          disabled={isSaving}
          fullWidth
          style={{ minHeight: rem(52) }}
          styles={{
            root: {
              borderColor: "var(--mantine-color-aphGreen-6)",
              color: "var(--mantine-color-aphGreen-6)",
              "&:hover": {
                background: "var(--mantine-color-aphGreen-0)",
              },
            },
          }}
        >
          <FileText style={{ width: rem(20), height: rem(20), marginRight: rem(8) }} />
          Transcribe Now
        </Button>

        {/* Discard Button */}
        <Button
          variant="outline"
          size="lg"
          onClick={handleDiscard}
          disabled={isSaving}
          fullWidth
          style={{ minHeight: rem(44) }}
          color="gray"
        >
          <Trash2 style={{ width: rem(20), height: rem(20), marginRight: rem(8) }} />
          Discard & Start Over
        </Button>
      </Stack>

      {/* Helper Tip */}
      <Alert color="aphCyan" variant="light">
        <Text size="sm">
          <strong>Tip:</strong> Save your recording to access it later from the Recordings tab,
          or transcribe now to convert it to text immediately.
        </Text>
      </Alert>
    </Stack>
  );
}

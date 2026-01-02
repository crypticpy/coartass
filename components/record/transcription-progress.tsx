/**
 * Transcription Progress Component
 *
 * Displays the progress of an ongoing transcription with visual feedback,
 * status messages, and action buttons for cancellation, retry, and navigation.
 *
 * Features:
 * - Circular progress indicator with percentage
 * - Status-specific icons and colors
 * - Multi-stage progress visualization
 * - Cancel button during processing
 * - Retry button on error
 * - View Transcript button on completion
 *
 * Usage:
 * ```tsx
 * <TranscriptionProgress
 *   status="transcribing"
 *   progress={65}
 *   message="Transcribing audio..."
 *   onCancel={() => cancelTranscription()}
 * />
 * ```
 */

"use client";

import * as React from "react";
import {
  Paper,
  Stack,
  Text,
  Button,
  Group,
  RingProgress,
  Box,
  Alert,
  rem,
} from "@mantine/core";
import {
  Check,
  X,
  AlertCircle,
  Loader2,
  FileText,
  Upload,
  Mic,
  Sparkles,
} from "lucide-react";
import type { TranscriptionStatus } from "@/hooks/use-transcription-flow";

/**
 * Props for TranscriptionProgress component
 */
export interface TranscriptionProgressProps {
  /** Current transcription status */
  status: TranscriptionStatus;
  /** Progress percentage (0-100) */
  progress: number;
  /** Status message to display */
  message?: string;
  /** Error message if status is 'error' */
  error?: string;
  /** Callback when cancel button is clicked */
  onCancel?: () => void;
  /** Callback when retry button is clicked */
  onRetry?: () => void;
  /** Callback when view transcript button is clicked */
  onViewTranscript?: () => void;
  /** Callback when done/close button is clicked */
  onDone?: () => void;
}

/**
 * Get the icon for a status
 */
function getStatusIcon(status: TranscriptionStatus) {
  switch (status) {
    case "preparing":
      return <Mic size={24} />;
    case "uploading":
      return <Upload size={24} />;
    case "transcribing":
      return <Sparkles size={24} />;
    case "complete":
      return <Check size={24} />;
    case "error":
      return <AlertCircle size={24} />;
    default:
      return <FileText size={24} />;
  }
}

/**
 * Get the color for a status
 */
function getStatusColor(status: TranscriptionStatus): string {
  switch (status) {
    case "preparing":
    case "uploading":
    case "transcribing":
      return "aphBlue";
    case "complete":
      return "aphGreen";
    case "error":
      return "red";
    default:
      return "gray";
  }
}

/**
 * Get the title for a status
 */
function getStatusTitle(status: TranscriptionStatus): string {
  switch (status) {
    case "preparing":
      return "Preparing Audio";
    case "uploading":
      return "Uploading";
    case "transcribing":
      return "Transcribing";
    case "complete":
      return "Transcription Complete!";
    case "error":
      return "Transcription Failed";
    default:
      return "Processing";
  }
}

/**
 * Transcription Progress Component
 *
 * Shows real-time progress of the transcription process with
 * appropriate visual feedback and action buttons.
 */
export function TranscriptionProgress({
  status,
  progress,
  message,
  error,
  onCancel,
  onRetry,
  onViewTranscript,
  onDone,
}: TranscriptionProgressProps) {
  const color = getStatusColor(status);
  const title = getStatusTitle(status);
  const icon = getStatusIcon(status);

  const isProcessing = status === "preparing" || status === "uploading" || status === "transcribing";
  const isComplete = status === "complete";
  const isError = status === "error";

  return (
    <Paper radius="lg" withBorder shadow="md" p="xl">
      <Stack gap="lg" align="center">
        {/* Progress Ring */}
        <RingProgress
          size={160}
          thickness={12}
          roundCaps
          sections={[{ value: progress, color: `var(--mantine-color-${color}-6)` }]}
          label={
            <Box
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {isProcessing && (
                <Box
                  style={{
                    animation: "spin 1.5s linear infinite",
                  }}
                >
                  <Loader2
                    size={32}
                    style={{ color: `var(--mantine-color-${color}-6)` }}
                  />
                </Box>
              )}
              {isComplete && (
                <Box
                  style={{
                    background: `var(--mantine-color-${color}-6)`,
                    borderRadius: "50%",
                    padding: rem(12),
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Check size={32} style={{ color: "white" }} />
                </Box>
              )}
              {isError && (
                <Box
                  style={{
                    background: "var(--mantine-color-red-6)",
                    borderRadius: "50%",
                    padding: rem(12),
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <X size={32} style={{ color: "white" }} />
                </Box>
              )}
            </Box>
          }
        />

        {/* Status Title */}
        <Stack gap="xs" align="center">
          <Group gap="sm">
            <Box style={{ color: `var(--mantine-color-${color}-6)` }}>{icon}</Box>
            <Text size="xl" fw={600}>
              {title}
            </Text>
          </Group>

          {/* Progress Percentage or Message */}
          {isProcessing && (
            <Text size="lg" c="dimmed" ta="center">
              {message || `${progress}% complete`}
            </Text>
          )}

          {isComplete && message && (
            <Text size="sm" c="dimmed" ta="center">
              {message}
            </Text>
          )}
        </Stack>

        {/* Progress Stages */}
        {isProcessing && (
          <Group gap="md" justify="center">
            <StageIndicator
              label="Prepare"
              isActive={status === "preparing"}
              isComplete={status !== "preparing"}
            />
            <Box style={{ width: 20, height: 2, background: "var(--mantine-color-gray-3)" }} />
            <StageIndicator
              label="Upload"
              isActive={status === "uploading"}
              isComplete={status === "transcribing"}
            />
            <Box style={{ width: 20, height: 2, background: "var(--mantine-color-gray-3)" }} />
            <StageIndicator
              label="Transcribe"
              isActive={status === "transcribing"}
              isComplete={false}
            />
          </Group>
        )}

        {/* Error Alert */}
        {isError && error && (
          <Alert color="red" variant="light" icon={<AlertCircle size={16} />} w="100%">
            {error}
          </Alert>
        )}

        {/* Action Buttons */}
        <Group gap="sm" justify="center" mt="md">
          {isProcessing && onCancel && (
            <Button variant="outline" color="gray" onClick={onCancel}>
              Cancel
            </Button>
          )}

          {isError && (
            <>
              {onRetry && (
                <Button color="red" variant="light" onClick={onRetry}>
                  Try Again
                </Button>
              )}
              {onDone && (
                <Button variant="outline" color="gray" onClick={onDone}>
                  Go Back
                </Button>
              )}
            </>
          )}

          {isComplete && (
            <>
              {onViewTranscript && (
                <Button
                  color={color}
                  leftSection={<FileText size={18} />}
                  onClick={onViewTranscript}
                >
                  View Transcript
                </Button>
              )}
              {onDone && (
                <Button variant="outline" color="gray" onClick={onDone}>
                  Record Another
                </Button>
              )}
            </>
          )}
        </Group>
      </Stack>

      {/* CSS Animations */}
      <style jsx global>{`
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </Paper>
  );
}

/**
 * Stage Indicator Component
 *
 * Small indicator showing the status of a transcription stage
 */
function StageIndicator({
  label,
  isActive,
  isComplete,
}: {
  label: string;
  isActive: boolean;
  isComplete: boolean;
}) {
  const color = isComplete
    ? "aphGreen"
    : isActive
    ? "aphBlue"
    : "gray";

  return (
    <Stack gap={4} align="center">
      <Box
        style={{
          width: rem(24),
          height: rem(24),
          borderRadius: "50%",
          background: isComplete
            ? `var(--mantine-color-${color}-6)`
            : isActive
            ? `var(--mantine-color-${color}-1)`
            : "var(--mantine-color-gray-2)",
          border: isActive
            ? `2px solid var(--mantine-color-${color}-6)`
            : "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {isComplete && <Check size={14} style={{ color: "white" }} />}
        {isActive && (
          <Box
            style={{
              width: rem(8),
              height: rem(8),
              borderRadius: "50%",
              background: `var(--mantine-color-${color}-6)`,
            }}
          />
        )}
      </Box>
      <Text size="xs" c={isActive || isComplete ? "dimmed" : "gray.4"} fw={isActive ? 600 : 400}>
        {label}
      </Text>
    </Stack>
  );
}

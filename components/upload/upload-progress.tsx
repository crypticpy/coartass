/**
 * Upload Progress Component
 *
 * Displays real-time upload and transcription progress with:
 * - Animated progress bar
 * - Status indicators with icons
 * - Percentage display
 * - Status messages
 * - Optional cancel button
 */

"use client";

import * as React from "react";
import { CheckCircle2, XCircle, Loader2, Upload, FileAudio, AlertCircle } from "lucide-react";
import { Progress, Button, Alert, Box, Group, Text, Stack, rem } from "@mantine/core";
import type { TranscriptionProgress } from "@/types/transcript";

/**
 * Props for UploadProgress component
 */
export interface UploadProgressProps {
  /** Current progress state */
  progress: TranscriptionProgress;
  /** Optional cancel handler */
  onCancel?: () => void;
  /** Whether cancel button should be shown */
  showCancel?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Status configuration with icons and Austin brand colors
 */
const STATUS_CONFIG = {
  processing: {
    icon: FileAudio,
    label: "Processing",
    color: "aphBlue",
    description: "Processing audio file...",
    step: 1,
  },
  uploading: {
    icon: Upload,
    label: "Uploading",
    color: "aphCyan",
    description: "Uploading file to server...",
    step: 2,
  },
  transcribing: {
    icon: Loader2,
    label: "Transcribing",
    color: "aphPurple",
    description: "Transcribing audio with AI...",
    step: 3,
  },
  complete: {
    icon: CheckCircle2,
    label: "Complete",
    color: "aphGreen",
    description: "Transcription completed successfully!",
    step: 4,
  },
  error: {
    icon: XCircle,
    label: "Error",
    color: "red",
    description: "An error occurred during transcription.",
    step: 0,
  },
} as const;

/**
 * Calculate estimated time remaining based on progress
 *
 * @param progress - Current progress percentage
 * @param elapsedTime - Time elapsed in milliseconds
 * @returns Formatted time remaining string
 */
function calculateTimeRemaining(progress: number, elapsedTime: number): string {
  if (progress === 0 || progress === 100) return "";

  const totalTime = (elapsedTime / progress) * 100;
  const remaining = totalTime - elapsedTime;
  const seconds = Math.ceil(remaining / 1000);

  if (seconds < 60) {
    return `~${seconds}s remaining`;
  } else {
    const minutes = Math.ceil(seconds / 60);
    return `~${minutes}m remaining`;
  }
}

/**
 * Upload Progress Component
 *
 * Displays a comprehensive progress indicator for file upload and transcription.
 * Shows current status, progress percentage, and optional cancel button.
 *
 * @example
 * ```tsx
 * <UploadProgress
 *   progress={{
 *     status: 'transcribing',
 *     progress: 75,
 *     message: 'Processing your audio...'
 *   }}
 *   onCancel={() => console.log('Upload cancelled')}
 *   showCancel={true}
 * />
 * ```
 */
export function UploadProgress({
  progress,
  onCancel,
  showCancel = false,
  className,
}: UploadProgressProps) {
  const startTimeRef = React.useRef<number | null>(null);
  const [elapsedTime, setElapsedTime] = React.useState(0);

  // Update elapsed time every second
  React.useEffect(() => {
    if (progress.status === 'complete' || progress.status === 'error') {
      return;
    }

    // Initialize start time on first effect run
    if (startTimeRef.current === null) {
      startTimeRef.current = Date.now();
    }

    const interval = setInterval(() => {
      if (startTimeRef.current !== null) {
        setElapsedTime(Date.now() - startTimeRef.current);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [progress.status]);

  const config = STATUS_CONFIG[progress.status];
  const Icon = config.icon;
  const isAnimating = progress.status === 'uploading' ||
                      progress.status === 'processing' ||
                      progress.status === 'transcribing';

  const currentStep = config.step;
  const stages = [
    { key: 'processing', config: STATUS_CONFIG.processing },
    { key: 'uploading', config: STATUS_CONFIG.uploading },
    { key: 'transcribing', config: STATUS_CONFIG.transcribing },
    { key: 'complete', config: STATUS_CONFIG.complete },
  ];

  return (
    <Stack gap="xl" className={className}>
      {/* Status Header */}
      <Group justify="space-between" wrap="nowrap">
        <Group gap="md">
          <Box
            style={{
              borderRadius: '50%',
              padding: rem(10),
              background: `var(--mantine-color-${config.color}-0)`,
              boxShadow: 'var(--mantine-shadow-sm)',
            }}
          >
            <Icon
              style={{
                width: rem(20),
                height: rem(20),
                color: `var(--mantine-color-${config.color}-6)`,
                ...(progress.status === 'transcribing' && {
                  animation: 'spin 1s linear infinite',
                }),
              }}
            />
          </Box>
          <Stack gap={4}>
            <Text fw={600} size="lg">
              {config.label}
            </Text>
            <Text size="sm" c="dimmed">
              {progress.message || config.description}
            </Text>
          </Stack>
        </Group>

        {/* Cancel Button */}
        {showCancel && onCancel && progress.status !== 'complete' && progress.status !== 'error' && (
          <Button
            variant="subtle"
            color="red"
            size="sm"
            onClick={onCancel}
            aria-label="Cancel upload"
            styles={{
              root: {
                '&:hover': {
                  background: 'var(--mantine-color-red-0)',
                },
              },
            }}
          >
            Cancel
          </Button>
        )}
      </Group>

      {/* Multi-Stage Progress Indicator */}
      {progress.status !== 'error' && (
        <Box style={{ position: 'relative' }}>
          {/* Connection Lines */}
          <Box
            style={{
              position: 'absolute',
              top: rem(20),
              left: 0,
              right: 0,
              height: rem(2),
              background: 'linear-gradient(to right, var(--mantine-color-aphBlue-1), var(--mantine-color-aphBlue-2), var(--mantine-color-aphGreen-1))',
              opacity: 0.2,
            }}
          />

          {/* Stages */}
          <Group justify="space-between" style={{ position: 'relative' }}>
            {stages.map((stage) => {
              const StageIcon = stage.config.icon;
              const isComplete = currentStep > stage.config.step;
              const isCurrent = currentStep === stage.config.step;
              const isUpcoming = currentStep < stage.config.step;

              return (
                <Stack key={stage.key} align="center" gap="xs" style={{ flex: 1 }}>
                  {/* Stage Circle */}
                  <Box
                    style={{
                      position: 'relative',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: '50%',
                      borderWidth: rem(2),
                      borderStyle: 'solid',
                      width: rem(40),
                      height: rem(40),
                      transition: 'all 300ms ease',
                      ...(isComplete && {
                        background: 'linear-gradient(to bottom right, var(--mantine-color-aphGreen-1), var(--mantine-color-aphBlue-1))',
                        borderColor: 'var(--mantine-color-aphGreen-6)',
                        boxShadow: 'var(--mantine-shadow-md)',
                      }),
                      ...(isCurrent && {
                        background: `var(--mantine-color-${stage.config.color}-0)`,
                        borderColor: `var(--mantine-color-${stage.config.color}-6)`,
                        borderWidth: rem(2),
                        boxShadow: 'var(--mantine-shadow-lg)',
                        animation: 'pulse 1.5s ease-in-out infinite',
                      }),
                      ...(isUpcoming && {
                        background: 'var(--mantine-color-gray-0)',
                        borderColor: 'var(--mantine-color-gray-3)',
                      }),
                    }}
                  >
                    {isComplete ? (
                      <CheckCircle2 style={{ width: rem(20), height: rem(20) }} color="var(--mantine-color-aphGreen-6)" />
                    ) : (
                      <StageIcon
                        style={{
                          width: rem(16),
                          height: rem(16),
                          color: isCurrent
                            ? `var(--mantine-color-${stage.config.color}-6)`
                            : 'var(--mantine-color-dimmed)',
                          ...(isCurrent && stage.key === 'transcribing' && {
                            animation: 'spin 1s linear infinite',
                          }),
                        }}
                      />
                    )}
                  </Box>

                  {/* Stage Label */}
                  <Text
                    size="xs"
                    ta="center"
                    fw={500}
                    style={{
                      transition: 'color 300ms ease',
                      color: isComplete
                        ? 'var(--mantine-color-aphGreen-6)'
                        : isCurrent
                        ? `var(--mantine-color-${stage.config.color}-6)`
                        : 'var(--mantine-color-dimmed)',
                    }}
                  >
                    {stage.config.label}
                  </Text>
                </Stack>
              );
            })}
          </Group>
        </Box>
      )}

      {/* Progress Bar */}
      {progress.status !== 'error' && (
        <Stack gap="xs">
          <Progress
            value={progress.progress}
            size="md"
            radius="md"
            color={config.color}
            animated={isAnimating}
            aria-label={`Upload progress: ${progress.progress}%`}
          />
          <Group justify="space-between">
            <Text
              size="sm"
              fw={500}
              style={{ color: `var(--mantine-color-${config.color}-6)` }}
            >
              {progress.progress}%
            </Text>
            {isAnimating && progress.progress > 0 && progress.progress < 100 && (
              <Text size="sm" c="dimmed">
                {calculateTimeRemaining(progress.progress, elapsedTime)}
              </Text>
            )}
          </Group>
        </Stack>
      )}

      {/* Error Alert */}
      {progress.status === 'error' && progress.error && (
        <Alert
          color="red"
          variant="light"
          icon={<AlertCircle style={{ width: rem(16), height: rem(16) }} />}
          style={{
            animation: 'fadeIn 0.3s ease-out',
            borderLeft: `${rem(4)} solid var(--mantine-color-red-6)`,
          }}
        >
          {progress.error}
        </Alert>
      )}

      {/* Success Message */}
      {progress.status === 'complete' && (
        <Alert
          color="aphGreen"
          variant="light"
          icon={<CheckCircle2 style={{ width: rem(16), height: rem(16) }} />}
          style={{
            animation: 'fadeIn 0.3s ease-out',
            borderLeft: `${rem(4)} solid var(--mantine-color-aphGreen-6)`,
            background: 'linear-gradient(to right, var(--mantine-color-aphGreen-0), var(--mantine-color-aphGreen-1))',
            boxShadow: 'var(--mantine-shadow-sm)',
          }}
        >
          <Text fw={500} style={{ color: 'var(--mantine-color-aphGreen-7)' }}>
            {progress.message || config.description}
          </Text>
        </Alert>
      )}
    </Stack>
  );
}

/**
 * Compact variant of UploadProgress for inline display
 */
export interface CompactUploadProgressProps {
  /** Current progress state */
  progress: TranscriptionProgress;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Compact Upload Progress Component
 *
 * Minimal progress indicator for space-constrained layouts.
 *
 * @example
 * ```tsx
 * <CompactUploadProgress
 *   progress={{
 *     status: 'uploading',
 *     progress: 45
 *   }}
 * />
 * ```
 */
export function CompactUploadProgress({
  progress,
  className,
}: CompactUploadProgressProps) {
  const config = STATUS_CONFIG[progress.status];
  const Icon = config.icon;

  return (
    <Group gap="md" className={className} wrap="nowrap">
      <Icon
        style={{
          width: rem(16),
          height: rem(16),
          flexShrink: 0,
          color: `var(--mantine-color-${config.color}-6)`,
          ...(progress.status === 'transcribing' && {
            animation: 'spin 1s linear infinite',
          }),
        }}
      />
      <Stack gap={4} style={{ flex: 1 }}>
        <Group justify="space-between">
          <Text size="xs" fw={500}>
            {config.label}
          </Text>
          <Text
            size="xs"
            fw={500}
            style={{ color: `var(--mantine-color-${config.color}-6)` }}
          >
            {progress.progress}%
          </Text>
        </Group>
        <Progress
          value={progress.progress}
          size="sm"
          radius="sm"
          color={config.color}
        />
      </Stack>
    </Group>
  );
}

/**
 * Recording Interface Component
 *
 * Main recording UI displayed during active recording sessions.
 * Integrates useRecording and useAudioSources hooks to manage the complete
 * recording lifecycle from permission request to final audio capture.
 *
 * Features:
 * - Large circular recording indicator with pulsing animation
 * - Real-time duration timer in MM:SS format
 * - Recording mode badge showing current mode
 * - Full recording controls: Pause/Resume, Stop, Discard
 * - Simple audio level visualization
 * - Comprehensive error handling with retry capabilities
 * - Preparing state for permission requests
 * - Smooth state transitions with visual feedback
 *
 * This component follows the patterns established in voice-recorder.tsx
 * but uses the more advanced useRecording and useAudioSources hooks
 * for multi-mode recording support.
 */

"use client";

import * as React from "react";
import { Pause, Play, Square, Trash2, Mic, AlertCircle } from "lucide-react";
import {
  Paper,
  Button,
  ActionIcon,
  Group,
  Stack,
  Text,
  Badge,
  Alert,
  Box,
  rem,
  Loader,
} from "@mantine/core";
import { useRecording } from "@/hooks/use-recording";
import { useAudioSources } from "@/hooks/use-audio-sources";
import { useAudioAmplitude } from "@/hooks/use-audio-amplitude";
import type { RecordingMode } from "@/types/recording";

/**
 * Recording completion data passed to onComplete callback
 */
export interface RecordingCompleteData {
  /** The recorded audio blob */
  blob: Blob;
  /** Duration of the recording in seconds */
  duration: number;
}

/**
 * Props for RecordingInterface component
 */
export interface RecordingInterfaceProps {
  /** Recording mode to use (microphone, system-audio, or commentary) */
  mode: RecordingMode;

  /** Callback when recording is successfully completed with recording data */
  onComplete: (data: RecordingCompleteData) => void;

  /** Callback when recording is discarded */
  onDiscard: () => void;
}

/**
 * Format seconds to MM:SS display format
 */
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
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
 * Get color for recording mode badge
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
 * Get timer color based on recording duration
 * - Normal: default color (under 25 minutes)
 * - Caution: yellow (25-30 minutes)
 * - Warning: orange (over 30 minutes)
 */
function getTimerColor(seconds: number): string | undefined {
  const minutes = seconds / 60;
  if (minutes >= 30) return "orange";
  if (minutes >= 25) return "yellow";
  return undefined; // default color
}

/**
 * Recording Interface Component
 *
 * Provides a full-featured recording interface with visual feedback,
 * recording controls, and error handling.
 *
 * @example
 * ```tsx
 * <RecordingInterface
 *   mode="commentary"
 *   onComplete={() => console.log("Recording complete")}
 *   onDiscard={() => console.log("Recording discarded")}
 * />
 * ```
 */
export function RecordingInterface({
  mode,
  onComplete,
  onDiscard,
}: RecordingInterfaceProps) {
  // Duration warning state
  const [durationWarningShown, setDurationWarningShown] = React.useState(false);

  // Recording state management
  const recording = useRecording({
    onRecordingComplete: (blob) => {
      console.log("Recording complete:", blob);
      // Pass blob and duration to parent for handling
      onComplete({ blob, duration: recording.duration });
    },
    onError: (error) => {
      console.error("Recording error:", error);
    },
    onDurationWarning: (minutes) => {
      setDurationWarningShown(true);
      console.log(`Duration warning: ${minutes} minutes`);
    },
  });

  // Audio source management
  const audioSources = useAudioSources();

  // Audio amplitude analysis for real-time visualization
  const { amplitudes, averageLevel, startAnalysis, stopAnalysis, isAnalysing } = useAudioAmplitude({
    fftSize: 64, // 32 frequency bins
    smoothingTimeConstant: 0.4, // More responsive to quick changes
  });

  // Ready state - user must click "Start Recording" to begin
  const [isReady, setIsReady] = React.useState(true);

  /**
   * Start the complete recording flow
   */
  const startRecordingFlow = React.useCallback(async () => {
    try {
      // Select the recording mode
      recording.selectMode(mode);

      // Request the appropriate audio stream for this mode
      const stream = await audioSources.requestStreamForMode(mode);

      // Start recording with the obtained stream
      recording.startRecordingWithStream(stream);
    } catch (err) {
      console.error("Failed to start recording:", err);
      // Error will be captured in recording.error and audioSources.error
    }
  }, [mode, recording, audioSources]);

  /**
   * Handle user clicking "Start Recording" button
   */
  const handleStart = React.useCallback(() => {
    setIsReady(false);
    startRecordingFlow();
  }, [startRecordingFlow]);

  /**
   * Start/stop amplitude analysis based on active streams
   * When recording starts, we analyze the first active stream for visualization
   */
  const isActivelyRecording = recording.state === "recording";
  React.useEffect(() => {
    if (isActivelyRecording && audioSources.activeStreams.length > 0 && !isAnalysing) {
      // Start analyzing the first active stream
      startAnalysis(audioSources.activeStreams[0]);
    } else if (!isActivelyRecording && isAnalysing) {
      // Stop analysis when recording stops
      stopAnalysis();
    }
  }, [isActivelyRecording, audioSources.activeStreams, isAnalysing, startAnalysis, stopAnalysis]);

  /**
   * Cleanup on unmount - stop streams and discard recording
   * Prevents media streams from running after component unmounts
   */
  React.useEffect(() => {
    const recordingRef = recording;
    const audioSourcesRef = audioSources;
    const stopAnalysisRef = stopAnalysis;
    return () => {
      // Stop amplitude analysis
      stopAnalysisRef();
      // Only cleanup if we haven't completed successfully
      if (recordingRef.state !== 'completed') {
        audioSourcesRef.stopAllStreams();
        recordingRef.discardRecording();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Reset duration warning when recording stops
   */
  React.useEffect(() => {
    if (recording.state === "idle") {
      setDurationWarningShown(false);
    }
  }, [recording.state]);

  /**
   * Handle retry after error
   */
  const handleRetry = React.useCallback(() => {
    // Reset both hooks
    recording.reset();
    audioSources.stopAllStreams();

    // Restart the recording flow
    startRecordingFlow();
  }, [recording, audioSources, startRecordingFlow]);

  /**
   * Handle discard action
   */
  const handleDiscard = React.useCallback(() => {
    // Stop all streams
    audioSources.stopAllStreams();

    // Discard the recording
    recording.discardRecording();

    // Notify parent
    onDiscard();
  }, [recording, audioSources, onDiscard]);

  /**
   * Handle pause action
   */
  const handlePause = React.useCallback(() => {
    recording.pauseRecording();
  }, [recording]);

  /**
   * Handle resume action
   */
  const handleResume = React.useCallback(() => {
    recording.resumeRecording();
  }, [recording]);

  /**
   * Handle stop action
   */
  const handleStop = React.useCallback(() => {
    recording.stopRecording();
    audioSources.stopAllStreams();
  }, [recording, audioSources]);

  // Determine if we're in an error state
  const hasError = recording.error || audioSources.error;
  const errorMessage = recording.error?.message || audioSources.error?.message;

  // Determine current state for UI rendering
  const isPreparing = recording.state === "preparing";
  const isRecording = recording.state === "recording";
  const isPaused = recording.state === "paused";
  const isCompleted = recording.state === "completed";
  const isError = recording.state === "error" || hasError;

  return (
    <Stack gap="md">
      {/* Main Recording Interface */}
      <Paper radius="lg" withBorder shadow="md" p="xl">
        <Stack gap="lg" align="center">
          {/* Recording Mode Badge */}
          <Badge
            size="lg"
            variant="light"
            color={getModeColor(mode)}
            leftSection={<Mic size={14} />}
          >
            {getModeLabel(mode)}
          </Badge>

          {/* Circular Recording Indicator */}
          <Box style={{ position: "relative" }}>
            {/* Animated waveform visualization - only show when actively recording */}
            {isRecording && (
              <Box
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {[...Array(24)].map((_, i) => {
                  const angle = (i * 360) / 24;
                  // Use real amplitude data from the analyzer
                  // Map 24 bars to the available amplitude bins
                  const binIndex = Math.floor((i / 24) * amplitudes.length);
                  const amplitudeValue = amplitudes[binIndex] || 0;
                  // Boost low values for better visibility (apply curve)
                  const boosted = Math.pow(amplitudeValue / 255, 0.6) * 255;
                  // Scale amplitude to bar height (8-60px for more dramatic effect)
                  const barHeight = 8 + (boosted / 255) * 52;
                  return (
                    <Box
                      key={i}
                      style={{
                        position: "absolute",
                        background: `linear-gradient(to top, var(--mantine-color-${getModeColor(mode)}-6), var(--mantine-color-${getModeColor(mode)}-4))`,
                        borderRadius: rem(999),
                        width: rem(5),
                        height: rem(barHeight),
                        transform: `rotate(${angle}deg) translateY(-85px)`,
                        transformOrigin: "center",
                        transition: "height 30ms ease-out",
                        opacity: 0.6 + (boosted / 255) * 0.4,
                      }}
                    />
                  );
                })}
              </Box>
            )}

            {/* Center Circle with Timer or Status */}
            <Box
              style={{
                position: "relative",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: "50%",
                borderWidth: rem(6),
                borderStyle: "solid",
                width: rem(200),
                height: rem(200),
                transition: "all 300ms ease",
                ...(isReady && {
                  borderColor: "var(--mantine-color-aphGreen-6)",
                  background: "linear-gradient(to bottom right, var(--mantine-color-aphGreen-0), var(--mantine-color-aphGreen-1))",
                }),
                ...(!isReady && isPreparing && {
                  borderColor: "var(--mantine-color-gray-3)",
                  background: "var(--mantine-color-gray-0)",
                }),
                ...(isRecording && {
                  borderColor: `var(--mantine-color-${getModeColor(mode)}-6)`,
                  background: `linear-gradient(to bottom right, var(--mantine-color-${getModeColor(mode)}-0), var(--mantine-color-${getModeColor(mode)}-1))`,
                  boxShadow: `0 10px 30px -5px var(--mantine-color-${getModeColor(mode)}-3)`,
                }),
                ...(isPaused && {
                  borderColor: "var(--mantine-color-gray-4)",
                  background: "var(--mantine-color-gray-0)",
                }),
                ...(isCompleted && {
                  borderColor: "var(--mantine-color-aphGreen-6)",
                  background:
                    "linear-gradient(to bottom right, var(--mantine-color-aphGreen-0), var(--mantine-color-aphGreen-1))",
                  boxShadow: "0 10px 30px -5px var(--mantine-color-aphGreen-3)",
                }),
                ...(isError && {
                  borderColor: "var(--mantine-color-red-6)",
                  background: "var(--mantine-color-red-0)",
                }),
              }}
            >
              {/* Animated ring for active recording */}
              {isRecording && (
                <Box
                  style={{
                    position: "absolute",
                    inset: rem(-6),
                    borderRadius: "50%",
                    borderWidth: rem(6),
                    borderStyle: "solid",
                    borderColor: `var(--mantine-color-${getModeColor(mode)}-6)`,
                    animation: "ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite",
                    opacity: 0.3,
                  }}
                />
              )}

              {/* Content based on state */}
              <Stack gap={4} align="center" style={{ zIndex: 10 }}>
                {/* Ready state - waiting for user to start */}
                {isReady && (
                  <>
                    <Text
                      size={rem(42)}
                      fw={700}
                      style={{
                        fontFamily: "var(--mantine-font-family-monospace)",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      00:00
                    </Text>
                    <Text
                      size="xs"
                      c="dimmed"
                      fw={600}
                      tt="uppercase"
                      style={{ letterSpacing: rem(1.2) }}
                    >
                      Ready
                    </Text>
                  </>
                )}

                {/* Preparing state - requesting permissions */}
                {!isReady && isPreparing && (
                  <>
                    <Loader size="lg" color="gray" />
                    <Text size="sm" c="dimmed" fw={500} mt="md">
                      Preparing...
                    </Text>
                  </>
                )}

                {(isRecording || isPaused || isCompleted) && (
                  <>
                    <Text
                      size={rem(42)}
                      fw={700}
                      c={getTimerColor(recording.duration)}
                      style={{
                        fontFamily: "var(--mantine-font-family-monospace)",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {formatTime(recording.duration)}
                    </Text>
                    <Text
                      size="xs"
                      c="dimmed"
                      fw={600}
                      tt="uppercase"
                      style={{ letterSpacing: rem(1.2) }}
                    >
                      {isRecording && "Recording"}
                      {isPaused && "Paused"}
                      {isCompleted && "Complete"}
                    </Text>
                    {durationWarningShown && (
                      <Badge
                        size="sm"
                        color="orange"
                        variant="light"
                        leftSection={<AlertCircle size={12} />}
                      >
                        Long recording
                      </Badge>
                    )}
                  </>
                )}

                {isError && (
                  <>
                    <AlertCircle size={40} color="var(--mantine-color-red-6)" />
                    <Text size="sm" c="red" fw={600} mt="md" ta="center">
                      Error
                    </Text>
                  </>
                )}
              </Stack>
            </Box>
          </Box>

          {/* LED-Style VU Meter */}
          {isRecording && (
            <Box style={{ width: "100%", maxWidth: 280, margin: "0 auto" }}>
              <Group gap={3} justify="center">
                {[...Array(15)].map((_, i) => {
                  const threshold = (i + 1) / 15;
                  const isActive = averageLevel >= threshold;
                  // Color zones: 0-60% green, 60-80% yellow, 80-100% red
                  const color = i < 9 ? "aphGreen" : i < 12 ? "yellow" : "red";
                  return (
                    <Box
                      key={i}
                      style={{
                        width: rem(14),
                        height: rem(24),
                        borderRadius: rem(3),
                        background: isActive
                          ? `var(--mantine-color-${color}-6)`
                          : "var(--mantine-color-gray-3)",
                        boxShadow: isActive
                          ? `0 0 6px var(--mantine-color-${color}-4)`
                          : "none",
                        transition: "all 50ms ease-out",
                      }}
                    />
                  );
                })}
              </Group>
              <Text size="xs" c="dimmed" ta="center" mt={8}>
                Audio Level
              </Text>
            </Box>
          )}

          {/* Status Text */}
          <Text size="sm" c="dimmed" ta="center">
            {isReady && "Click Start Recording when ready"}
            {!isReady && isPreparing && "Getting ready to record..."}
            {isRecording && "Recording in progress"}
            {isPaused && "Recording is paused"}
            {isCompleted && "Recording finished successfully"}
            {isError && "An error occurred"}
          </Text>

          {/* Control Buttons */}
          <Group gap="sm" justify="center" w="100%" data-tour-id="record-controls">
            {/* Ready State - Start Recording Button */}
            {isReady && (
              <Button
                size="lg"
                color="aphGreen"
                leftSection={<Play size={20} />}
                onClick={handleStart}
                style={{ minWidth: rem(200) }}
                data-tour-id="record-start-button"
              >
                Start Recording
              </Button>
            )}

            {/* Recording State - Pause and Stop */}
            {isRecording && (
              <>
                <Button
                  variant="light"
                  size="lg"
                  leftSection={<Pause size={20} />}
                  onClick={handlePause}
                  color={getModeColor(mode)}
                  style={{ minWidth: rem(140) }}
                >
                  Pause
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  leftSection={<Square size={20} />}
                  onClick={handleStop}
                  color="gray"
                  style={{ minWidth: rem(140) }}
                >
                  Stop
                </Button>
              </>
            )}

            {/* Paused State - Resume and Stop */}
            {isPaused && (
              <>
                <Button
                  size="lg"
                  leftSection={<Play size={20} />}
                  onClick={handleResume}
                  color={getModeColor(mode)}
                  style={{ minWidth: rem(140) }}
                >
                  Resume
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  leftSection={<Square size={20} />}
                  onClick={handleStop}
                  color="gray"
                  style={{ minWidth: rem(140) }}
                >
                  Finish
                </Button>
              </>
            )}

            {/* Always show discard button when recording or paused */}
            {(isRecording || isPaused) && (
              <ActionIcon
                variant="subtle"
                size="xl"
                color="red"
                onClick={handleDiscard}
                aria-label="Discard recording"
              >
                <Trash2 size={20} />
              </ActionIcon>
            )}
          </Group>
        </Stack>
      </Paper>

      {/* Error Alert with Retry */}
      {isError && errorMessage && (
        <Alert
          color="red"
          variant="light"
          title="Recording Error"
          icon={<AlertCircle size={20} />}
        >
          <Stack gap="sm">
            <Text size="sm">{errorMessage}</Text>
            <Group gap="sm">
              <Button size="sm" variant="light" color="red" onClick={handleRetry}>
                Retry
              </Button>
              <Button size="sm" variant="subtle" color="gray" onClick={handleDiscard}>
                Cancel
              </Button>
            </Group>
          </Stack>
        </Alert>
      )}

      {/* Helper Tips */}
      {(isReady || (!isReady && isPreparing)) && !isError && (
        <Alert color={getModeColor(mode)} variant="light">
          <Text size="sm">
            <strong>Tip:</strong>{" "}
            {mode === "microphone" &&
              "Find a quiet location and speak clearly toward your device."}
            {mode === "system-audio" &&
              'Make sure to check "Share audio" in the browser dialog when prompted.'}
            {mode === "commentary" &&
              "You'll be prompted for both system audio and microphone access."}
          </Text>
        </Alert>
      )}

      {/* CSS Animations */}
      <style jsx global>{`
        @keyframes pulse {
          0%, 100% {
            opacity: 0.6;
            transform: scale(1);
          }
          50% {
            opacity: 1;
            transform: scale(1.05);
          }
        }

        @keyframes ping {
          0% {
            transform: scale(1);
            opacity: 0.3;
          }
          75%, 100% {
            transform: scale(1.2);
            opacity: 0;
          }
        }
      `}</style>
    </Stack>
  );
}

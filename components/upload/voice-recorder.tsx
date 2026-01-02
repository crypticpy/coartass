/**
 * Voice Recorder Component
 *
 * In-browser audio recording for field workers using MediaRecorder API.
 * Optimized for mobile devices with large touch targets and simple controls.
 *
 * Features:
 * - Record audio directly in browser (no external app needed)
 * - Visual recording indicator and timer
 * - Simple audio visualization (waveform bars)
 * - Pause/resume functionality
 * - Mobile-optimized with 48px+ touch targets
 * - Error handling for permissions and browser compatibility
 * - Export as Blob for immediate upload
 *
 * Target users: City of Austin field workers (inspectors, health workers)
 */

"use client";

import * as React from "react";
import { Mic, Square, Pause, Play, Trash2, Check } from "lucide-react";
import { Button, Card, Alert, Badge, Box, Group, Text, Stack, rem } from "@mantine/core";

// Pre-generated random heights for waveform visualization (module-level to avoid impure function in render)
const WAVEFORM_HEIGHTS = [32, 18, 41, 26, 19, 38, 23, 45, 17, 33, 28, 21, 39, 15, 36, 24, 43, 20, 31, 27, 16, 42, 22, 37];

/**
 * Props for VoiceRecorder component
 */
export interface VoiceRecorderProps {
  /** Callback when recording is complete and ready to upload */
  onRecordingComplete: (blob: Blob, duration: number) => void;
  /** Callback when recording is cancelled */
  onCancel?: () => void;
  /** Whether the recorder is disabled */
  disabled?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Recording state
 */
type RecordingState = "idle" | "recording" | "paused" | "completed";

/**
 * Format seconds to MM:SS
 */
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

/**
 * Voice Recorder Component
 *
 * Provides in-browser audio recording with simple, mobile-friendly controls.
 *
 * @example
 * ```tsx
 * <VoiceRecorder
 *   onRecordingComplete={(blob, duration) => {
 *     console.log("Recording ready:", blob, duration);
 *     // Upload the blob
 *   }}
 *   onCancel={() => console.log("Recording cancelled")}
 * />
 * ```
 */
export function VoiceRecorder({
  onRecordingComplete,
  onCancel,
  disabled = false,
  className,
}: VoiceRecorderProps) {
  // Recording state
  const [state, setState] = React.useState<RecordingState>("idle");
  const [error, setError] = React.useState<string | null>(null);
  const [duration, setDuration] = React.useState(0);
  const [audioBlob, setAudioBlob] = React.useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = React.useState<string | null>(null);
  const [isMounted, setIsMounted] = React.useState(false);

  // Refs for media recorder and timer
  const mediaRecorderRef = React.useRef<MediaRecorder | null>(null);
  const audioChunksRef = React.useRef<Blob[]>([]);
  const timerRef = React.useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = React.useRef<number>(0);
  const pausedTimeRef = React.useRef<number>(0);



  /**
   * Check if browser supports MediaRecorder (only after client-side mount)
   */
  const [isSupported, setIsSupported] = React.useState(true); // Assume supported initially to match server render

  /**
   * Start recording
   */
  const startRecording = React.useCallback(async () => {
    try {
      setError(null);

      // Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      // Create MediaRecorder
      const options: MediaRecorderOptions = {
        mimeType: "audio/webm",
      };

      // Fallback for browsers that don't support audio/webm
      if (!MediaRecorder.isTypeSupported("audio/webm")) {
        options.mimeType = "audio/mp4";
      }

      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;

      // Clear previous chunks
      audioChunksRef.current = [];

      // Handle data available
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      // Handle stop
      mediaRecorder.onstop = () => {
        // Create blob from chunks
        const blob = new Blob(audioChunksRef.current, {
          type: mediaRecorder.mimeType,
        });
        setAudioBlob(blob);

        // Create URL for preview (optional)
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);

        setState("completed");

        // Stop all tracks
        stream.getTracks().forEach((track) => track.stop());
      };

      // Start recording
      mediaRecorder.start(100); // Collect data every 100ms
      setState("recording");

      // Start timer
      startTimeRef.current = Date.now();
      pausedTimeRef.current = 0;
      timerRef.current = setInterval(() => {
        const elapsed = (Date.now() - startTimeRef.current - pausedTimeRef.current) / 1000;
        setDuration(elapsed);
      }, 100);
    } catch (err) {
      console.error("Error starting recording:", err);
      if (err instanceof Error) {
        if (err.name === "NotAllowedError") {
          setError(
            "Microphone access denied. Please allow microphone access in your browser settings."
          );
        } else if (err.name === "NotFoundError") {
          setError("No microphone found. Please connect a microphone and try again.");
        } else {
          setError(`Recording error: ${err.message}`);
        }
      } else {
        setError("Failed to start recording. Please try again.");
      }
      setState("idle");
    }
  }, []);

  /**
   * Pause recording
   */
  const pauseRecording = React.useCallback(() => {
    if (mediaRecorderRef.current && state === "recording") {
      mediaRecorderRef.current.pause();
      setState("paused");

      // Pause timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  }, [state]);

  /**
   * Resume recording
   */
  const resumeRecording = React.useCallback(() => {
    if (mediaRecorderRef.current && state === "paused") {
      mediaRecorderRef.current.resume();
      setState("recording");

      // Resume timer
      const pausedDuration = Date.now() - startTimeRef.current - pausedTimeRef.current;
      pausedTimeRef.current = pausedDuration;
      timerRef.current = setInterval(() => {
        const elapsed = (Date.now() - startTimeRef.current - pausedTimeRef.current) / 1000;
        setDuration(elapsed);
      }, 100);
    }
  }, [state]);

  /**
   * Stop recording
   */
  const stopRecording = React.useCallback(() => {
    if (mediaRecorderRef.current && (state === "recording" || state === "paused")) {
      mediaRecorderRef.current.stop();

      // Clear timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  }, [state]);

  /**
   * Cancel recording
   */
  const cancelRecording = React.useCallback(() => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();

      // Stop all tracks
      const stream = mediaRecorderRef.current.stream;
      stream.getTracks().forEach((track) => track.stop());
    }

    // Clear timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    // Reset state
    setState("idle");
    setDuration(0);
    setAudioBlob(null);
    setAudioUrl(null);
    audioChunksRef.current = [];

    if (onCancel) {
      onCancel();
    }
  }, [onCancel]);

  /**
   * Use recording (complete and pass to parent)
   */
  const useRecording = React.useCallback(() => {
    if (audioBlob && state === "completed") {
      onRecordingComplete(audioBlob, duration);

      // Reset state
      setState("idle");
      setDuration(0);
      setAudioBlob(null);
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
        setAudioUrl(null);
      }
      audioChunksRef.current = [];
    }
  }, [audioBlob, audioUrl, duration, onRecordingComplete, state]);

  /**
   * Set mounted state and check browser support to prevent hydration mismatch
   */
  React.useEffect(() => {
    setIsMounted(true);

    // Check browser support after mount (client-side only)
    const supported = (
      typeof window !== "undefined" &&
      "mediaDevices" in navigator &&
      "getUserMedia" in navigator.mediaDevices &&
      "MediaRecorder" in window
    );
    setIsSupported(supported);
  }, []);

  /**
   * Cleanup on unmount
   */
  React.useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
      if (mediaRecorderRef.current) {
        const stream = mediaRecorderRef.current.stream;
        stream?.getTracks().forEach((track) => track.stop());
      }
    };
  }, [audioUrl]);

  // Show not supported message (only after client-side mount to prevent hydration mismatch)
  if (isMounted && !isSupported) {
    return (
      <Alert color="red" variant="light">
        Your browser doesn&apos;t support audio recording. Please try using Chrome, Edge, or Safari.
      </Alert>
    );
  }

  // Don't render anything until client-side mount to prevent hydration mismatch
  if (!isMounted) {
    return null;
  }

  return (
    <Stack gap="md" className={className}>
      {/* Recording Controls */}
      <Card radius="lg" withBorder shadow="sm">
        <Card.Section withBorder inheritPadding py="md">
          <Group gap="sm" wrap="nowrap">
            <Box
              style={{
                borderRadius: '50%',
                padding: rem(8),
                transition: 'all 300ms ease',
                ...(state === "recording" && {
                  background: 'linear-gradient(to bottom right, var(--mantine-color-aphBlue-1), var(--mantine-color-aphGreen-1))',
                  animation: 'pulse 1s ease-in-out infinite',
                  boxShadow: 'var(--mantine-shadow-md)',
                }),
                ...(state === "paused" && {
                  background: 'var(--mantine-color-gray-1)',
                }),
                ...(state === "completed" && {
                  background: 'linear-gradient(to bottom right, var(--mantine-color-aphGreen-1), var(--mantine-color-aphBlue-1))',
                  boxShadow: 'var(--mantine-shadow-md)',
                }),
                ...(state === "idle" && {
                  background: 'linear-gradient(to bottom right, var(--mantine-color-aphBlue-0), var(--mantine-color-aphGreen-0))',
                }),
              }}
            >
              <Mic
                style={{
                  width: rem(20),
                  height: rem(20),
                  color:
                    state === "recording"
                      ? 'var(--mantine-color-aphBlue-6)'
                      : state === "paused"
                      ? 'var(--mantine-color-gray-6)'
                      : state === "completed"
                      ? 'var(--mantine-color-aphGreen-6)'
                      : 'var(--mantine-color-aphBlue-6)',
                }}
              />
            </Box>
            <Stack gap={2} style={{ flex: 1 }}>
              <Text size="lg" fw={600}>
                Voice Recording
              </Text>
              <Text size="sm" c="dimmed">
                {state === "idle" && "Tap the microphone to start recording"}
                {state === "recording" && "Recording in progress..."}
                {state === "paused" && "Recording paused"}
                {state === "completed" && "Recording complete - ready to upload"}
              </Text>
            </Stack>
          </Group>
        </Card.Section>

        <Card.Section inheritPadding py="lg">
          <Stack gap="md">
            {/* Circular Waveform Visualization */}
            {(state === "recording" || state === "paused" || state === "completed") && (
              <Box py="xl" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Box style={{ position: 'relative' }}>
                  {/* Circular Waveform - Only show when recording */}
                  {state === "recording" && (
                    <Box style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {WAVEFORM_HEIGHTS.map((height, i) => {
                        const angle = (i * 360) / 24;
                        return (
                          <Box
                            key={i}
                            style={{
                              position: 'absolute',
                              background: 'linear-gradient(to top, var(--mantine-color-aphBlue-6), var(--mantine-color-aphGreen-6))',
                              borderRadius: rem(999),
                              width: rem(3),
                              height: rem(height),
                              transform: `rotate(${angle}deg) translateY(-80px)`,
                              transformOrigin: 'center',
                              animation: 'pulse 0.8s ease-in-out infinite',
                              animationDelay: `${i * 0.05}s`,
                              opacity: 0.7,
                            }}
                          />
                        );
                      })}
                    </Box>
                  )}

                  {/* Center Circle with Timer */}
                  <Box
                    style={{
                      position: 'relative',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: '50%',
                      borderWidth: rem(4),
                      borderStyle: 'solid',
                      width: rem(160),
                      height: rem(160),
                      transition: 'all 300ms ease',
                      ...(state === "recording" && {
                        borderColor: 'var(--mantine-color-aphBlue-6)',
                        background: 'linear-gradient(to bottom right, var(--mantine-color-aphBlue-0), var(--mantine-color-aphGreen-0))',
                        boxShadow: '0 10px 25px -5px rgba(68, 73, 156, 0.2), 0 8px 10px -6px rgba(68, 73, 156, 0.2)',
                      }),
                      ...(state === "paused" && {
                        borderColor: 'var(--mantine-color-gray-3)',
                        background: 'var(--mantine-color-gray-0)',
                      }),
                      ...(state === "completed" && {
                        borderColor: 'var(--mantine-color-aphGreen-6)',
                        background: 'linear-gradient(to bottom right, var(--mantine-color-aphGreen-0), var(--mantine-color-aphBlue-0))',
                        boxShadow: '0 10px 25px -5px rgba(0, 159, 77, 0.2), 0 8px 10px -6px rgba(0, 159, 77, 0.2)',
                      }),
                    }}
                  >
                    {/* Animated Ring for Recording State */}
                    {state === "recording" && (
                      <Box
                        style={{
                          position: 'absolute',
                          inset: 0,
                          borderRadius: '50%',
                          borderWidth: rem(4),
                          borderStyle: 'solid',
                          borderColor: 'var(--mantine-color-aphBlue-6)',
                          animation: 'ping 1s cubic-bezier(0, 0, 0.2, 1) infinite',
                          opacity: 0.2,
                        }}
                      />
                    )}

                    {/* Timer */}
                    <Stack gap={4} align="center" style={{ zIndex: 10 }}>
                      <Text
                        size={rem(32)}
                        fw={700}
                        style={{ fontFamily: 'var(--mantine-font-family-monospace)', fontVariantNumeric: 'tabular-nums' }}
                      >
                        {formatTime(duration)}
                      </Text>
                      <Text size="xs" c="dimmed" fw={500} tt="uppercase" style={{ letterSpacing: rem(1) }}>
                        {state === "recording" && "Recording"}
                        {state === "paused" && "Paused"}
                        {state === "completed" && "Complete"}
                      </Text>
                    </Stack>
                  </Box>
                </Box>
              </Box>
            )}

            {/* Control Buttons */}
            <Stack gap="sm">
              {/* Idle State - Start Recording */}
              {state === "idle" && (
                <Button
                  size="lg"
                  onClick={startRecording}
                  disabled={disabled}
                  fullWidth
                  style={{ minHeight: rem(52) }}
                  styles={{
                    root: {
                      background: 'linear-gradient(to right, var(--mantine-color-aphBlue-6), var(--mantine-color-aphBlue-9))',
                      fontWeight: 600,
                      '&:hover': {
                        transform: 'scale(1.02)',
                        boxShadow: 'var(--mantine-shadow-lg)',
                      },
                    },
                  }}
                >
                  <Mic style={{ width: rem(20), height: rem(20), marginRight: rem(8) }} />
                  Start Recording
                </Button>
              )}

              {/* Recording State - Pause and Stop */}
              {state === "recording" && (
                <Group grow>
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={pauseRecording}
                    style={{ minHeight: rem(52) }}
                  >
                    <Pause style={{ width: rem(20), height: rem(20), marginRight: rem(8) }} />
                    Pause
                  </Button>
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={stopRecording}
                    style={{ minHeight: rem(52) }}
                  >
                    <Square style={{ width: rem(20), height: rem(20), marginRight: rem(8) }} />
                    Stop
                  </Button>
                </Group>
              )}

              {/* Paused State - Resume, Stop, Cancel */}
              {state === "paused" && (
                <Stack gap="sm">
                  <Button
                    size="lg"
                    onClick={resumeRecording}
                    fullWidth
                    style={{ minHeight: rem(52) }}
                    styles={{
                      root: {
                        background: 'linear-gradient(to right, var(--mantine-color-aphBlue-6), var(--mantine-color-aphBlue-9))',
                        '&:hover': {
                          transform: 'scale(1.02)',
                          boxShadow: 'var(--mantine-shadow-lg)',
                        },
                      },
                    }}
                  >
                    <Play style={{ width: rem(20), height: rem(20), marginRight: rem(8) }} />
                    Resume Recording
                  </Button>
                  <Group grow>
                    <Button
                      variant="outline"
                      size="lg"
                      onClick={stopRecording}
                      style={{ minHeight: rem(44) }}
                    >
                      <Square style={{ width: rem(20), height: rem(20), marginRight: rem(8) }} />
                      Finish
                    </Button>
                    <Button
                      variant="outline"
                      size="lg"
                      onClick={cancelRecording}
                      style={{ minHeight: rem(44) }}
                    >
                      <Trash2 style={{ width: rem(20), height: rem(20), marginRight: rem(8) }} />
                      Cancel
                    </Button>
                  </Group>
                </Stack>
              )}

              {/* Completed State - Use or Discard */}
              {state === "completed" && audioBlob && (
                <Stack gap="sm">
                  <Button
                    size="lg"
                    onClick={useRecording}
                    fullWidth
                    style={{ minHeight: rem(52) }}
                    styles={{
                      root: {
                        background: 'linear-gradient(to right, var(--mantine-color-aphGreen-6), var(--mantine-color-aphGreen-7))',
                        fontWeight: 600,
                        '&:hover': {
                          transform: 'scale(1.02)',
                          boxShadow: 'var(--mantine-shadow-lg)',
                        },
                      },
                    }}
                  >
                    <Check style={{ width: rem(20), height: rem(20), marginRight: rem(8) }} />
                    Use This Recording
                  </Button>
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={cancelRecording}
                    fullWidth
                    style={{ minHeight: rem(44) }}
                  >
                    <Trash2 style={{ width: rem(20), height: rem(20), marginRight: rem(8) }} />
                    Discard & Start Over
                  </Button>
                </Stack>
              )}
            </Stack>

            {/* File Info */}
            {state === "completed" && audioBlob && (
              <Group
                justify="space-between"
                p="sm"
                style={{
                  background: 'var(--mantine-color-gray-0)',
                  borderRadius: 'var(--mantine-radius-lg)',
                }}
              >
                <Group gap="sm">
                  <Mic style={{ width: rem(16), height: rem(16) }} color="var(--mantine-color-dimmed)" />
                  <Stack gap={2}>
                    <Text size="sm" fw={500}>
                      Recording ready
                    </Text>
                    <Text size="xs" c="dimmed">
                      {(audioBlob.size / 1024 / 1024).toFixed(2)} MB • {formatTime(duration)}
                    </Text>
                  </Stack>
                </Group>
                <Badge
                  variant="outline"
                  color="aphGreen"
                  fw={600}
                  style={{
                    background: 'var(--mantine-color-aphGreen-0)',
                    borderColor: 'var(--mantine-color-aphGreen-3)',
                  }}
                >
                  Ready
                </Badge>
              </Group>
            )}
          </Stack>
        </Card.Section>
      </Card>

      {/* Error Alert */}
      {error && (
        <Alert color="red" variant="light">
          {error}
        </Alert>
      )}

      {/* Helper Tips */}
      {state === "idle" && !error && (
        <Alert color="aphCyan" variant="light">
          <Text size="sm">
            <strong>Tip for field workers:</strong> Find a quiet location, speak clearly toward
            your device, and keep recording under 5 minutes for best results.
          </Text>
        </Alert>
      )}
    </Stack>
  );
}

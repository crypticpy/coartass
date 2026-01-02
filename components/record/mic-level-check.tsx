/**
 * Mic Level Check Component
 *
 * A pre-recording microphone test UI that helps users verify their microphone
 * is working correctly before starting a recording session.
 *
 * Features:
 * - Visual audio level meter
 * - Auto-detection of good audio levels
 * - Automatic progression after sustained good levels
 * - Error handling for permission issues
 * - Skip preference to bypass future checks
 * - Keyboard accessibility (Enter to continue, Escape to cancel)
 */

'use client';

import * as React from 'react';
import { Mic, AlertCircle, Check, Volume2, VolumeX, RefreshCw } from 'lucide-react';
import {
  Paper,
  Stack,
  Group,
  Text,
  Button,
  Checkbox,
  Alert,
  Box,
  rem,
  Loader,
  Progress,
} from '@mantine/core';
import { useAudioAmplitude } from '@/hooks/use-audio-amplitude';
import {
  detectBrowserName,
  setMicCheckPreference,
  detectMicIssue as detectMicIssueFromLib,
  getMicIssueMessage as getMicIssueMessageFromLib,
} from '@/lib/browser-capabilities';
import type { MicCheckState, MicCheckError } from '@/types/recording';

// =============================================================================
// Types
// =============================================================================

/**
 * Props for the MicLevelCheck component
 */
export interface MicLevelCheckProps {
  /** Callback when mic check passes (good levels detected) */
  onCheckPassed: () => void;
  /** Callback when user skips the check */
  onSkip: () => void;
  /** Callback when user cancels/goes back */
  onCancel: () => void;
}

// =============================================================================
// Constants
// =============================================================================

/** Number of consecutive good readings required to auto-advance (~2 seconds at 15fps) */
const GOOD_LEVEL_COUNT_THRESHOLD = 30;

/** Number of consecutive low readings before transitioning from ready to warning (~1.5 seconds) */
const LOW_LEVEL_COUNT_THRESHOLD = 22;

/** Audio level thresholds */
const LEVEL_THRESHOLDS = {
  GOOD: 0.15,
  LOW: 0.03,
} as const;

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Detect the type of microphone error from a DOMException
 * Wraps the lib function to handle unknown error types
 */
function detectMicIssue(error: unknown): MicCheckError {
  if (error instanceof Error) {
    return detectMicIssueFromLib(error);
  }
  return 'unknown';
}

/**
 * Get a user-friendly message for a mic issue
 * Uses the lib function with browser detection
 */
function getMicIssueMessage(errorType: MicCheckError): string {
  const browser = detectBrowserName();
  const result = getMicIssueMessageFromLib(errorType, browser);
  return result.message;
}

/**
 * Get error title based on error type
 */
function getErrorTitle(errorType: MicCheckError): string {
  const browser = detectBrowserName();
  const result = getMicIssueMessageFromLib(errorType, browser);
  return result.title;
}

// =============================================================================
// Component
// =============================================================================

/**
 * MicLevelCheck Component
 *
 * Pre-recording microphone test that verifies audio input before recording.
 * Shows real-time audio levels and auto-advances when good levels are detected.
 */
export function MicLevelCheck({
  onCheckPassed,
  onSkip,
  onCancel,
}: MicLevelCheckProps) {
  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------

  const [state, setState] = React.useState<MicCheckState>('requesting');
  const [skipPreference, setSkipPreferenceState] = React.useState(false);
  const [errorType, setErrorType] = React.useState<MicCheckError | null>(null);
  const [goodLevelCount, setGoodLevelCount] = React.useState(0);
  const [_lowLevelCount, setLowLevelCount] = React.useState(0);

  // ---------------------------------------------------------------------------
  // Refs
  // ---------------------------------------------------------------------------

  const streamRef = React.useRef<MediaStream | null>(null);
  const mountedRef = React.useRef(true);

  // ---------------------------------------------------------------------------
  // Audio Amplitude Hook
  // ---------------------------------------------------------------------------

  const { averageLevel, startAnalysis, stopAnalysis, isAnalysing: _isAnalysing } =
    useAudioAmplitude({
      fftSize: 64,
      smoothingTimeConstant: 0.5,
    });

  // ---------------------------------------------------------------------------
  // Cleanup Function
  // ---------------------------------------------------------------------------

  const cleanup = React.useCallback(() => {
    // Stop audio analysis
    stopAnalysis();

    // Stop all tracks in the stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, [stopAnalysis]);

  // ---------------------------------------------------------------------------
  // Request Microphone Permission
  // ---------------------------------------------------------------------------

  const requestMicrophone = React.useCallback(async () => {
    setState('requesting');
    setErrorType(null);
    setGoodLevelCount(0);
    setLowLevelCount(0);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      // Check if still mounted
      if (!mountedRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      streamRef.current = stream;
      startAnalysis(stream);
      setState('checking');
    } catch (error) {
      if (!mountedRef.current) return;

      const issueType = detectMicIssue(error);
      setErrorType(issueType);
      setState('error');
      console.error('Microphone access error:', error);
    }
  }, [startAnalysis]);

  // ---------------------------------------------------------------------------
  // Initial Request on Mount
  // ---------------------------------------------------------------------------

  React.useEffect(() => {
    mountedRef.current = true;
    requestMicrophone();

    return () => {
      mountedRef.current = false;
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------------------------------------------------------------------------
  // Level Detection Logic (with debouncing to prevent rapid state changes)
  // ---------------------------------------------------------------------------

  React.useEffect(() => {
    if (state !== 'checking' && state !== 'ready' && state !== 'warning') {
      return;
    }

    // Determine current level status
    if (averageLevel >= LEVEL_THRESHOLDS.GOOD) {
      // Good audio level - transition immediately to ready, reset low counter
      setGoodLevelCount((prev) => prev + 1);
      setLowLevelCount(0);
      if (state !== 'ready') {
        setState('ready');
      }
    } else {
      // Audio is low or silent - use debouncing before transitioning from ready
      setGoodLevelCount(0);

      if (state === 'ready') {
        // When in ready state, count consecutive low readings before switching
        setLowLevelCount((prev) => {
          const newCount = prev + 1;
          if (newCount >= LOW_LEVEL_COUNT_THRESHOLD) {
            setState('warning');
            return 0;
          }
          return newCount;
        });
      } else if (state !== 'warning') {
        // Not in ready state, transition immediately to warning
        setState('warning');
      }
    }
  }, [averageLevel, state]);

  // ---------------------------------------------------------------------------
  // Auto-Advance After Sustained Good Levels
  // ---------------------------------------------------------------------------

  React.useEffect(() => {
    if (goodLevelCount >= GOOD_LEVEL_COUNT_THRESHOLD) {
      handleContinue();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goodLevelCount]);

  // ---------------------------------------------------------------------------
  // Event Handlers
  // ---------------------------------------------------------------------------

  const handleContinue = React.useCallback(() => {
    if (skipPreference) {
      setMicCheckPreference(true);
    }
    cleanup();
    onCheckPassed();
  }, [skipPreference, cleanup, onCheckPassed]);

  const handleSkip = React.useCallback(() => {
    if (skipPreference) {
      setMicCheckPreference(true);
    }
    cleanup();
    onSkip();
  }, [skipPreference, cleanup, onSkip]);

  const handleCancel = React.useCallback(() => {
    cleanup();
    onCancel();
  }, [cleanup, onCancel]);

  const handleRetry = React.useCallback(() => {
    cleanup();
    requestMicrophone();
  }, [cleanup, requestMicrophone]);

  // ---------------------------------------------------------------------------
  // Keyboard Navigation
  // ---------------------------------------------------------------------------

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && (state === 'ready' || state === 'warning')) {
        e.preventDefault();
        handleContinue();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state, handleContinue, handleCancel]);

  // ---------------------------------------------------------------------------
  // Computed Values
  // ---------------------------------------------------------------------------

  const autoAdvanceProgress = Math.min(
    (goodLevelCount / GOOD_LEVEL_COUNT_THRESHOLD) * 100,
    100
  );

  const levelStatus = React.useMemo(() => {
    if (averageLevel >= LEVEL_THRESHOLDS.GOOD) {
      return { color: 'green', label: 'Good audio level detected!', icon: Check };
    }
    if (averageLevel >= LEVEL_THRESHOLDS.LOW) {
      return {
        color: 'yellow',
        label: 'Audio is very quiet - try speaking louder',
        icon: Volume2,
      };
    }
    return {
      color: 'red',
      label: 'No audio detected - check if mic is muted',
      icon: VolumeX,
    };
  }, [averageLevel]);

  // ---------------------------------------------------------------------------
  // Render: Error State
  // ---------------------------------------------------------------------------

  if (state === 'error' && errorType) {
    return (
      <Paper radius="lg" withBorder shadow="md" p="xl">
        <Stack gap="lg" align="center">
          {/* Error Icon */}
          <Box
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: rem(80),
              height: rem(80),
              borderRadius: '50%',
              background: 'var(--mantine-color-red-1)',
            }}
          >
            <AlertCircle size={40} color="var(--mantine-color-red-6)" />
          </Box>

          {/* Error Title */}
          <Text size="xl" fw={600} ta="center">
            {getErrorTitle(errorType)}
          </Text>

          {/* Error Message */}
          <Alert
            color="red"
            variant="light"
            icon={<AlertCircle size={20} />}
            style={{ maxWidth: rem(400), width: '100%' }}
          >
            <Text size="sm">{getMicIssueMessage(errorType)}</Text>
          </Alert>

          {/* Action Buttons */}
          <Group gap="md">
            <Button
              leftSection={<RefreshCw size={18} />}
              onClick={handleRetry}
              color="blue"
            >
              Retry
            </Button>
            <Button variant="outline" color="gray" onClick={handleCancel}>
              Cancel
            </Button>
          </Group>
        </Stack>
      </Paper>
    );
  }

  // ---------------------------------------------------------------------------
  // Render: Requesting/Checking/Ready/Warning States
  // ---------------------------------------------------------------------------

  return (
    <Paper radius="lg" withBorder shadow="md" p="xl">
      <Stack gap="lg" align="center">
        {/* Header Icon */}
        <Box
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: rem(64),
            height: rem(64),
            borderRadius: '50%',
            background:
              state === 'requesting'
                ? 'var(--mantine-color-gray-1)'
                : state === 'ready'
                  ? 'var(--mantine-color-green-1)'
                  : 'var(--mantine-color-blue-1)',
          }}
        >
          {state === 'requesting' ? (
            <Loader size="md" color="gray" />
          ) : (
            <Mic
              size={32}
              color={
                state === 'ready'
                  ? 'var(--mantine-color-green-6)'
                  : 'var(--mantine-color-blue-6)'
              }
            />
          )}
        </Box>

        {/* Title */}
        <Text size="xl" fw={600} ta="center">
          {state === 'requesting'
            ? 'Requesting Microphone Access...'
            : 'Test Your Microphone'}
        </Text>

        {/* Description */}
        {state !== 'requesting' && (
          <Text size="sm" c="dimmed" ta="center" maw={400}>
            Speak normally to make sure your microphone is working before you
            start recording.
          </Text>
        )}

        {/* Audio Level Meter - decorative, hidden from screen readers */}
        {state !== 'requesting' && (
          <Box style={{ width: '100%', maxWidth: rem(360) }} aria-hidden="true">
            {/* LED-Style VU Meter */}
            <Group gap={3} justify="center">
              {[...Array(15)].map((_, i) => {
                const threshold = (i + 1) / 15;
                const isActive = averageLevel >= threshold;
                // Color zones: 0-60% green, 60-80% yellow, 80-100% red
                const color = i < 9 ? 'green' : i < 12 ? 'yellow' : 'red';
                return (
                  <Box
                    key={i}
                    style={{
                      width: rem(18),
                      height: rem(28),
                      borderRadius: rem(3),
                      background: isActive
                        ? `var(--mantine-color-${color}-6)`
                        : 'var(--mantine-color-gray-3)',
                      boxShadow: isActive
                        ? `0 0 6px var(--mantine-color-${color}-4)`
                        : 'none',
                      transition: 'all 50ms ease-out',
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

        {/* Status Message & Progress Container - fixed height to prevent layout shift */}
        {state !== 'requesting' && (
          <Box style={{ width: '100%', maxWidth: rem(360), minHeight: rem(70) }}>
            <Stack gap="sm" align="center">
              {/* Status Message - announced to screen readers on changes */}
              <Group gap="xs" align="center" aria-live="polite" role="status">
                {React.createElement(levelStatus.icon, {
                  size: 18,
                  color: `var(--mantine-color-${levelStatus.color}-6)`,
                  'aria-hidden': true,
                })}
                <Text size="sm" c={levelStatus.color} fw={500}>
                  {levelStatus.label}
                </Text>
              </Group>

              {/* Auto-Advance Progress - always visible to prevent layout shift */}
              <Box style={{ width: '100%', maxWidth: rem(300) }}>
                <Progress
                  value={state === 'ready' && goodLevelCount > 0 ? autoAdvanceProgress : 0}
                  color="green"
                  size="xs"
                  animated={state === 'ready' && goodLevelCount > 0}
                  aria-label="Auto-advance progress"
                  aria-valuenow={state === 'ready' ? Math.round(autoAdvanceProgress) : 0}
                  aria-valuemin={0}
                  aria-valuemax={100}
                />
                <Text
                  size="xs"
                  c="dimmed"
                  ta="center"
                  mt={4}
                  style={{
                    opacity: state === 'ready' && goodLevelCount > 0 ? 1 : 0,
                    transition: 'opacity 200ms ease'
                  }}
                >
                  Continuing automatically...
                </Text>
              </Box>
            </Stack>
          </Box>
        )}

        {/* Action Buttons */}
        {state !== 'requesting' && (
          <Group gap="md">
            <Button
              color={state === 'ready' ? 'green' : 'blue'}
              leftSection={state === 'ready' ? <Check size={18} /> : undefined}
              onClick={handleContinue}
            >
              {state === 'ready' ? 'Continue to Recording' : 'Continue Anyway'}
            </Button>
            <Button variant="outline" color="gray" onClick={handleSkip}>
              Skip for now
            </Button>
          </Group>
        )}

        {/* Skip Preference Checkbox */}
        {state !== 'requesting' && (
          <Checkbox
            label="Don't show this check again"
            checked={skipPreference}
            onChange={(e) => setSkipPreferenceState(e.currentTarget.checked)}
            size="sm"
          />
        )}

        {/* Keyboard Hint */}
        {state !== 'requesting' && (
          <Text size="xs" c="dimmed">
            Press <strong>Enter</strong> to continue or <strong>Escape</strong>{' '}
            to cancel
          </Text>
        )}
      </Stack>
    </Paper>
  );
}

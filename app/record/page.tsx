/**
 * Record Audio Page
 *
 * Standalone recording page for creating audio recordings with three modes:
 * - Microphone: Record from device microphone
 * - System Audio: Capture audio from browser tabs (Zoom, Teams, etc.)
 * - Commentary: Record both microphone and system audio simultaneously
 *
 * Page Flow:
 * 1. mode_selection: User selects recording mode
 * 2. mic_check: (Microphone mode only) Verify mic level before recording
 * 3. recording: User records audio with controls (pause/resume/stop)
 * 4. completed: User previews recording and can save or re-record
 *
 * Features:
 * - Browser capability detection and alerts
 * - Mode selection with visual cards
 * - Pre-recording mic level check (for microphone mode)
 * - Real-time recording interface with timer
 * - Audio preview with playback controls
 * - Save to IndexedDB for later transcription
 * - Navigation to transcription page after save
 */

"use client";

import * as React from "react";
import Link from "next/link";
import {
  Container,
  Stack,
  Title,
  Text,
  Alert,
  Box,
  Group,
} from "@mantine/core";
import { ArrowLeft, Mic, AlertCircle, Info } from "lucide-react";
import { notifications } from "@mantine/notifications";
import { getBrowserCapabilities, getMicCheckPreference } from "@/lib/browser-capabilities";
import { useAudioSources } from "@/hooks/use-audio-sources";
import type { RecordingMode } from "@/types/recording";
import type { RecordingCompleteData } from "@/components/record/recording-interface";

// Dynamic imports for recording components (to be created)
import dynamic from "next/dynamic";

const ModeSelector = dynamic(
  () =>
    import("@/components/record/mode-selector").then((m) => ({
      default: m.ModeSelector,
    })),
  {
    ssr: false,
  }
);

const RecordingInterface = dynamic(
  () =>
    import("@/components/record/recording-interface").then((m) => ({
      default: m.RecordingInterface,
    })),
  {
    ssr: false,
  }
);

const RecordingPreview = dynamic(
  () =>
    import("@/components/record/recording-preview").then((m) => ({
      default: m.RecordingPreview,
    })),
  {
    ssr: false,
  }
);

const MicLevelCheck = dynamic(
  () =>
    import("@/components/record/mic-level-check").then((m) => ({
      default: m.MicLevelCheck,
    })),
  {
    ssr: false,
  }
);

/**
 * Page state machine for recording flow
 */
type PageState = "mode_selection" | "mic_check" | "recording" | "completed";

/**
 * Completed recording data structure
 */
interface CompletedRecording {
  blob: Blob;
  url: string;
  duration: number;
  mode: RecordingMode;
}

/**
 * Record Audio Page Component
 *
 * Main page component that orchestrates the recording workflow.
 * Manages page state transitions, audio source acquisition, and recording lifecycle.
 */
export default function RecordPage() {
  // ============================================================================
  // State Management
  // ============================================================================

  /**
   * Current page state in the recording flow
   */
  const [pageState, setPageState] = React.useState<PageState>("mode_selection");

  /**
   * Currently selected recording mode
   */
  const [selectedMode, setSelectedMode] = React.useState<RecordingMode | null>(null);

  /**
   * Completed recording data (available after recording is stopped)
   */
  const [completedRecording, setCompletedRecording] =
    React.useState<CompletedRecording | null>(null);

  // ============================================================================
  // Browser Capabilities Detection
  // ============================================================================

  /**
   * Track if component has mounted (for hydration-safe rendering)
   */
  const [hasMounted, setHasMounted] = React.useState(false);

  /**
   * Browser capabilities for recording features.
   * Determines which modes are available and if system audio is supported.
   * Initialize to null to avoid hydration mismatch - will be set on client only.
   */
  const [capabilities, setCapabilities] = React.useState<ReturnType<typeof getBrowserCapabilities> | null>(null);

  React.useEffect(() => {
    // Mark as mounted and check capabilities on client-side only
    setHasMounted(true);
    setCapabilities(getBrowserCapabilities());
  }, []);

  // ============================================================================
  // Hooks for Recording and Audio Sources
  // ============================================================================

  /**
   * Audio sources hook for managing microphone and system audio streams
   */
  const audioSources = useAudioSources();


  // ============================================================================
  // Recording Flow Handlers
  // ============================================================================

  /**
   * Handle mode selection - transition to mic check or recording state
   * RecordingInterface component handles actual recording internally
   */
  const handleModeSelect = React.useCallback((mode: RecordingMode) => {
    setSelectedMode(mode);

    // Only show mic check for microphone mode if user hasn't disabled it
    if (mode === 'microphone' && !getMicCheckPreference()) {
      setPageState("mic_check");
    } else {
      setPageState("recording");
    }
  }, []);

  /**
   * Handle successful mic check - proceed to recording
   */
  const handleMicCheckPassed = React.useCallback(() => {
    setPageState("recording");
  }, []);

  /**
   * Handle mic check skip - proceed to recording anyway
   */
  const handleMicCheckSkip = React.useCallback(() => {
    setPageState("recording");
    notifications.show({
      title: "Mic check skipped",
      message: "Starting recording without level check.",
      color: "blue",
    });
  }, []);

  /**
   * Handle mic check cancel - return to mode selection
   */
  const handleMicCheckCancel = React.useCallback(() => {
    setPageState("mode_selection");
    setSelectedMode(null);
  }, []);

  /**
   * Handle duration warning from recording hook
   * Note: Currently unused as RecordingInterface handles duration warnings internally.
   * Kept for potential future use if page-level notification is needed.
   */
  const _handleDurationWarning = React.useCallback((minutes: number) => {
    notifications.show({
      title: `Recording is ${minutes} minutes long`,
      message: "Long recordings may use more memory. Consider stopping soon if your device is low on resources.",
      color: "yellow",
      autoClose: 10000,
    });
  }, []);

  /**
   * Handle recording completion from RecordingInterface
   * Receives blob and duration from the component and transitions to preview
   */
  const handleRecordingComplete = React.useCallback(
    (data: RecordingCompleteData) => {
      // Create completed recording data
      const url = URL.createObjectURL(data.blob);
      setCompletedRecording({
        blob: data.blob,
        url,
        duration: data.duration,
        mode: selectedMode || "microphone",
      });

      // Transition to completed state
      setPageState("completed");

      // Show success notification
      notifications.show({
        title: "Recording completed",
        message: "Your recording is ready to preview and save.",
        color: "green",
      });
    },
    [selectedMode]
  );

  /**
   * Handle when recording is saved successfully
   * Recording is already saved to IndexedDB by RecordingPreview component
   * This just resets the page state for a new recording
   */
  const handleRecordingSaved = React.useCallback(() => {
    // Revoke object URL to free memory
    if (completedRecording?.url) {
      URL.revokeObjectURL(completedRecording.url);
    }

    // Clear completed recording
    setCompletedRecording(null);

    // Return to mode selection for another recording
    setPageState("mode_selection");
  }, [completedRecording]);

  /**
   * Handle discarding the recording and starting over
   */
  const handleDiscard = React.useCallback(() => {
    // Revoke object URL to free memory
    if (completedRecording?.url) {
      URL.revokeObjectURL(completedRecording.url);
    }

    // Clear completed recording
    setCompletedRecording(null);

    // Stop all audio streams
    audioSources.stopAllStreams();

    // Return to mode selection
    setPageState("mode_selection");

    notifications.show({
      title: "Recording discarded",
      message: "Ready to start a new recording.",
      color: "blue",
    });
  }, [completedRecording, audioSources]);

  /**
   * Handle canceling during recording
   * Note: RecordingInterface handles its own cleanup via onDiscard
   */
  const handleCancel = React.useCallback(() => {
    // Stop all audio streams
    audioSources.stopAllStreams();

    // Return to mode selection
    setPageState("mode_selection");

    notifications.show({
      title: "Recording cancelled",
      message: "Recording was cancelled.",
      color: "blue",
    });
  }, [audioSources]);

  // ============================================================================
  // Cleanup on Unmount
  // ============================================================================

  // Use ref to track URL for cleanup without causing effect re-runs
  const completedUrlRef = React.useRef<string | null>(null);

  // Update ref when completedRecording changes
  React.useEffect(() => {
    completedUrlRef.current = completedRecording?.url ?? null;
  }, [completedRecording]);

  // Cleanup only on unmount - use empty deps to run only once
  React.useEffect(() => {
    const audioSourcesRef = audioSources;
    return () => {
      // Cleanup: stop all streams and revoke URLs
      audioSourcesRef.stopAllStreams();
      if (completedUrlRef.current) {
        URL.revokeObjectURL(completedUrlRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <Container size="lg" py={{ base: "md", md: "xl" }}>
      <Stack gap="xl">
        {/* Header */}
        <Box>
          <Link
            href="/"
            style={{
              display: "inline-flex",
              alignItems: "center",
              fontSize: "var(--mantine-font-size-sm)",
              color: "var(--mantine-color-dimmed)",
              marginBottom: "var(--mantine-spacing-md)",
              textDecoration: "none",
            }}
          >
            <ArrowLeft style={{ width: 16, height: 16, marginRight: 8 }} />
            Back to Home
          </Link>
          <Group gap="md" mb="xs" wrap="nowrap">
            <Box
              style={{
                borderRadius: "var(--mantine-radius-lg)",
                background: "var(--aph-light-blue-10)",
                padding: "var(--mantine-spacing-sm)",
              }}
            >
              <Mic
                style={{ width: 24, height: 24, color: "var(--aph-blue)" }}
              />
            </Box>
            <Box>
              <Title order={1} size="h2">
                Record Audio
              </Title>
              <Text c="dimmed" mt={4}>
                {pageState === "mode_selection" &&
                  "Choose your recording mode to get started"}
                {pageState === "mic_check" &&
                  "Testing your microphone before recording"}
                {pageState === "recording" && "Recording in progress"}
                {pageState === "completed" &&
                  "Preview your recording and save for transcription"}
              </Text>
            </Box>
          </Group>
        </Box>

        {/* Browser Compatibility Alert - only show after client mount */}
        {hasMounted && capabilities && !capabilities.isSecureContext && (
          <Alert
            icon={<AlertCircle size={16} />}
            title="Secure Context Required"
            color="red"
            variant="filled"
          >
            Recording requires a secure context (HTTPS or localhost). Please
            access this page over HTTPS to enable recording features.
          </Alert>
        )}

        {/* System Audio Support Info - only show after client mount */}
        {hasMounted &&
          capabilities &&
          capabilities.isSecureContext &&
          !capabilities.hasSystemAudioSupport &&
          pageState === "mode_selection" && (
            <Alert
              icon={<Info size={16} />}
              title="Limited Browser Support"
              color="yellow"
              variant="light"
            >
              {capabilities.browserName === "Safari" && (
                <>
                  Safari does not support system audio capture. Only microphone
                  recording is available. For system audio or commentary mode,
                  please use Chrome or Edge.
                </>
              )}
              {capabilities.browserName === "Firefox" && (
                <>
                  Firefox has limited support for system audio capture. We
                  recommend using Chrome or Edge for the best experience.
                </>
              )}
              {capabilities.browserName === "unknown" && (
                <>
                  Your browser may have limited support for system audio
                  capture. We recommend using Chrome or Edge for the best
                  experience.
                </>
              )}
            </Alert>
          )}

        {/* Page Content Based on State - only render after client mount */}
        {hasMounted && pageState === "mode_selection" && (
          <ModeSelector
            selectedMode={selectedMode}
            onSelectMode={(mode) => {
              setSelectedMode(mode);
              handleModeSelect(mode);
            }}
          />
        )}

        {pageState === "mic_check" && selectedMode === "microphone" && (
          <MicLevelCheck
            onCheckPassed={handleMicCheckPassed}
            onSkip={handleMicCheckSkip}
            onCancel={handleMicCheckCancel}
          />
        )}

        {pageState === "recording" && selectedMode && (
          <RecordingInterface
            mode={selectedMode}
            onComplete={handleRecordingComplete}
            onDiscard={handleCancel}
          />
        )}

        {pageState === "completed" && completedRecording && (
          <RecordingPreview
            audioBlob={completedRecording.blob}
            audioUrl={completedRecording.url}
            duration={completedRecording.duration}
            mode={completedRecording.mode}
            onSave={handleRecordingSaved}
            onDiscard={handleDiscard}
          />
        )}
      </Stack>
    </Container>
  );
}

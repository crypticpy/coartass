/**
 * Recording State Management Hook
 *
 * Custom React hook for managing audio recording lifecycle with support for
 * multiple recording modes (microphone, system audio, commentary).
 *
 * This hook implements a state machine for recording with the following states:
 * - idle: No recording in progress
 * - preparing: Setting up media streams and permissions
 * - recording: Actively recording audio
 * - paused: Recording paused (can be resumed)
 * - completed: Recording finished, audio available
 * - error: Error occurred during recording
 *
 * Features:
 * - Multi-mode recording support (microphone, system-audio, commentary)
 * - Pause/resume functionality with accurate duration tracking
 * - Automatic MIME type detection and fallback
 * - Comprehensive resource cleanup (streams, timers, URLs)
 * - Error handling with categorized error types
 * - External stream provision for integration with audio source selection
 *
 * @example
 * ```tsx
 * const recording = useRecording({
 *   onRecordingComplete: (blob) => {
 *     console.log('Recording complete:', blob);
 *   },
 *   onError: (error) => {
 *     console.error('Recording error:', error);
 *   },
 * });
 *
 * // Select mode and start recording
 * recording.selectMode('microphone');
 * const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
 * recording.startRecordingWithStream(stream);
 *
 * // Pause and resume
 * recording.pauseRecording();
 * recording.resumeRecording();
 *
 * // Stop recording
 * recording.stopRecording();
 * ```
 */

"use client";

import * as React from 'react';
import type {
  RecordingMode,
  RecordingState,
  UseRecordingReturn,
} from '@/types/recording';

/**
 * Options for configuring the recording hook.
 */
interface UseRecordingOptions {
  /**
   * Callback invoked when recording is completed successfully.
   * Receives the recorded audio as a Blob.
   */
  onRecordingComplete?: (blob: Blob) => void;

  /**
   * Callback invoked when an error occurs during recording.
   * Receives the error object with details.
   */
  onError?: (error: Error) => void;

  /**
   * Callback invoked when recording duration crosses a warning threshold.
   * Currently triggers at 30 minutes. Receives the threshold in minutes.
   */
  onDurationWarning?: (minutes: number) => void;
}

/**
 * Custom hook for managing audio recording state and operations.
 *
 * Provides a complete recording interface with state management,
 * MediaRecorder lifecycle control, and resource cleanup.
 *
 * @param options - Configuration options including callbacks
 * @returns Recording state and control actions
 */
export function useRecording(options: UseRecordingOptions = {}): UseRecordingReturn {
  const { onRecordingComplete, onError, onDurationWarning } = options;

  // ============================================================================
  // State Management
  // ============================================================================

  /**
   * Current state in the recording state machine.
   * Determines which actions are valid and controls UI state.
   */
  const [state, setState] = React.useState<RecordingState>('idle');

  /**
   * Currently selected recording mode.
   * Must be set before starting a recording.
   */
  const [mode, setMode] = React.useState<RecordingMode | null>(null);

  /**
   * Current duration of the recording in seconds.
   * Updated every 1000ms while recording is active.
   */
  const [duration, setDuration] = React.useState(0);

  /**
   * Error object if state is 'error', null otherwise.
   * Contains details about what went wrong.
   */
  const [error, setError] = React.useState<Error | null>(null);

  /**
   * Recorded audio as a Blob (available when recording is completed).
   * Can be used for upload or further processing.
   */
  const [audioBlob, setAudioBlob] = React.useState<Blob | null>(null);

  /**
   * Object URL for audio playback (available when recording is completed).
   * Must be revoked when no longer needed to prevent memory leaks.
   */
  const [audioUrl, setAudioUrl] = React.useState<string | null>(null);

  // ============================================================================
  // Refs for MediaRecorder and Timing
  // ============================================================================

  /**
   * Reference to the active MediaRecorder instance.
   * Used to control recording, pause, resume, and stop operations.
   */
  const mediaRecorderRef = React.useRef<MediaRecorder | null>(null);

  /**
   * Reference to the active MediaStream.
   * Must be stopped to release camera/microphone/system audio resources.
   */
  const streamRef = React.useRef<MediaStream | null>(null);

  /**
   * Array of recorded audio chunks.
   * Accumulated during recording and combined into a Blob when stopped.
   */
  const chunksRef = React.useRef<Blob[]>([]);

  /**
   * Reference to the interval timer for duration updates.
   * Cleared when recording is paused or stopped.
   */
  const timerRef = React.useRef<NodeJS.Timeout | null>(null);

  /**
   * Timestamp when recording started (from Date.now()).
   * Used to calculate elapsed time accurately.
   */
  const startTimeRef = React.useRef<number>(0);

  /**
   * Cumulative duration of all paused periods in seconds.
   * Subtracted from elapsed time to get active recording duration.
   */
  const pausedDurationRef = React.useRef<number>(0);

  /**
   * Flag to prevent concurrent stop operations.
   * Guards against race conditions when stopRecording is called
   * while chunks are still being processed.
   */
  const isProcessingRef = React.useRef<boolean>(false);

  /**
   * Flag to track if the 30-minute duration warning has been fired.
   * Prevents repeated calls to onDurationWarning callback.
   * Reset when recording is reset/discarded.
   */
  const durationWarningFiredRef = React.useRef<boolean>(false);

  // ============================================================================
  // Cleanup Function
  // ============================================================================

  /**
   * Centralized cleanup function for releasing all recording resources.
   *
   * This function:
   * - Stops and clears the duration timer
   * - Stops the MediaRecorder if active
   * - Stops all MediaStream tracks (releases mic/camera/system audio)
   * - Revokes object URLs to prevent memory leaks
   * - Clears the audio chunks array
   *
   * Called on:
   * - Component unmount
   * - Discard recording
   * - Reset
   * - Before starting new recording (if needed)
   */
  const cleanup = React.useCallback(() => {
    // Stop and clear timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    // Stop MediaRecorder if active
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch (err) {
        // MediaRecorder might already be stopped, ignore error
        console.warn('Error stopping MediaRecorder during cleanup:', err);
      }
    }
    mediaRecorderRef.current = null;

    // Stop all media stream tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        try {
          track.stop();
        } catch (err) {
          console.warn('Error stopping media track:', err);
        }
      });
      streamRef.current = null;
    }

    // Revoke object URL to prevent memory leak
    if (audioUrl) {
      try {
        URL.revokeObjectURL(audioUrl);
      } catch (err) {
        console.warn('Error revoking object URL:', err);
      }
    }

    // Clear chunks
    chunksRef.current = [];
  }, [audioUrl]);

  // ============================================================================
  // Timer Management
  // ============================================================================

  /**
   * Duration warning threshold in seconds (30 minutes).
   */
  const DURATION_WARNING_THRESHOLD_SECONDS = 1800;

  /**
   * Start the duration timer.
   *
   * Updates the duration state every 1000ms based on wall clock time
   * (Date.now()), accounting for any paused duration.
   *
   * This approach prevents timer drift and ensures accurate duration
   * tracking even if the event loop is busy.
   *
   * Also checks for duration warning threshold (30 minutes) and fires
   * the onDurationWarning callback once when crossed.
   */
  const startTimer = React.useCallback(() => {
    // Calculate effective start time accounting for paused duration
    startTimeRef.current = Date.now() - (pausedDurationRef.current * 1000);

    timerRef.current = setInterval(() => {
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      const elapsedSeconds = Math.floor(elapsed);
      setDuration(elapsedSeconds);

      // Check if we've crossed the 30-minute threshold
      if (
        !durationWarningFiredRef.current &&
        elapsedSeconds >= DURATION_WARNING_THRESHOLD_SECONDS &&
        onDurationWarning
      ) {
        durationWarningFiredRef.current = true;
        onDurationWarning(30);
      }
    }, 1000); // Update every 1000ms - MM:SS display only changes every second
  }, [onDurationWarning]);

  /**
   * Stop the duration timer.
   *
   * Preserves the current duration in pausedDurationRef so that
   * it can be restored when resuming.
   */
  const stopTimer = React.useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    // Store current duration so it can be restored on resume
    pausedDurationRef.current = duration;
  }, [duration]);

  // ============================================================================
  // Recording Mode Selection
  // ============================================================================

  /**
   * Select the recording mode.
   *
   * Must be called before starting a recording. Can only be changed
   * when in 'idle' state.
   *
   * @param newMode - The recording mode to select
   */
  const selectMode = React.useCallback((newMode: RecordingMode) => {
    // Only allow mode selection in idle state
    if (state !== 'idle') {
      console.warn('Cannot change recording mode while recording is in progress');
      return;
    }
    setMode(newMode);
  }, [state]);

  // ============================================================================
  // Recording Control Functions
  // ============================================================================

  /**
   * Start recording (placeholder - must use startRecordingWithStream).
   *
   * This function validates that a mode is selected but throws an error
   * to indicate that startRecordingWithStream must be used instead.
   *
   * The actual stream acquisition should be handled by the consumer
   * based on the selected recording mode, then passed to
   * startRecordingWithStream.
   *
   * @throws Error if no mode is selected or if called directly
   */
  const startRecording = React.useCallback(async () => {
    if (!mode) {
      const err = new Error('Please select a recording mode first');
      setError(err);
      setState('error');
      onError?.(err);
      return;
    }

    setState('preparing');
    setError(null);
    chunksRef.current = [];
    pausedDurationRef.current = 0;
    setDuration(0);

    // This is intentionally not implemented - the consumer should use
    // startRecordingWithStream after obtaining the appropriate stream
    const err = new Error(
      'Stream not provided. Use startRecordingWithStream with the appropriate MediaStream for the selected mode.'
    );
    setState('error');
    setError(err);
    onError?.(err);
  }, [mode, onError]);

  /**
   * Start recording with a provided MediaStream.
   *
   * This is the primary method for starting a recording. The consumer
   * is responsible for obtaining the appropriate MediaStream based on
   * the selected recording mode.
   *
   * For example:
   * - microphone: getUserMedia({ audio: true })
   * - system-audio: getDisplayMedia({ audio: true, video: false })
   * - commentary: Combined stream from both sources
   *
   * @param stream - The MediaStream to record from
   */
  const startRecordingWithStream = React.useCallback((stream: MediaStream) => {
    try {
      // Store stream reference for cleanup
      streamRef.current = stream;

      // Determine best supported MIME type with validated fallback chain
      // Priority: webm with opus codec > webm > mp4 > ogg
      const mimeOptions = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/ogg',
      ];

      let mimeType: string | undefined;
      for (const type of mimeOptions) {
        if (MediaRecorder.isTypeSupported(type)) {
          mimeType = type;
          break;
        }
      }

      // Error if no supported format found
      if (!mimeType) {
        const err = new Error('No supported audio recording format available in this browser');
        setError(err);
        setState('error');
        onError?.(err);
        return;
      }

      // Create MediaRecorder instance with bitrate constraint
      // 96kbps is sufficient for speech while reducing file size
      const recorder = new MediaRecorder(stream, {
        mimeType,
        audioBitsPerSecond: 96000
      });
      mediaRecorderRef.current = recorder;

      // Handle data available event - collect chunks
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      // Handle stop event - create final blob and URL
      recorder.onstop = () => {
        // Create blob from accumulated chunks
        const blob = new Blob(chunksRef.current, { type: mimeType });
        setAudioBlob(blob);

        // Create object URL for playback
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);

        // Update state to completed
        setState('completed');

        // Stop timer
        stopTimer();

        // Notify callback
        onRecordingComplete?.(blob);
      };

      // Handle recording errors
      recorder.onerror = () => {
        const err = new Error('Recording error occurred');
        setError(err);
        setState('error');
        onError?.(err);
      };

      // Start recording with 1000ms time slice for smooth data collection
      recorder.start(1000);

      // Start duration timer
      startTimer();

      // Update state to recording
      setState('recording');
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to start recording');
      setError(error);
      setState('error');
      onError?.(error);
    }
  }, [startTimer, stopTimer, onRecordingComplete, onError]);

  /**
   * Pause the current recording.
   *
   * Can only be called when state is 'recording'.
   * The recording can be resumed later with resumeRecording.
   */
  const pauseRecording = React.useCallback(() => {
    // Validate state and recorder
    if (state !== 'recording' || !mediaRecorderRef.current) {
      console.warn('Cannot pause: no active recording');
      return;
    }

    // Pause the MediaRecorder
    try {
      mediaRecorderRef.current.pause();
      stopTimer();
      setState('paused');
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to pause recording');
      setError(error);
      setState('error');
      onError?.(error);
    }
  }, [state, stopTimer, onError]);

  /**
   * Resume a paused recording.
   *
   * Can only be called when state is 'paused'.
   * Continues recording from where it was paused.
   */
  const resumeRecording = React.useCallback(() => {
    // Validate state and recorder
    if (state !== 'paused' || !mediaRecorderRef.current) {
      console.warn('Cannot resume: recording is not paused');
      return;
    }

    // Resume the MediaRecorder
    try {
      mediaRecorderRef.current.resume();
      startTimer();
      setState('recording');
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to resume recording');
      setError(error);
      setState('error');
      onError?.(error);
    }
  }, [state, startTimer, onError]);

  /**
   * Stop the current recording.
   *
   * Can be called when state is 'recording' or 'paused'.
   * Finalizes the recording and makes the audio blob available.
   *
   * Includes guards for:
   * - Race condition prevention (concurrent stop operations)
   * - Minimum recording duration validation (1 second minimum)
   * - Final data capture before stopping
   */
  const stopRecording = React.useCallback(() => {
    // Guard against concurrent stop operations to prevent race conditions
    if (isProcessingRef.current) {
      console.warn('Recording stop already in progress');
      return;
    }

    // Validate state and recorder
    if (!mediaRecorderRef.current || (state !== 'recording' && state !== 'paused')) {
      console.warn('Cannot stop: no active recording');
      return;
    }

    // Check minimum recording duration (1 second)
    // Use real-time calculation instead of state to avoid timer tick race condition
    const actualDuration = state === 'paused'
      ? pausedDurationRef.current
      : (Date.now() - startTimeRef.current) / 1000;

    if (actualDuration < 1) {
      const err = new Error('Recording is too short (minimum 1 second)');
      setError(err);
      onError?.(err);
      discardRecording();
      return;
    }

    isProcessingRef.current = true;

    try {
      // Request final data before stopping to ensure all chunks are captured
      if (mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.requestData();
      }

      // Stop the MediaRecorder (this triggers the onstop event)
      mediaRecorderRef.current.stop();

      // Stop all stream tracks to release resources
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to stop recording');
      setError(error);
      setState('error');
      onError?.(error);
    } finally {
      isProcessingRef.current = false;
    }
  // Note: discardRecording is defined below but we use it here.
  // React hooks allow this pattern - the callback isn't called until after mount.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, onError]);

  /**
   * Discard the current recording without saving.
   *
   * Cleans up all resources and returns to idle state,
   * but keeps the selected mode for convenience.
   */
  const discardRecording = React.useCallback(() => {
    cleanup();
    setAudioBlob(null);
    setAudioUrl(null);
    setDuration(0);
    setError(null);
    setState('idle');
    pausedDurationRef.current = 0;
    durationWarningFiredRef.current = false;
    // Note: We intentionally keep the mode selected
  }, [cleanup]);

  /**
   * Reset all recording state to initial values.
   *
   * Cleans up all resources and clears the selected mode.
   * Returns the hook to its initial state.
   */
  const reset = React.useCallback(() => {
    cleanup();
    setMode(null);
    setAudioBlob(null);
    setAudioUrl(null);
    setDuration(0);
    setError(null);
    setState('idle');
    pausedDurationRef.current = 0;
    durationWarningFiredRef.current = false;
  }, [cleanup]);

  // ============================================================================
  // Cleanup on Unmount
  // ============================================================================

  /**
   * Cleanup effect for component unmount.
   *
   * Ensures all resources are released when the component using
   * this hook is unmounted, preventing memory leaks and resource
   * contention.
   */
  React.useEffect(() => {
    return cleanup;
  }, [cleanup]);

  // ============================================================================
  // Return Hook Interface
  // ============================================================================

  return {
    // State
    state,
    mode,
    duration,
    error,
    audioBlob,
    audioUrl,

    // Actions
    selectMode,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    discardRecording,
    reset,

    // Additional action for external stream provision
    startRecordingWithStream,
  };
}

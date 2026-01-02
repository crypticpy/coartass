/**
 * Audio Sources Hook
 *
 * Custom React hook for managing audio source acquisition across different recording modes.
 * Handles microphone capture, system audio capture, and commentary mode (mixing both).
 *
 * Features:
 * - Microphone capture via getUserMedia() with audio optimization
 * - System audio capture via getDisplayMedia() (browser tab/window audio)
 * - Commentary mode - real-time mixing of microphone and system audio using Web Audio API
 * - Proper stream lifecycle management and cleanup
 * - Browser capability detection for each mode
 * - Comprehensive error handling with user-friendly messages
 *
 * Usage:
 * ```tsx
 * const { requestStreamForMode, stopAllStreams, error } = useAudioSources();
 *
 * // Request stream for a specific recording mode
 * const stream = await requestStreamForMode('commentary');
 *
 * // Cleanup when done
 * stopAllStreams();
 * ```
 */

"use client";

import * as React from 'react';
import type { RecordingMode } from '@/types/recording';

/**
 * Return type for the useAudioSources hook
 */
interface UseAudioSourcesReturn {
  /** Request microphone stream with optimized audio constraints */
  requestMicrophoneStream: () => Promise<MediaStream>;

  /** Request system audio stream via screen/tab sharing */
  requestSystemAudioStream: () => Promise<MediaStream>;

  /** Request commentary stream (microphone + system audio mixed) */
  requestCommentaryStream: () => Promise<MediaStream>;

  /** Request appropriate stream based on recording mode */
  requestStreamForMode: (mode: RecordingMode) => Promise<MediaStream>;

  /** Stop and cleanup all active streams */
  stopAllStreams: () => void;

  /** List of currently active media streams */
  activeStreams: MediaStream[];

  /** Current error state (null if no error) */
  error: Error | null;
}

/**
 * Check if a specific recording mode is supported by the current browser
 *
 * @param mode - The recording mode to check
 * @returns true if the mode is supported, false otherwise
 */
function isModeSupported(mode: RecordingMode): boolean {
  // Check if we're in a browser environment
  if (typeof window === 'undefined' || !navigator.mediaDevices) {
    return false;
  }

  switch (mode) {
    case 'microphone':
      // Microphone requires getUserMedia
      return 'getUserMedia' in navigator.mediaDevices;

    case 'system-audio':
    case 'commentary':
      // System audio and commentary require getDisplayMedia
      // getDisplayMedia is required for capturing tab/window audio
      return 'getDisplayMedia' in navigator.mediaDevices;

    default:
      return false;
  }
}

/**
 * Custom hook for managing audio source acquisition
 *
 * Provides methods to request different types of audio streams (microphone, system audio,
 * or both mixed together), with proper cleanup and error handling.
 *
 * The hook manages the lifecycle of all MediaStreams, ensuring proper cleanup when
 * the component unmounts or when stopAllStreams() is called.
 *
 * @returns Audio source management methods and state
 *
 * @example
 * ```tsx
 * function RecordingComponent() {
 *   const { requestStreamForMode, stopAllStreams, error } = useAudioSources();
 *   const [mode, setMode] = useState<RecordingMode>('microphone');
 *
 *   const startRecording = async () => {
 *     try {
 *       const stream = await requestStreamForMode(mode);
 *       // Use stream with MediaRecorder...
 *     } catch (err) {
 *       console.error('Failed to get audio stream:', err);
 *     }
 *   };
 *
 *   return (
 *     <div>
 *       <button onClick={startRecording}>Start Recording</button>
 *       <button onClick={stopAllStreams}>Stop All Streams</button>
 *       {error && <p>Error: {error.message}</p>}
 *     </div>
 *   );
 * }
 * ```
 */
export function useAudioSources(): UseAudioSourcesReturn {
  // State for tracking active streams
  const [activeStreams, setActiveStreams] = React.useState<MediaStream[]>([]);

  // State for error handling
  const [error, setError] = React.useState<Error | null>(null);

  // Ref to store AudioContext for commentary mode
  // Using ref to persist across renders without triggering re-renders
  const audioContextRef = React.useRef<AudioContext | null>(null);

  // Use ref to track streams for cleanup without triggering effect re-runs
  const activeStreamsRef = React.useRef<MediaStream[]>([]);

  // Sync ref with state
  React.useEffect(() => {
    activeStreamsRef.current = activeStreams;
  }, [activeStreams]);

  /**
   * Cleanup function - stops all active streams and closes audio context
   * Called on unmount only to prevent memory leaks
   */
  React.useEffect(() => {
    return () => {
      // Stop all media tracks using ref value
      activeStreamsRef.current.forEach(stream => {
        stream.getTracks().forEach(track => track.stop());
      });

      // Close audio context if it exists
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []); // Empty deps - cleanup only on unmount

  /**
   * Stop all active streams and reset state
   *
   * This method stops all tracks in all active streams, closes the audio context
   * if one exists, and resets the state. Call this when stopping recording or
   * when switching between recording modes.
   */
  const stopAllStreams = React.useCallback(() => {
    // Stop all tracks in all active streams
    activeStreams.forEach(stream => {
      stream.getTracks().forEach(track => track.stop());
    });

    // Clear active streams state
    setActiveStreams([]);

    // Clear any previous errors
    setError(null);

    // Close and reset audio context
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
  }, [activeStreams]);

  /**
   * Request microphone stream with optimized audio constraints
   *
   * Uses getUserMedia to capture microphone input with audio processing
   * enabled for better quality (echo cancellation, noise suppression, auto gain).
   *
   * @returns Promise resolving to MediaStream with microphone audio
   * @throws Error if microphone access is denied or unavailable
   *
   * @example
   * ```tsx
   * const stream = await requestMicrophoneStream();
   * const recorder = new MediaRecorder(stream);
   * recorder.start();
   * ```
   */
  const requestMicrophoneStream = React.useCallback(async (): Promise<MediaStream> => {
    try {
      // Request microphone access with audio constraints optimized for voice
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,      // Reduce echo feedback
          noiseSuppression: true,       // Reduce background noise
          autoGainControl: true,        // Normalize volume levels
        },
      });

      // Track this stream for cleanup
      setActiveStreams(prev => [...prev, stream]);

      // Clear any previous errors
      setError(null);

      return stream;
    } catch (err) {
      // Handle getUserMedia errors with user-friendly messages
      const error = err instanceof Error ? err : new Error('Failed to access microphone');
      setError(error);
      throw error;
    }
  }, []);

  /**
   * Request system audio stream via getDisplayMedia
   *
   * Prompts the user to select a browser tab, window, or entire screen to capture.
   * The video track is immediately stopped as we only need audio. Users must
   * explicitly check "Share audio" in the browser dialog for this to work.
   *
   * Note: Chrome requires video to be requested even if we only want audio.
   * The video track is stopped immediately after acquisition.
   *
   * @returns Promise resolving to MediaStream with system audio
   * @throws Error if system audio is not supported, access is denied, or no audio track is available
   *
   * @example
   * ```tsx
   * const stream = await requestSystemAudioStream();
   * // User will see browser dialog to select what to share
   * // They must check "Share audio" option
   * ```
   */
  const requestSystemAudioStream = React.useCallback(async (): Promise<MediaStream> => {
    // Check browser support first
    if (!isModeSupported('system-audio')) {
      const error = new Error('System audio capture is not supported in this browser. Please use Chrome, Edge, or a recent version of Firefox.');
      setError(error);
      throw error;
    }

    try {
      // Request display media with audio
      // Note: Chrome requires video even if we only want audio
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,  // Required by Chrome (will be stopped immediately)
        audio: {
          echoCancellation: false,  // Don't process system audio
          noiseSuppression: false,  // Keep original audio quality
          autoGainControl: false,   // Don't adjust system audio levels
        },
      });

      // Stop all video tracks immediately - we only want audio
      stream.getVideoTracks().forEach(track => {
        track.stop();
      });

      // Verify we actually got an audio track
      if (stream.getAudioTracks().length === 0) {
        // If no audio track, stop the stream and throw error
        stream.getTracks().forEach(track => track.stop());
        const error = new Error('No audio track received. Make sure to check "Share audio" when selecting what to share.');
        setError(error);
        throw error;
      }

      // Track this stream for cleanup
      setActiveStreams(prev => [...prev, stream]);

      // Clear any previous errors
      setError(null);

      return stream;
    } catch (err) {
      // Handle specific error cases
      if (err instanceof Error && err.name === 'NotAllowedError') {
        const error = new Error('Permission denied. Please allow screen sharing and make sure to enable audio.');
        setError(error);
        throw error;
      }

      // Re-throw our custom errors (like the "no audio track" error)
      if (err instanceof Error && err.message.includes('No audio track')) {
        throw err;
      }

      // Generic error handler
      const error = err instanceof Error ? err : new Error('Failed to capture system audio');
      setError(error);
      throw error;
    }
  }, []);

  /**
   * Request commentary mode stream - mix microphone and system audio
   *
   * This creates two streams (microphone and system audio) and mixes them together
   * using the Web Audio API. The result is a single stream containing both audio sources.
   *
   * Flow:
   * 1. Request system audio (with user dialog to select what to share)
   * 2. Request microphone audio
   * 3. Create AudioContext and connect both sources
   * 4. Mix both sources into a single output stream
   * 5. Return the mixed stream
   *
   * The Web Audio API graph:
   * ```
   * [System Audio Source] -> [System Gain] ──┐
   *                                            ├─> [Destination Stream]
   * [Microphone Source]   -> [Mic Gain]    ──┘
   * ```
   *
   * @returns Promise resolving to MediaStream with both audio sources mixed
   * @throws Error if commentary mode is not supported or if either stream fails to initialize
   *
   * @example
   * ```tsx
   * const stream = await requestCommentaryStream();
   * // User will first see dialog to select system audio
   * // Then browser will request microphone permission
   * // Resulting stream contains both mixed together
   * ```
   */
  const requestCommentaryStream = React.useCallback(async (): Promise<MediaStream> => {
    // Check browser support first
    if (!isModeSupported('commentary')) {
      const error = new Error('Commentary mode is not supported in this browser. Please use Chrome, Edge, or a recent version of Firefox.');
      setError(error);
      throw error;
    }

    try {
      // Request both streams in parallel for better UX
      // This shows both permission dialogs at once (or in quick succession)
      const [systemStream, micStream] = await Promise.all([
        // Get system audio stream first
        (async () => {
          const stream = await navigator.mediaDevices.getDisplayMedia({
            video: true,  // Required by Chrome
            audio: {
              echoCancellation: false,
              noiseSuppression: false,
              autoGainControl: false,
            },
          });

          // Stop video tracks immediately
          stream.getVideoTracks().forEach(track => {
            track.stop();
          });

          // Verify we got audio
          if (stream.getAudioTracks().length === 0) {
            stream.getTracks().forEach(track => track.stop());
            throw new Error('No audio track received. Make sure to enable "Share audio" when selecting what to share.');
          }

          return stream;
        })(),

        // Get microphone stream
        navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        }),
      ]);

      // Create Web Audio API context for mixing
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;

      // Create destination for the mixed output
      const destination = audioContext.createMediaStreamDestination();

      // Create source nodes from the input streams
      const systemSource = audioContext.createMediaStreamSource(systemStream);
      const micSource = audioContext.createMediaStreamSource(micStream);

      // Create gain nodes for independent volume control
      // This allows us to adjust the balance between mic and system audio if needed
      const systemGain = audioContext.createGain();
      const micGain = audioContext.createGain();

      // Set initial gain values (1.0 = 100%, no change)
      // These could be made adjustable in the future
      systemGain.gain.value = 1.0;
      micGain.gain.value = 1.0;

      // Connect the audio graph:
      // Source -> Gain -> Destination
      systemSource.connect(systemGain);
      micSource.connect(micGain);

      systemGain.connect(destination);
      micGain.connect(destination);

      // Track all streams for cleanup (both source streams and the mixed output)
      setActiveStreams(prev => [...prev, systemStream, micStream, destination.stream]);

      // Clear any previous errors
      setError(null);

      // Return the mixed stream from the destination node
      return destination.stream;
    } catch (err) {
      // Handle errors from either stream acquisition
      const error = err instanceof Error ? err : new Error('Failed to set up commentary mode');
      setError(error);
      throw error;
    }
  }, []);

  /**
   * Request appropriate stream based on recording mode
   *
   * This is a convenience method that delegates to the appropriate specific
   * stream request method based on the provided mode.
   *
   * @param mode - The recording mode (microphone, system-audio, or commentary)
   * @returns Promise resolving to MediaStream for the requested mode
   * @throws Error if mode is not recognized or if stream acquisition fails
   *
   * @example
   * ```tsx
   * const mode = 'commentary';
   * const stream = await requestStreamForMode(mode);
   * ```
   */
  const requestStreamForMode = React.useCallback(async (mode: RecordingMode): Promise<MediaStream> => {
    switch (mode) {
      case 'microphone':
        return requestMicrophoneStream();

      case 'system-audio':
        return requestSystemAudioStream();

      case 'commentary':
        return requestCommentaryStream();

      default:
        // TypeScript should prevent this, but handle it just in case
        const error = new Error(`Unknown recording mode: ${mode}`);
        setError(error);
        throw error;
    }
  }, [requestMicrophoneStream, requestSystemAudioStream, requestCommentaryStream]);

  return {
    requestMicrophoneStream,
    requestSystemAudioStream,
    requestCommentaryStream,
    requestStreamForMode,
    stopAllStreams,
    activeStreams,
    error,
  };
}

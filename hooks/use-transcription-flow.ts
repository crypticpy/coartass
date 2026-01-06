/**
 * Transcription Flow Hook
 *
 * Custom React hook for managing the complete transcription lifecycle.
 * Handles uploading audio blobs to the transcription API with progress tracking,
 * error handling, and state management.
 *
 * Features:
 * - Upload audio blobs directly to /api/transcribe
 * - Real-time progress tracking (preparing, uploading, transcribing, complete)
 * - Cancellation support via AbortController
 * - Comprehensive error handling with retry capability
 * - Automatic state cleanup
 *
 * Usage:
 * ```tsx
 * const { state, startTranscription, cancelTranscription, reset } = useTranscriptionFlow({
 *   onComplete: (transcriptId) => router.push(`/transcripts/${transcriptId}/analyze`),
 *   onError: (error) => console.error(error),
 * });
 *
 * // Start transcription with a blob
 * await startTranscription(audioBlob, 'my-recording');
 * ```
 */

"use client";

import * as React from 'react';
import { withRetry, isUserCancellation } from '@/lib/retry';

/**
 * Transcription flow status states
 */
export type TranscriptionStatus =
  | 'idle'         // Initial state, no transcription in progress
  | 'preparing'    // Preparing the audio file for upload
  | 'uploading'    // Uploading to the transcription API
  | 'transcribing' // Server is transcribing the audio
  | 'complete'     // Transcription completed successfully
  | 'error';       // An error occurred

/**
 * State object for transcription flow
 */
export interface TranscriptionFlowState {
  /** Current status of the transcription */
  status: TranscriptionStatus;
  /** Progress percentage (0-100) */
  progress: number;
  /** Current status message */
  message: string;
  /** Error object if status is 'error' */
  error: Error | null;
  /** Transcript ID if status is 'complete' */
  transcriptId: string | null;
}

/**
 * Options for the useTranscriptionFlow hook
 */
export interface UseTranscriptionFlowOptions {
  /** Callback when transcription completes successfully */
  onComplete?: (transcriptId: string) => void;
  /** Callback when an error occurs */
  onError?: (error: Error) => void;
  /** Language code for transcription (optional, auto-detect if not provided) */
  language?: string;
  /** Whisper model to use */
  model?: string;
  /** Enable speaker diarization */
  enableSpeakerDetection?: boolean;
}

/**
 * Return type for the useTranscriptionFlow hook
 */
export interface UseTranscriptionFlowReturn {
  /** Current state of the transcription flow */
  state: TranscriptionFlowState;
  /** Start transcription with an audio blob */
  startTranscription: (blob: Blob, filename?: string) => Promise<void>;
  /** Cancel the current transcription */
  cancelTranscription: () => void;
  /** Reset to idle state */
  reset: () => void;
}

/**
 * Initial state for the transcription flow
 */
const initialState: TranscriptionFlowState = {
  status: 'idle',
  progress: 0,
  message: '',
  error: null,
  transcriptId: null,
};

/**
 * Upload result from the transcription API
 */
interface UploadResult {
  success: boolean;
  data?: { id: string };
  error?: string;
}

/**
 * Options for the upload helper
 */
interface UploadOptions {
  formData: FormData;
  abortSignal?: AbortSignal;
  onUploadProgress: (percent: number) => void;
  onTranscribing: (progress: number, message: string) => void;
}

/**
 * Encapsulates XHR upload with progress simulation.
 *
 * Handles all the low-level XHR mechanics including:
 * - Upload progress tracking
 * - Transcription phase progress simulation
 * - Timeout handling
 * - Cancellation support
 * - Proper event listener cleanup to prevent memory leaks
 *
 * @param options - Upload configuration
 * @returns Promise resolving to the upload result
 */
function uploadAudioWithProgress(options: UploadOptions): Promise<UploadResult> {
  const { formData, abortSignal, onUploadProgress, onTranscribing } = options;

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    let interval: NodeJS.Timeout | null = null;

    /**
     * Clears the progress simulation interval
     */
    const clearSimulation = () => {
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
    };

    /**
     * Removes all event listeners from the XHR object and AbortSignal.
     * Called on request completion, error, or abort to prevent memory leaks.
     */
    const cleanupEventListeners = () => {
      // Remove XHR upload event listeners
      xhr.upload.removeEventListener('progress', onProgressHandler);
      xhr.upload.removeEventListener('load', onUploadLoadHandler);

      // Remove XHR event listeners
      xhr.removeEventListener('load', onLoadHandler);
      xhr.removeEventListener('error', onErrorHandler);
      xhr.removeEventListener('abort', onAbortHandler);

      // Remove AbortSignal listener if it was added
      if (abortSignal) {
        abortSignal.removeEventListener('abort', onAbortSignalHandler);
      }
    };

    /**
     * Performs full cleanup: clears simulation and removes event listeners.
     * Ensures all resources are released regardless of how the request ends.
     */
    const performFullCleanup = () => {
      clearSimulation();
      cleanupEventListeners();
    };

    // Define named event handlers for proper cleanup

    /**
     * Handles upload progress events
     */
    const onProgressHandler = (event: ProgressEvent) => {
      if (event.lengthComputable && event.total > 0) {
        const uploadPercent = (event.loaded / event.total) * 100;
        onUploadProgress(uploadPercent);
      }
    };

    /**
     * Handles upload completion - starts transcription progress simulation
     */
    const onUploadLoadHandler = () => {
      let simulatedProgress = 55;
      interval = setInterval(() => {
        if (simulatedProgress < 95) {
          // Random increment between 2-7% for natural feel
          simulatedProgress = Math.min(simulatedProgress + (Math.random() * 5 + 2), 95);
          onTranscribing(simulatedProgress, `Transcribing audio... ${Math.round(simulatedProgress)}%`);
        }
      }, 3000);
    };

    /**
     * Handles XHR load event (request completed)
     */
    const onLoadHandler = () => {
      performFullCleanup();
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText));
        } catch {
          reject(new Error('Failed to parse transcription response'));
        }
      } else {
        try {
          const errorData = JSON.parse(xhr.responseText);
          reject(new Error(errorData.error || `Transcription failed with status ${xhr.status}`));
        } catch {
          reject(new Error(`Transcription failed with status ${xhr.status}`));
        }
      }
    };

    /**
     * Handles XHR error event (network error)
     */
    const onErrorHandler = () => {
      performFullCleanup();
      reject(new Error('Network error during transcription'));
    };

    /**
     * Handles XHR abort event (request cancelled)
     */
    const onAbortHandler = () => {
      performFullCleanup();
      reject(new Error('Transcription cancelled'));
    };

    /**
     * Handles AbortSignal abort event - triggers XHR abort
     */
    const onAbortSignalHandler = () => {
      xhr.abort();
    };

    // Set 5-minute timeout for slow networks
    xhr.timeout = 300000;

    xhr.ontimeout = () => {
      performFullCleanup();
      reject(
        new Error('Upload timed out after 5 minutes. Please check your connection and try again.')
      );
    };

    // Track upload progress
    xhr.upload.addEventListener('progress', onProgressHandler);

    // Upload complete, start progress simulation during transcription
    xhr.upload.addEventListener('load', onUploadLoadHandler);

    // Handle completion
    xhr.addEventListener('load', onLoadHandler);

    // Handle errors
    xhr.addEventListener('error', onErrorHandler);

    // Handle abort
    xhr.addEventListener('abort', onAbortHandler);

    // Handle cancellation via AbortSignal
    if (abortSignal) {
      abortSignal.addEventListener('abort', onAbortSignalHandler);
    }

    // Send request
    xhr.open('POST', '/api/transcribe');
    xhr.send(formData);
  });
}

/**
 * Custom hook for managing transcription flow
 *
 * Provides a complete state machine for the transcription process,
 * from preparing the file to receiving the completed transcript.
 *
 * @param options - Configuration options
 * @returns Transcription state and control functions
 *
 * @example
 * ```tsx
 * function TranscribeButton({ audioBlob }: { audioBlob: Blob }) {
 *   const router = useRouter();
 *   const { state, startTranscription, cancelTranscription } = useTranscriptionFlow({
 *     onComplete: (id) => router.push(`/transcripts/${id}/analyze`),
 *   });
 *
 *   if (state.status === 'idle') {
 *     return (
 *       <Button onClick={() => startTranscription(audioBlob)}>
 *         Transcribe Now
 *       </Button>
 *     );
 *   }
 *
 *   if (state.status === 'error') {
 *     return (
 *       <Alert color="red">{state.error?.message}</Alert>
 *     );
 *   }
 *
 *   return (
 *     <Progress value={state.progress} label={state.message} />
 *   );
 * }
 * ```
 */
export function useTranscriptionFlow(
  options: UseTranscriptionFlowOptions = {}
): UseTranscriptionFlowReturn {
  const {
    onComplete,
    onError,
    language,
    model = 'gpt-4o-transcribe',
    enableSpeakerDetection = model === 'gpt-4o-transcribe-diarize',
  } = options;

  // State management
  const [state, setState] = React.useState<TranscriptionFlowState>(initialState);

  // AbortController for cancellation
  const abortControllerRef = React.useRef<AbortController | null>(null);

  /**
   * Update state helper
   */
  const updateState = React.useCallback((updates: Partial<TranscriptionFlowState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  /**
   * Reset to initial state
   */
  const reset = React.useCallback(() => {
    // Cancel any in-progress operation
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setState(initialState);
  }, []);

  /**
   * Cancel the current transcription
   */
  const cancelTranscription = React.useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    updateState({
      status: 'idle',
      progress: 0,
      message: 'Transcription cancelled',
      error: null,
    });
  }, [updateState]);

  /**
   * Start transcription with an audio blob
   */
  const startTranscription = React.useCallback(
    async (blob: Blob, filename?: string): Promise<void> => {
      // Reset any previous state
      reset();

      // Create new AbortController
      abortControllerRef.current = new AbortController();

      try {
        // Phase 1: Preparing
        updateState({
          status: 'preparing',
          progress: 5,
          message: 'Preparing audio file...',
          error: null,
          transcriptId: null,
        });

        // Create File from Blob
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
        const extension = blob.type.includes('webm') ? 'webm' : blob.type.includes('mp4') ? 'mp4' : 'webm';
        const file = new File(
          [blob],
          filename ? `${filename}.${extension}` : `recording-${timestamp}.${extension}`,
          { type: blob.type, lastModified: Date.now() }
        );

        // Create FormData
        const formData = new FormData();
        formData.append('file', file);

        if (language) {
          formData.append('language', language);
        }

        if (model) {
          formData.append('model', model);
        }

        formData.append('enableSpeakerDetection', String(enableSpeakerDetection));

        // Phase 2: Uploading
        updateState({
          status: 'uploading',
          progress: 10,
          message: 'Uploading audio...',
        });

        // Use the extracted upload helper with retry logic
        const result = await withRetry(
          () => uploadAudioWithProgress({
            formData,
            abortSignal: abortControllerRef.current?.signal,
            onUploadProgress: (uploadPercent) => {
              // Map upload progress to 10-50% range
              const mappedProgress = 10 + Math.round(uploadPercent * 0.4);
              updateState({
                progress: Math.min(mappedProgress, 50),
                message: `Uploading... ${Math.round(uploadPercent)}%`,
              });
            },
            onTranscribing: (progress, message) => {
              updateState({
                status: 'transcribing',
                progress: Math.round(progress),
                message,
              });
            },
          }),
          { maxRetries: 3, baseDelay: 2000 }
        );

        // Check result
        if (!result.success || !result.data?.id) {
          throw new Error(result.error || 'Transcription failed - no transcript ID returned');
        }

        // Phase 4: Complete
        const transcriptId = result.data.id;
        updateState({
          status: 'complete',
          progress: 100,
          message: 'Transcription complete!',
          transcriptId,
        });

        // Call onComplete callback
        onComplete?.(transcriptId);

      } catch (error) {
        const errorObj = error instanceof Error ? error : new Error('Transcription failed');

        // Don't update state if cancelled by user
        if (isUserCancellation(errorObj)) {
          return;
        }

        updateState({
          status: 'error',
          progress: 0,
          message: errorObj.message,
          error: errorObj,
        });

        // Call onError callback
        onError?.(errorObj);
      }
    },
    [reset, updateState, language, model, enableSpeakerDetection, onComplete, onError]
  );

  /**
   * Cleanup on unmount
   */
  React.useEffect(() => {
    return () => {
      // Abort any in-progress transcription request
      // The XHR and progress simulation are cleaned up via the abort signal
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    state,
    startTranscription,
    cancelTranscription,
    reset,
  };
}

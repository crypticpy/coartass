/**
 * Custom Hook for File Upload State Management
 *
 * Provides comprehensive file upload functionality including:
 * - File selection and validation
 * - Audio metadata extraction using Web Audio API
 * - Upload progress tracking
 * - Error handling
 * - Transcription API integration
 */

"use client";

import React, { useState, useCallback, useRef } from 'react';
import { validateFileUpload, type FileUpload } from '@/lib/validations';
import { getFileProcessingStrategy, processAudioForTranscription } from '@/lib/audio-processing';
import type {
  TranscriptionProgress,
  Transcript,
  TranscriptSegment,
} from '@/types/transcript';

/**
 * Audio metadata extracted from the uploaded file
 */
export interface AudioMetadata {
  /** Duration of the audio file in seconds */
  duration: number;
  /** Sample rate in Hz */
  sampleRate?: number;
  /** Number of audio channels */
  numberOfChannels?: number;
  /** Audio format/MIME type */
  format: string;
}

/**
 * File upload state
 */
export interface FileUploadState {
  /** Currently selected file */
  file: File | null;
  /** Validated file upload data */
  fileData: FileUpload | null;
  /** Extracted audio metadata */
  audioMetadata: AudioMetadata | null;
  /** Upload/transcription progress */
  progress: TranscriptionProgress;
  /** Validation or processing error */
  error: string | null;
  /** Whether file is being validated or metadata is being extracted */
  isProcessing: boolean;
}

/**
 * Return type for the useFileUpload hook
 */
export interface UseFileUploadReturn extends FileUploadState {
  /** Select and validate a file (optionally with known duration for recordings) */
  selectFile: (file: File, knownDuration?: number) => Promise<void>;
  /** Clear the selected file and reset state */
  clearFile: () => void;
  /** Upload file and start transcription */
  uploadFile: (options?: UploadOptions) => Promise<UploadResult>;
  /** Cancel ongoing upload */
  cancelUpload: () => void;
  /** Reset all state */
  reset: () => void;
}

/**
 * Options for file upload
 */
export interface UploadOptions {
  /** Language code for transcription (optional) */
  language?: string;
  /** Whisper model to use (default: "whisper-1") */
  model?: string;
  /** Enable speaker diarization (default: true) */
  enableSpeakerDetection?: boolean;
  /** Callback for progress updates */
  onProgress?: (progress: TranscriptionProgress) => void;
}

/**
 * Result of file upload operation
 */
export interface UploadResult {
  /** Whether upload was successful */
  success: boolean;
  /** Transcript ID if successful */
  transcriptId?: string;
  /** Error message if failed */
  error?: string;
  /** Full transcript data if successful */
  transcript?: Transcript;
}

interface TranscriptApiResponse {
  success: boolean;
  data: Transcript;
}

function mergeTranscriptParts(parts: TranscriptApiResponse[]): TranscriptApiResponse {
  if (parts.length === 0) {
    throw new Error('No transcript parts supplied');
  }

  // Validate all parts have data before processing
  const validParts = parts.filter(part => part && part.data);
  if (validParts.length === 0) {
    // Find first error message from failed parts
    const failedPart = parts.find(part => part && !part.success);
    const errorMessage = (failedPart as { error?: string })?.error || 'Transcription failed - no valid parts returned';
    throw new Error(errorMessage);
  }

  const sortedParts = [...validParts].sort((a, b) => (
    typeof a.data.partIndex === 'number' ? a.data.partIndex : 0
  ) - (
    typeof b.data.partIndex === 'number' ? b.data.partIndex : 0
  ));

  const segments: TranscriptSegment[] = [];
  let cumulativeDuration = 0;
  let nextIndex = 0;

  for (const part of sortedParts) {
    const partSegments = Array.isArray(part.data.segments) ? part.data.segments : [];
    for (const segment of partSegments) {
      segments.push({
        ...segment,
        index: nextIndex++,
        start: segment.start + cumulativeDuration,
        end: segment.end + cumulativeDuration,
      });
    }

    // Use the last segment's end time as the offset for the next chunk.
    // This is more accurate than metadata.duration which may not reflect
    // the actual audio chunk length (especially with GPT-4o models).
    // CRITICAL: Check partSegments.length (current part), not segments.length (accumulated total).
    // Otherwise, when a part has 0 segments but previous parts had segments,
    // we'd skip adding this part's duration to the cumulative offset.
    if (partSegments.length > 0) {
      cumulativeDuration = segments[segments.length - 1].end;
    } else {
      // This part has no segments - advance cumulative duration by its metadata duration
      const metadata = part.data.metadata;
      if (typeof metadata?.duration === 'number') {
        cumulativeDuration += metadata.duration;
      }
    }
  }

  const combinedText = sortedParts.map((part) => part.data.text ?? '').join(' ').trim();
  const base = sortedParts[0];

  return {
    ...base,
    data: {
      ...base.data,
      text: combinedText,
      segments,
      metadata: {
        ...base.data.metadata,
        duration: cumulativeDuration || base.data.metadata.duration,
      },
      partIndex: undefined,
      totalParts: undefined,
    },
  };
}

/**
 * Extract duration from video file using HTML Video element.
 *
 * Implements comprehensive cleanup to prevent memory leaks:
 * - Clears all event handlers
 * - Revokes object URL
 * - Clears video source and triggers load() to release resources
 *
 * @param file - Video file to extract duration from
 * @returns Duration in seconds, or 0 if extraction fails
 */
async function extractVideoDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';

    const url = URL.createObjectURL(file);

    /**
     * Performs comprehensive cleanup of the video element.
     * Must be called in ALL exit paths (success, error, timeout)
     * to prevent memory leaks from lingering event handlers and unreleased resources.
     */
    const cleanupVideoElement = () => {
      // Clear all event handlers to prevent further callbacks
      video.onloadedmetadata = null;
      video.onerror = null;

      // Revoke object URL to release blob reference
      URL.revokeObjectURL(url);

      // Clear source and force resource release
      // Setting src to empty and calling load() triggers the browser
      // to release any media resources associated with the element
      video.src = '';
      video.load();
    };

    // Set a timeout to prevent indefinite hanging
    const timeout = setTimeout(() => {
      cleanupVideoElement();
      console.warn('Video duration extraction timeout');
      resolve(0);
    }, 10000); // 10 second timeout

    video.onloadedmetadata = () => {
      clearTimeout(timeout);
      const duration = video.duration;
      cleanupVideoElement();

      // Validate duration is a finite positive number
      if (Number.isFinite(duration) && duration > 0) {
        resolve(duration);
      } else {
        console.warn('Invalid video duration:', duration);
        resolve(0);
      }
    };

    video.onerror = (e) => {
      clearTimeout(timeout);
      cleanupVideoElement();
      console.warn('Video metadata extraction error - codec may be unsupported, FFmpeg will handle conversion:', e);
      resolve(0);
    };

    // Wrap src assignment in try-catch for edge cases
    try {
      video.src = url;
    } catch (e) {
      clearTimeout(timeout);
      cleanupVideoElement();
      console.warn('Failed to set video source:', e);
      resolve(0);
    }
  });
}

/**
 * Extract audio metadata from file using Web Audio API
 *
 * @param file - Audio file to extract metadata from
 * @returns Audio metadata including duration and format
 */
async function extractAudioMetadata(file: File): Promise<AudioMetadata> {
  // Check if this is a video file
  const isVideo = file.type.startsWith('video/');

  // Video files cannot be decoded by Web Audio API
  // Use HTML Video element to extract duration instead
  if (isVideo) {
    const duration = await extractVideoDuration(file);
    return {
      duration,
      sampleRate: undefined,
      numberOfChannels: undefined,
      format: file.type,
    };
  }

  let audioContext: AudioContext | null = null;

  try {
    return await new Promise<AudioMetadata>((resolve, reject) => {
      // Create an audio context
      const ContextConstructor = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      audioContext = ContextConstructor ? new ContextConstructor() : null;

      // Create a file reader
      const reader = new FileReader();

      // Set a timeout to prevent indefinite hanging
      const timeout = setTimeout(() => {
        reader.abort();
        reject(new Error('Audio metadata extraction timeout'));
      }, 10000); // 10 second timeout

      reader.onload = async (event) => {
        clearTimeout(timeout);
        try {
          const arrayBuffer = event.target?.result as ArrayBuffer;

          if (!arrayBuffer || arrayBuffer.byteLength === 0) {
            throw new Error('Empty audio buffer');
          }

          // Decode audio data
          const audioBuffer = await audioContext!.decodeAudioData(arrayBuffer);

          // Extract metadata
          const metadata: AudioMetadata = {
            duration: audioBuffer.duration,
            sampleRate: audioBuffer.sampleRate,
            numberOfChannels: audioBuffer.numberOfChannels,
            format: file.type,
          };

          resolve(metadata);
        } catch (error) {
          console.warn('Audio decoding failed, using fallback metadata:', error);
          // Return fallback metadata instead of rejecting
          // This handles corrupted files or unsupported audio formats gracefully
          resolve({
            duration: 0,
            sampleRate: undefined,
            numberOfChannels: undefined,
            format: file.type,
          });
        }
      };

      reader.onerror = () => {
        clearTimeout(timeout);
        console.warn('FileReader error, using fallback metadata');
        // Return fallback metadata instead of rejecting
        resolve({
          duration: 0,
          sampleRate: undefined,
          numberOfChannels: undefined,
          format: file.type,
        });
      };

      // Read file as array buffer
      reader.readAsArrayBuffer(file);
    });
  } finally {
    // CRITICAL FIX: Always close AudioContext in finally block
    if (audioContext) {
      try {
        if (typeof (audioContext as AudioContext).close === 'function') {
          await (audioContext as AudioContext).close();
        }
      } catch (error) {
        console.error('Failed to close AudioContext:', error);
      }
    }
  }
}

/**
 * Custom hook for managing file upload state and operations
 *
 * @returns File upload state and control functions
 *
 * @example
 * ```tsx
 * function UploadComponent() {
 *   const {
 *     file,
 *     audioMetadata,
 *     error,
 *     selectFile,
 *     uploadFile,
 *     clearFile
 *   } = useFileUpload();
 *
 *   const handleFileSelect = async (selectedFile: File) => {
 *     await selectFile(selectedFile);
 *   };
 *
 *   const handleUpload = async () => {
 *     const result = await uploadFile({ language: 'en' });
 *     if (result.success) {
 *       console.log('Upload successful:', result.transcriptId);
 *     }
 *   };
 *
 *   return (
 *     <div>
 *       {file && (
 *         <div>
 *           <p>{file.name}</p>
 *           {audioMetadata && <p>Duration: {audioMetadata.duration}s</p>}
 *           <button onClick={handleUpload}>Upload</button>
 *         </div>
 *       )}
 *     </div>
 *   );
 * }
 * ```
 */
export function useFileUpload(): UseFileUploadReturn {
  const [state, setState] = useState<FileUploadState>({
    file: null,
    fileData: null,
    audioMetadata: null,
    progress: {
      status: 'uploading',
      progress: 0,
    },
    error: null,
    isProcessing: false,
  });

  // Store AbortController for upload cancellation
  const abortControllerRef = useRef<AbortController | null>(null);

  // Track last progress update time for smoothing
  const lastUpdateTimeRef = useRef<number>(0);
  const pendingUpdateRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Helper function to update progress with monotonic guarantee and smoothing
   * Ensures progress never decreases and throttles rapid updates for smooth visuals
   */
  const updateProgressSafely = useCallback(
    (newProgress: TranscriptionProgress, callback?: (progress: TranscriptionProgress) => void) => {
      const now = Date.now();
      const timeSinceLastUpdate = now - lastUpdateTimeRef.current;
      const MIN_UPDATE_INTERVAL = 100; // Minimum 100ms between updates for smoothness

      // Clear any pending update
      if (pendingUpdateRef.current) {
        clearTimeout(pendingUpdateRef.current);
        pendingUpdateRef.current = null;
      }

      const performUpdate = () => {
        setState((prev) => {
          // Only update if new progress is >= current progress (monotonic guarantee)
          if (newProgress.progress >= prev.progress.progress) {
            lastUpdateTimeRef.current = Date.now();
            callback?.(newProgress);
            return { ...prev, progress: newProgress, error: null };
          }
          // If progress would decrease, keep current progress but update message/status
          return {
            ...prev,
            progress: {
              ...newProgress,
              progress: prev.progress.progress, // Keep current progress value
            },
            error: null,
          };
        });
      };

      // If enough time has passed, update immediately
      if (timeSinceLastUpdate >= MIN_UPDATE_INTERVAL) {
        performUpdate();
      } else {
        // Otherwise, schedule update for later to smooth out rapid changes
        const delay = MIN_UPDATE_INTERVAL - timeSinceLastUpdate;
        pendingUpdateRef.current = setTimeout(performUpdate, delay);
      }
    },
    []
  );

  /**
   * Select and validate a file
   * Performs validation and extracts audio metadata
   *
   * @param file - The file to select and validate
   * @param knownDuration - Optional known duration in seconds (useful when loading from recordings with known metadata)
   */
  const selectFile = useCallback(async (file: File, knownDuration?: number) => {
    // Reset error state
    setState(prev => ({
      ...prev,
      error: null,
      isProcessing: true,
    }));

    try {
      // Check if file needs processing (conversion/splitting)
      // Pass known duration if available (helps with webm files where metadata extraction can fail)
      const processingStrategy = await getFileProcessingStrategy(file, knownDuration);

      // Validate file while providing processing plan so that oversize files can be auto-processed
      const validationResult = validateFileUpload({
        file,
        name: file.name,
        size: file.size,
        type: file.type,
        processingPlan: {
          willConvert: processingStrategy.needsConversion,
          willSplit: processingStrategy.needsSplitting,
          estimatedConvertedBytes: processingStrategy.needsConversion
            ? processingStrategy.estimatedSize
            : undefined,
          targetChunkBytes: processingStrategy.needsSplitting
            ? processingStrategy.estimatedChunkSize
            : undefined,
          expectedChunkCount: processingStrategy.needsSplitting
            ? processingStrategy.estimatedChunkCount
            : undefined,
        },
      });

      // Extract audio metadata
      const metadata = await extractAudioMetadata(file);

      // Update state with validated file and metadata
      setState({
        file,
        fileData: validationResult,
        audioMetadata: metadata,
        progress: {
          status: 'uploading',
          progress: 0,
        },
        error: null,
        isProcessing: false,
      });
    } catch (error) {
      // Handle validation or metadata extraction errors
      const errorMessage = error instanceof Error ? error.message : 'Failed to process file';

      setState(prev => ({
        ...prev,
        file: null,
        fileData: null,
        audioMetadata: null,
        error: errorMessage,
        isProcessing: false,
      }));

      throw error;
    }
  }, []);

  /**
   * Clear the selected file and reset state
   */
  const clearFile = useCallback(() => {
    setState({
      file: null,
      fileData: null,
      audioMetadata: null,
      progress: {
        status: 'uploading',
        progress: 0,
      },
      error: null,
      isProcessing: false,
    });
  }, []);

  /**
   * Upload file and start transcription
   * Makes API call to transcription endpoint and tracks progress
   * Handles audio processing (conversion and splitting) as needed
   */
  const uploadFile = useCallback(async (options?: UploadOptions): Promise<UploadResult> => {
    if (!state.file || !state.fileData) {
      const error = 'No file selected';
      setState(prev => ({ ...prev, error }));
      return { success: false, error };
    }

    // Create new AbortController for this upload
    abortControllerRef.current = new AbortController();

    try {
      let filesToProcess: File[] = [state.file];

      // Check if audio processing is needed
      // Pass known duration from audioMetadata to ensure splitting triggers for long files
      // (WebM metadata extraction can fail, but duration was captured during selectFile)
      const strategy = await getFileProcessingStrategy(state.file, state.audioMetadata?.duration);

      console.log('[Upload] Processing strategy:', strategy);

      if (strategy.needsConversion || strategy.needsSplitting) {
        // Process audio (convert and/or split)
        console.log('[Upload] Starting audio processing...');
        filesToProcess = await processAudioForTranscription(
          state.file,
          (stage, progress) => {
            // Progress from processAudioForTranscription is 0-100 scale, not 0-1
            const normalizedProgress = Math.min(Math.max(progress || 0, 0), 100) / 100;
            console.log(`[Upload] Processing: ${stage} - ${Math.round(normalizedProgress * 100)}%`);
            const processingProgress: TranscriptionProgress = {
              status: 'processing',
              progress: Math.round(normalizedProgress * 30), // Use 0-30% for processing
              message: stage,
            };
            updateProgressSafely(processingProgress, options?.onProgress);
          }
        );

        // Update duration estimate if original metadata lacked it
        if (state.audioMetadata?.duration === 0 && strategy.estimatedDuration) {
          setState(prev => ({
            ...prev,
            audioMetadata: prev.audioMetadata
              ? { ...prev.audioMetadata, duration: strategy.estimatedDuration ?? prev.audioMetadata.duration }
              : prev.audioMetadata,
          }));
        }
      }

      console.log(`[Upload] Files to process: ${filesToProcess.length}`, filesToProcess.map(f => ({ name: f.name, size: f.size })));

      const totalParts = filesToProcess.length;
      const partProgress = new Map<number, number>();

      const calculateOverallProgress = () => {
        if (totalParts === 0) return 30;
        const completed = Array.from(partProgress.values()).reduce((sum, value) => sum + value, 0);
        const calculatedProgress = 30 + Math.round((completed / totalParts) * 70);
        // CRITICAL FIX: Ensure progress never exceeds 100
        return Math.min(Math.max(calculatedProgress, 0), 100);
      };

      const updateAggregatedProgress = () => {
        const overallProgress = calculateOverallProgress();
        const aggregated: TranscriptionProgress = {
          status: 'transcribing',
          // CRITICAL FIX: Clamp progress between 0 and 99
          progress: Math.min(Math.max(overallProgress, 0), 99),
          message: 'Processing audio chunks in parallel...',
        };
        setState(prev => ({ ...prev, progress: aggregated, error: null }));
        options?.onProgress?.(aggregated);
      };

      const transcriptResults = await Promise.all(
        filesToProcess.map(async (file, index) => {
          const isMultiPart = totalParts > 1;

          const formData = new FormData();
          formData.append('file', file);

          if (options?.language) {
            formData.append('language', options.language);
          }

          if (options?.model) {
            formData.append('model', options.model);
          }

          if (options?.enableSpeakerDetection !== undefined) {
            formData.append('enableSpeakerDetection', String(options.enableSpeakerDetection));
          }

          if (isMultiPart) {
            formData.append('partIndex', String(index));
            formData.append('totalParts', String(totalParts));
          }

          // Use XMLHttpRequest for upload progress tracking
          const controller = abortControllerRef.current;

          const result = await new Promise<TranscriptApiResponse>((resolve, reject) => {
            const xhr = new XMLHttpRequest();

            /**
             * Removes all event listeners from the XHR object and AbortController signal.
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

              // Remove AbortController signal listener if it was added
              if (controller) {
                controller.signal.removeEventListener('abort', onAbortSignalHandler);
              }
            };

            // Define named event handlers for proper cleanup

            /**
             * Handles upload progress events
             */
            const onProgressHandler = (event: ProgressEvent) => {
              if (event.lengthComputable && event.total > 0) {
                // Map upload progress to 30-40% range (between processing and transcription)
                const uploadPercent = (event.loaded / event.total) * 100;
                const adjustedProgress = 30 + (uploadPercent * 0.1); // 30% + up to 10%

                // CRITICAL FIX: Ensure progress values are valid numbers and clamped to 0-100
                const safeUploadPercent = Math.min(Math.max(uploadPercent || 0, 0), 100);
                const safeAdjustedProgress = Math.min(Math.max(adjustedProgress || 30, 0), 100);

                // For multi-part: show total chunks, not individual part numbers (they upload in parallel)
                const message = isMultiPart
                  ? `Uploading ${totalParts} audio chunks...`
                  : `Uploading... (${Math.round(safeUploadPercent)}%)`;

                const uploadingProgress: TranscriptionProgress = {
                  status: 'uploading',
                  progress: Math.round(safeAdjustedProgress),
                  message,
                };
                updateProgressSafely(uploadingProgress, options?.onProgress);
              }
            };

            /**
             * Handles upload completion - switches to transcribing status
             */
            const onUploadLoadHandler = () => {
              // Detect when upload bytes finish - switch to "transcribing" status
              // For single file: show "Transcribing..."
              // For multi-part: use aggregated progress which already shows "Processing chunks..."
              if (!isMultiPart) {
                const transcribingProgress: TranscriptionProgress = {
                  status: 'transcribing',
                  progress: 45,
                  message: 'Transcribing audio... This may take a minute.',
                };
                updateProgressSafely(transcribingProgress, options?.onProgress);
              } else {
                // For multi-part, just update aggregated progress
                updateAggregatedProgress();
              }
            };

            /**
             * Handles XHR load event (request completed)
             */
            const onLoadHandler = () => {
              cleanupEventListeners();
              if (xhr.status >= 200 && xhr.status < 300) {
                try {
                  const response = JSON.parse(xhr.responseText);
                  partProgress.set(index, 0.5);
                  updateAggregatedProgress();
                  resolve(response);
                } catch {
                  reject(new Error('Failed to parse response'));
                }
              } else {
                try {
                  const errorData = JSON.parse(xhr.responseText);
                  reject(new Error(errorData.error || `Upload failed with status ${xhr.status}`));
                } catch {
                  reject(new Error(`Upload failed with status ${xhr.status}`));
                }
              }
            };

            /**
             * Handles XHR error event (network error)
             */
            const onErrorHandler = () => {
              cleanupEventListeners();
              reject(new Error('Upload failed'));
            };

            /**
             * Handles XHR abort event (request cancelled)
             */
            const onAbortHandler = () => {
              cleanupEventListeners();
              reject(new Error('Upload cancelled'));
            };

            /**
             * Handles AbortController signal abort event - triggers XHR abort
             */
            const onAbortSignalHandler = () => {
              xhr.abort();
            };

            // Track upload progress
            xhr.upload.addEventListener('progress', onProgressHandler);

            // Handle upload completion
            xhr.upload.addEventListener('load', onUploadLoadHandler);

            // Handle completion
            xhr.addEventListener('load', onLoadHandler);

            // Handle errors
            xhr.addEventListener('error', onErrorHandler);

            // Handle abort
            xhr.addEventListener('abort', onAbortHandler);

            // Handle cancellation via AbortController
            if (controller) {
              controller.signal.addEventListener('abort', onAbortSignalHandler);
            }

            // Send request
            xhr.open('POST', '/api/transcribe');
            xhr.send(formData);
          });

          if (result.success && result.data && state.audioMetadata) {
            const metadata = result.data.metadata;

            if (!metadata.duration || metadata.duration === 0) {
              metadata.duration = state.audioMetadata.duration;
            }

            if (!metadata.fileSize || metadata.fileSize === 0) {
              metadata.fileSize = state.file?.size || 0;
            }
          }

          partProgress.set(index, 1);
          updateAggregatedProgress();
          return result;
        })
      );

      // Merge results if multiple parts
      let finalResult = transcriptResults[0];
      if (transcriptResults.length > 1) {
        finalResult = mergeTranscriptParts(transcriptResults);
      }

      // Validate final result has data
      if (!finalResult || !finalResult.data) {
        const errorMessage = (finalResult as { error?: string })?.error || 'Transcription failed - no data returned';
        throw new Error(errorMessage);
      }

      // Update progress: complete
      const completeProgress: TranscriptionProgress = {
        status: 'complete',
        progress: 100,
        message: 'Transcription complete!',
      };
      setState(prev => ({ ...prev, progress: completeProgress }));
      options?.onProgress?.(completeProgress);

      return {
        success: true,
        transcriptId: finalResult.data.id,
        transcript: finalResult.data,
      };
    } catch (error) {
      // Handle abort errors specifically
      if (error instanceof Error && error.name === 'AbortError') {
        const cancelledProgress: TranscriptionProgress = {
          status: 'error',
          progress: 0,
          error: 'Upload cancelled',
        };

        setState(prev => ({
          ...prev,
          progress: cancelledProgress,
          error: 'Upload cancelled',
        }));
        options?.onProgress?.(cancelledProgress);

        return {
          success: false,
          error: 'Upload cancelled',
        };
      }

      // Handle other errors
      const errorMessage = error instanceof Error ? error.message : 'Upload failed';

      const errorProgress: TranscriptionProgress = {
        status: 'error',
        progress: 0,
        error: errorMessage,
      };

      setState(prev => ({
        ...prev,
        progress: errorProgress,
        error: errorMessage,
      }));
      options?.onProgress?.(errorProgress);

      return {
        success: false,
        error: errorMessage,
      };
    } finally {
      // Clean up AbortController
      abortControllerRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- state.audioMetadata and updateProgressSafely are intentionally accessed via state getter to avoid stale closures
  }, [state.file, state.fileData]);

  /**
   * Cancel ongoing upload
   * Aborts the fetch request and updates state
   */
  const cancelUpload = useCallback(() => {
    if (abortControllerRef.current) {
      // Abort the fetch request
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    // Clear any pending progress updates
    if (pendingUpdateRef.current) {
      clearTimeout(pendingUpdateRef.current);
      pendingUpdateRef.current = null;
    }
  }, []);

  /**
   * Reset all state
   */
  const reset = useCallback(() => {
    // Cancel any ongoing upload
    cancelUpload();
    // Clear file state
    clearFile();
  }, [clearFile, cancelUpload]);

  /**
   * Cleanup on unmount - clear pending timeouts
   */
  React.useEffect(() => {
    return () => {
      // Clear any pending progress updates on unmount
      if (pendingUpdateRef.current) {
        clearTimeout(pendingUpdateRef.current);
        pendingUpdateRef.current = null;
      }
    };
  }, []);

  return {
    ...state,
    selectFile,
    clearFile,
    uploadFile,
    cancelUpload,
    reset,
  };
}

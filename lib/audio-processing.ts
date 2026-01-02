/**
 * Audio Processing Utilities
 *
 * Client-side audio processing using FFmpeg WebAssembly for:
 * - MP4 to MP3 conversion (size reduction)
 * - Audio splitting at silence points (for large files)
 *
 * Note: FFmpeg runs in the main thread but uses WebAssembly for efficient processing
 */

import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

/**
 * Maximum file size for Whisper API (25MB)
 */
export const MAX_WHISPER_FILE_SIZE = 25 * 1024 * 1024;

/**
 * Maximum audio duration before splitting (10 minutes)
 * Lowered from 20 minutes to ensure diarization API calls complete within timeout.
 * With speaker diarization, processing time is ~30-40% of audio duration,
 * so 10-minute chunks take 3-4 minutes to process (within 5-minute timeout).
 */
export const MAX_WHISPER_DURATION = 600;

/**
 * Target maximum chunk size we aim for after splitting (24MB) to leave safety margin.
 */
export const MAX_CHUNK_SIZE_BYTES = 24 * 1024 * 1024;

/**
 * Target chunk duration (seconds) used when splitting on silence.
 */
export const TARGET_CHUNK_DURATION_SECONDS = 300; // 5 minutes

/**
 * File size threshold for triggering conversion (10MB)
 */
export const CONVERSION_THRESHOLD = 10 * 1024 * 1024;

/**
 * Strategy returned by getFileProcessingStrategy describing how the pipeline will handle the file.
 */
export interface FileProcessingStrategy {
  needsConversion: boolean;
  needsSplitting: boolean;
  estimatedSize: number;
  estimatedDuration: number | null;
  estimatedChunkSize: number;
  estimatedChunkCount: number;
}

/**
 * FFmpeg instance (singleton)
 */
let ffmpegInstance: FFmpeg | null = null;

/**
 * FFmpeg loaded state
 */
let ffmpegLoaded = false;

/**
 * Promise guard to prevent concurrent loading attempts
 */
let ffmpegLoadingPromise: Promise<FFmpeg> | null = null;

/**
 * Initialize FFmpeg WebAssembly
 * Creates and loads FFmpeg instance on first use
 * Uses a promise guard to prevent race conditions during concurrent calls
 *
 * @returns Loaded FFmpeg instance
 */
async function getFFmpeg(): Promise<FFmpeg> {
  // Return existing instance if already loaded
  if (ffmpegInstance && ffmpegLoaded) {
    return ffmpegInstance;
  }

  // If loading is in progress, wait for it to complete
  if (ffmpegLoadingPromise) {
    return ffmpegLoadingPromise;
  }

  // Start loading with promise guard to prevent race conditions
  ffmpegLoadingPromise = (async () => {
    if (!ffmpegInstance) {
      ffmpegInstance = new FFmpeg();
    }

    try {
      // Load FFmpeg WASM core from local public folder
      const baseURL = '/ffmpeg-core';

      await ffmpegInstance.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      });

      ffmpegLoaded = true;
      console.log('FFmpeg loaded successfully');
      return ffmpegInstance;
    } catch (error) {
      console.error('Failed to load FFmpeg:', error);
      throw new Error(`Failed to initialize FFmpeg: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  })();

  try {
    return await ffmpegLoadingPromise;
  } finally {
    ffmpegLoadingPromise = null;
  }
}

/**
 * Convert MP4 video to MP3 audio
 * Extracts audio track and compresses to reduce file size
 *
 * @param file - MP4 video file
 * @param onProgress - Optional progress callback (0-100)
 * @returns MP3 audio file
 */
export async function convertMP4ToMP3(
  file: File,
  onProgress?: (progress: number) => void
): Promise<File> {
  const inputFileName = 'input_audio';
  const outputFileName = 'output.mp3';
  let ffmpeg: FFmpeg | null = null;
  let progressListener: (({ progress }: { progress: number }) => void) | null = null;

  try {
    onProgress?.(0);

    ffmpeg = await getFFmpeg();

    // Set up progress tracking with clamping to prevent overflow
    // FFmpeg can report progress > 1.0 in edge cases; clamp to 0-99 (100 is set explicitly at end)
    progressListener = ({ progress }: { progress: number }) => {
      onProgress?.(Math.min(99, Math.max(0, Math.round(progress * 100))));
    };
    ffmpeg.on('progress', progressListener);

    // Write input file to FFmpeg virtual file system
    onProgress?.(10);
    await ffmpeg.writeFile(inputFileName, await fetchFile(file));

    onProgress?.(20);

    // Convert to MP3 with compression
    // Works for MP4, WebM (Opus/Vorbis), and other formats
    await ffmpeg.exec([
      '-i', inputFileName,
      '-vn', // Remove video (if present)
      '-ar', '16000', // 16kHz sample rate (optimal for speech)
      '-ac', '1', // Mono
      '-b:a', '64k', // 64kbps bitrate for good speech quality
      outputFileName
    ]);

    onProgress?.(90);

    // Read output file from FFmpeg virtual file system
    const data = (await ffmpeg.readFile(outputFileName)) as Uint8Array;

    // Note: Cleanup is handled in finally block to avoid redundant operations
    onProgress?.(100);

    // Create new File object from result
    const mp3Blob = new Blob([new Uint8Array(data)], { type: 'audio/mpeg' });
    // Replace any extension with .mp3
    const mp3FileName = file.name.replace(/\.[^.]+$/, '.mp3');
    const mp3File = new File([mp3Blob], mp3FileName, { type: 'audio/mpeg' });

    console.log(`[Audio] Converted ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB) to MP3 (${(mp3File.size / 1024 / 1024).toFixed(2)}MB)`);

    return mp3File;
  } catch (error) {
    console.error('Audio conversion failed:', error);
    throw new Error(`Failed to convert audio: ${error instanceof Error ? error.message : 'Unknown error'}`);
  } finally {
    // Ensure cleanup of virtual FS files even on error to prevent memory leaks
    if (ffmpeg) {
      try {
        await ffmpeg.deleteFile(inputFileName).catch(() => { /* File may not exist */ });
        await ffmpeg.deleteFile(outputFileName).catch(() => { /* File may not exist */ });
        if (progressListener) {
          ffmpeg.off('progress', progressListener);
        }
      } catch {
        // Ignore cleanup errors - best effort cleanup
      }
    }
  }
}

/**
 * Split audio file at silence points
 * Divides large audio files into smaller chunks for processing
 * Uses a 2-pass approach:
 * 1. Detect silence periods
 * 2. Split at optimal silence points
 *
 * @param file - Audio file to split
 * @param onProgress - Optional progress callback (0-100)
 * @returns Array of audio file chunks
 */
export async function splitAudioAtSilence(
  file: File,
  onProgress?: (progress: number) => void
): Promise<File[]> {
  const inputFileName = 'input_split.mp3';
  let ffmpeg: FFmpeg | null = null;
  let logListener: (({ message }: { message: string }) => void) | null = null;
  const outputFilesToCleanup: string[] = [];

  try {
    onProgress?.(0);

    ffmpeg = await getFFmpeg();

    // Write input file
    onProgress?.(5);
    await ffmpeg.writeFile(inputFileName, await fetchFile(file));

    // --- Pass 1: Detect Silence ---
    onProgress?.(10);

    const silences: Array<{ start: number; end: number; duration: number }> = [];
    let currentStart: number | null = null;

    logListener = ({ message }: { message: string }) => {
      // Parse silence_start: 123.456
      // Note: Use \d (not \\d) to match digit character class in regex
      const startMatch = message.match(/silence_start: (\d+(\.\d+)?)/);
      if (startMatch) {
        currentStart = parseFloat(startMatch[1]);
      }

      // Parse silence_end: 125.678 | silence_duration: 2.222
      const endMatch = message.match(/silence_end: (\d+(\.\d+)?)/);
      const durationMatch = message.match(/silence_duration: (\d+(\.\d+)?)/);

      if (endMatch && durationMatch && currentStart !== null) {
        silences.push({
          start: currentStart,
          end: parseFloat(endMatch[1]),
          duration: parseFloat(durationMatch[1])
        });
        currentStart = null;
      }
    };

    ffmpeg.on('log', logListener);

    // Run silencedetect
    await ffmpeg.exec([
      '-i', inputFileName,
      '-af', 'silencedetect=noise=-30dB:d=0.5',
      '-f', 'null',
      '-'
    ]);

    ffmpeg.off('log', logListener);
    onProgress?.(40);

    // --- Calculate Split Points ---
    const TARGET_DURATION = 300; // 5 minutes
    const MAX_DURATION = 600; // 10 minutes
    const splitPoints: string[] = [];
    let lastSplitTime = 0;

    if (silences.length > 0) {
      let currentSilenceIndex = 0;

      while (true) {
        const targetTime = lastSplitTime + TARGET_DURATION;
        let bestSplitPoint: number | null = null;

        // Find first silence that starts after lastSplitTime
        while (currentSilenceIndex < silences.length && silences[currentSilenceIndex].end < lastSplitTime + 60) {
          currentSilenceIndex++;
        }

        if (currentSilenceIndex >= silences.length) {
          break;
        }

        // Search for best silence in the window
        let bestSilenceIdx = -1;

        for (let i = currentSilenceIndex; i < silences.length; i++) {
          const s = silences[i];
          const splitCandidate = s.start + (s.duration / 2);

          if (splitCandidate > lastSplitTime + MAX_DURATION) {
            break;
          }

          if (splitCandidate >= targetTime) {
            bestSilenceIdx = i;
            break;
          }
        }

        if (bestSilenceIdx !== -1) {
          const s = silences[bestSilenceIdx];
          bestSplitPoint = s.start + (s.duration / 2);
          currentSilenceIndex = bestSilenceIdx + 1;
        } else {
          break;
        }

        if (bestSplitPoint) {
          splitPoints.push(bestSplitPoint.toFixed(3));
          lastSplitTime = bestSplitPoint;
        }
      }
    }

    // --- Pass 2: Split ---
    onProgress?.(50);

    const outputPattern = 'output%03d.mp3';

    const splitArgs = [
      '-i', inputFileName,
      '-f', 'segment',
      '-c', 'copy',
    ];

    if (splitPoints.length > 0) {
      splitArgs.push('-segment_times', splitPoints.join(','));
    } else {
      splitArgs.push('-segment_time', String(TARGET_DURATION));
    }

    splitArgs.push(outputPattern);

    await ffmpeg.exec(splitArgs);

    onProgress?.(90);

    // Read all output files
    const files = await ffmpeg.listDir('/');
    const outputFiles = files
      .filter(f => f.name.startsWith('output') && f.name.endsWith('.mp3'))
      .sort((a, b) => a.name.localeCompare(b.name));

    // Track output files for cleanup
    outputFiles.forEach(f => outputFilesToCleanup.push(f.name));

    const chunks: File[] = [];

    for (let i = 0; i < outputFiles.length; i++) {
      const data = await ffmpeg.readFile(outputFiles[i].name);
      const uint8Data = data instanceof Uint8Array ? data : new Uint8Array(data as unknown as ArrayBuffer);

      // Check if chunk is not empty
      if (uint8Data.length > 0) {
        const blob = new Blob([new Uint8Array(uint8Data)], { type: 'audio/mpeg' });
        const fileName = `${file.name.replace(/\.[^.]+$/, '')}_part${i + 1}.mp3`;
        chunks.push(new File([blob], fileName, { type: 'audio/mpeg' }));
      }

      // Clean up chunk file
      await ffmpeg.deleteFile(outputFiles[i].name);
      // Remove from cleanup list since we just deleted it
      const idx = outputFilesToCleanup.indexOf(outputFiles[i].name);
      if (idx !== -1) outputFilesToCleanup.splice(idx, 1);

      onProgress?.(90 + Math.round((i / outputFiles.length) * 10));
    }

    // Clean up input file
    await ffmpeg.deleteFile(inputFileName);

    onProgress?.(100);

    return chunks;
  } catch (error) {
    console.error('Audio splitting failed:', error);
    throw new Error(`Failed to split audio file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  } finally {
    // Ensure cleanup of virtual FS files even on error to prevent memory leaks
    if (ffmpeg) {
      try {
        // Clean up input file
        await ffmpeg.deleteFile(inputFileName).catch(() => { /* File may not exist */ });

        // Clean up any remaining output files
        for (const outputFile of outputFilesToCleanup) {
          await ffmpeg.deleteFile(outputFile).catch(() => { /* File may not exist */ });
        }

        // Remove log listener if still attached
        if (logListener) {
          ffmpeg.off('log', logListener);
        }
      } catch {
        // Ignore cleanup errors - best effort cleanup
      }
    }
  }
}

/**
 * Get audio duration from file
 * Uses HTML Audio API to load metadata and get duration
 *
 * @param file - Audio or video file
 * @returns Duration in seconds, or null if unable to determine
 */
export async function getAudioDuration(file: File): Promise<number | null> {
  try {
    // Create an audio element to load the file
    const audio = new Audio();
    const url = URL.createObjectURL(file);

    return new Promise((resolve) => {
      audio.addEventListener('loadedmetadata', () => {
        URL.revokeObjectURL(url);
        resolve(audio.duration);
      });

      audio.addEventListener('error', () => {
        URL.revokeObjectURL(url);
        resolve(null);
      });

      audio.src = url;
    });
  } catch (error) {
    console.error('Failed to get audio duration:', error);
    return null;
  }
}

/**
 * Check if a file needs processing based on type, size, and duration
 *
 * @param file - File to check
 * @param duration - Optional duration in seconds (if already known)
 * @returns Processing recommendation
 */
export async function getFileProcessingStrategy(
  file: File,
  duration?: number
): Promise<FileProcessingStrategy> {
  const isVideo = file.type.startsWith('video/');
  const isLarge = file.size > CONVERSION_THRESHOLD;

  // WebM audio (audio/webm) needs conversion because:
  // 1. It uses Opus/Vorbis codec which can't be stream-copied to MP3
  // 2. Whisper API handles MP3 more reliably
  const isWebmAudio = file.type === 'audio/webm' || file.name.toLowerCase().endsWith('.webm');

  // Video files should be converted if >5MB
  // WebM audio should always be converted (codec compatibility)
  // We prefer MP3 conversion for videos to strip video data and reduce size
  const needsConversion = (isVideo && isLarge) || isWebmAudio;

  // Estimate size after conversion (MP3 is typically 10-20% of MP4 size)
  // Ensure size is always at least 1 byte (defensive against empty blobs)
  const rawEstimatedSize = needsConversion ? Math.round(file.size * 0.15) : file.size;
  const estimatedSize = Math.max(1, Number.isFinite(rawEstimatedSize) ? rawEstimatedSize : file.size);

  // Get duration if not provided
  const rawDuration = duration ?? await getAudioDuration(file);

  // Sanitize duration: must be a finite positive number, otherwise treat as null
  const estimatedDuration = (
    rawDuration !== null &&
    Number.isFinite(rawDuration) &&
    rawDuration > 0
  ) ? rawDuration : null;

  // Split if either size OR duration exceeds limits
  // - Size limit: 25MB (using 24MB to be safe)
  // - Duration limit: 1500 seconds (25 minutes)
  // Note: For videos, estimatedSize accounts for compression; for audio, it's the original size

  const needsSplitting =
    estimatedSize > MAX_CHUNK_SIZE_BYTES ||
    (estimatedDuration !== null && estimatedDuration > MAX_WHISPER_DURATION);

  // Calculate chunk counts with defensive Math.max to ensure at least 1
  const sizeDrivenChunkCount = Math.max(1, Math.ceil(estimatedSize / MAX_CHUNK_SIZE_BYTES));
  const durationDrivenChunkCount =
    estimatedDuration !== null
      ? Math.max(1, Math.ceil(estimatedDuration / TARGET_CHUNK_DURATION_SECONDS))
      : 1;

  // Ensure chunk count is always a valid positive integer
  const rawChunkCount = needsSplitting
    ? Math.max(sizeDrivenChunkCount, durationDrivenChunkCount)
    : 1;
  const estimatedChunkCount = Math.max(1, Math.floor(Number.isFinite(rawChunkCount) ? rawChunkCount : 1));

  // Ensure chunk size is always a valid positive integer
  const rawChunkSize = needsSplitting
    ? Math.ceil(estimatedSize / estimatedChunkCount)
    : estimatedSize;
  const estimatedChunkSize = Math.max(1, Math.floor(Number.isFinite(rawChunkSize) ? rawChunkSize : estimatedSize));

  return {
    needsConversion,
    needsSplitting,
    estimatedSize,
    estimatedDuration,
    estimatedChunkSize: Math.min(estimatedChunkSize, MAX_CHUNK_SIZE_BYTES),
    estimatedChunkCount,
  };
}

/**
 * Process audio file for transcription
 * Handles conversion and splitting as needed
 *
 * @param file - Input file
 * @param onProgress - Progress callback
 * @returns Processed file(s) ready for transcription
 */
export async function processAudioForTranscription(
  file: File,
  onProgress?: (stage: string, progress: number) => void
): Promise<File[]> {
  const strategy = await getFileProcessingStrategy(file);

  let processedFile = file;
  let needsSplittingAfterConversion = strategy.needsSplitting;

  // Calculate initial stage weights based on what operations are needed
  // This ensures cumulative progress without resets
  let totalStages = (strategy.needsConversion ? 1 : 0) + (strategy.needsSplitting ? 1 : 0);
  let conversionWeight = strategy.needsConversion ? (1 / Math.max(totalStages, 1)) : 0;
  let splittingWeight = strategy.needsSplitting ? (1 / Math.max(totalStages, 1)) : 0;

  let cumulativeProgress = 0;

  // Step 1: Convert if needed
  if (strategy.needsConversion) {
    const conversionStart = cumulativeProgress;
    onProgress?.('Converting video to audio', conversionStart);

    processedFile = await convertMP4ToMP3(file, (progress) => {
      // Map conversion progress (0-100) to its allocated portion of total progress
      const adjustedProgress = conversionStart + (progress * conversionWeight);
      onProgress?.('Converting video to audio', adjustedProgress);
    });

    cumulativeProgress += (conversionWeight * 100);
    onProgress?.('Converting video to audio', cumulativeProgress);

    // CRITICAL: Re-check duration after conversion for WebM/video files
    // WebM metadata extraction often fails, but MP3 works reliably
    // If the converted file exceeds duration limit, we need to split it
    if (!strategy.needsSplitting) {
      const convertedDuration = await getAudioDuration(processedFile);
      const convertedSize = processedFile.size;

      // Estimate duration from file size as fallback (MP3 at 64kbps = ~8KB/sec)
      // This catches cases where duration detection fails but file is clearly long
      const estimatedDurationFromSize = convertedSize / 8000;

      // Force splitting if:
      // 1. Detected duration exceeds limit, OR
      // 2. File size exceeds limit, OR
      // 3. Duration detection failed AND original was a large file (>10MB) - assume it's long
      // 4. Estimated duration from file size exceeds limit
      // Note: This applies to BOTH video and audio files to handle long meeting recordings
      const originalWasLargeFile = file.size > 10 * 1024 * 1024; // >10MB
      const durationExceedsLimit = convertedDuration !== null && convertedDuration > MAX_WHISPER_DURATION;
      const sizeExceedsLimit = convertedSize > MAX_CHUNK_SIZE_BYTES;
      const durationUnknownButLikelyLong = convertedDuration === null && originalWasLargeFile;
      const estimatedDurationExceedsLimit = estimatedDurationFromSize > MAX_WHISPER_DURATION;

      if (durationExceedsLimit || sizeExceedsLimit || durationUnknownButLikelyLong || estimatedDurationExceedsLimit) {
        console.log(`[AudioProcessing] Post-conversion check: duration=${convertedDuration}s, estimatedFromSize=${estimatedDurationFromSize.toFixed(0)}s, size=${convertedSize}bytes, originalLargeFile=${originalWasLargeFile} - splitting required`);
        needsSplittingAfterConversion = true;

        // Recalculate weights now that we know splitting is needed
        // Conversion is done, so splitting gets the remaining progress
        totalStages = 2;
        conversionWeight = 0.5;
        splittingWeight = 0.5;
        // Conversion already used ~50% (half of original 100%), keep cumulative at 50%
        cumulativeProgress = 50;
      }
    }
  }

  // Step 2: Split if needed (either initially or discovered after conversion)
  if (needsSplittingAfterConversion) {
    const splittingStart = cumulativeProgress;
    onProgress?.('Splitting audio file', splittingStart);

    const chunks = await splitAudioAtSilence(processedFile, (progress) => {
      // Map splitting progress (0-100) to its allocated portion of total progress
      const adjustedProgress = splittingStart + (progress * splittingWeight);
      onProgress?.('Splitting audio file', adjustedProgress);
    });

    cumulativeProgress += (splittingWeight * 100);
    onProgress?.('Splitting audio file', 100); // Always end at 100%
    return chunks;
  }

  return [processedFile];
}

/**
 * Terminate FFmpeg and free resources
 * Should be called when FFmpeg is no longer needed (e.g., on app unmount)
 */
export function terminateFFmpeg(): void {
  if (ffmpegInstance) {
    try {
      // FFmpeg instance will be garbage collected
      ffmpegInstance = null;
      ffmpegLoaded = false;

      console.log('FFmpeg instance cleared');
    } catch (error) {
      console.error('Error clearing FFmpeg instance:', error);
    }
  }
}

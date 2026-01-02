/**
 * Audio Upload Helper
 *
 * Helper utilities for uploading audio files alongside transcripts.
 * This provides convenience functions for the upload flow.
 */

import { loadAndStoreAudioFile, isValidAudioFile } from './audio-storage';
import type { Transcript } from '@/types/transcript';

/**
 * Result of audio upload validation
 */
export interface AudioValidationResult {
  /** Whether the file is valid */
  valid: boolean;

  /** Error message if invalid */
  error?: string;

  /** File size in bytes */
  size?: number;

  /** File type */
  type?: string;
}

/**
 * Maximum audio file size (25 MB - OpenAI Whisper limit)
 */
export const MAX_AUDIO_SIZE = 25 * 1024 * 1024;

/**
 * Validates an audio file before upload
 *
 * @param file - File to validate
 * @returns Validation result
 */
export function validateAudioFile(file: File): AudioValidationResult {
  // Check if file exists
  if (!file) {
    return {
      valid: false,
      error: 'No file provided',
    };
  }

  // Check file size
  if (file.size > MAX_AUDIO_SIZE) {
    const maxSizeMB = MAX_AUDIO_SIZE / (1024 * 1024);
    return {
      valid: false,
      error: `File size exceeds ${maxSizeMB}MB limit`,
      size: file.size,
      type: file.type,
    };
  }

  // Check file type
  if (!isValidAudioFile(file)) {
    return {
      valid: false,
      error: `Unsupported audio format: ${file.type}`,
      size: file.size,
      type: file.type,
    };
  }

  return {
    valid: true,
    size: file.size,
    type: file.type,
  };
}

/**
 * Processes and stores an audio file with a transcript
 *
 * This is the main function to call when uploading a transcript with audio.
 * It validates the file, stores it, and returns the audio URL and metadata.
 *
 * @param transcriptId - ID of the transcript to associate with
 * @param audioFile - Audio file from file input
 * @returns Promise with audio URL or error
 * @throws Error if validation or storage fails
 */
export async function processAudioUpload(
  transcriptId: string,
  audioFile: File
): Promise<{
  audioUrl: string;
  duration: number;
  size: number;
  filename: string;
}> {
  // Validate file
  const validation = validateAudioFile(audioFile);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  // Store audio file
  const result = await loadAndStoreAudioFile(transcriptId, audioFile);

  return {
    audioUrl: result.audioUrl,
    duration: result.metadata.duration,
    size: result.metadata.size,
    filename: result.metadata.filename,
  };
}

/**
 * Formats audio duration in seconds to human-readable string
 *
 * @param seconds - Duration in seconds
 * @returns Formatted duration (e.g., "1:23:45" or "12:34")
 */
export function formatAudioDuration(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return '0:00';

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Formats file size in bytes to human-readable string
 *
 * @param bytes - Size in bytes
 * @returns Formatted size (e.g., "1.5 MB")
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Gets audio file extension from filename
 *
 * @param filename - File name
 * @returns File extension (e.g., "mp3")
 */
export function getAudioExtension(filename: string): string {
  const match = filename.match(/\.([^.]+)$/);
  return match ? match[1].toLowerCase() : '';
}

/**
 * Checks if a transcript has audio available
 *
 * @param transcript - Transcript to check
 * @returns True if transcript has audio
 */
export function transcriptHasAudio(transcript: Transcript): boolean {
  return !!transcript.audioUrl;
}

/**
 * Creates a download link for audio file
 *
 * @param audioUrl - ObjectURL or audio source
 * @param filename - Desired filename for download
 */
export function downloadAudioFile(audioUrl: string, filename: string): void {
  const link = document.createElement('a');
  link.href = audioUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Error messages for audio operations
 */
export const AUDIO_ERROR_MESSAGES = {
  INVALID_FORMAT: 'Please select a valid audio file (MP3, WAV, M4A, etc.)',
  FILE_TOO_LARGE: 'Audio file is too large. Maximum size is 25 MB.',
  UPLOAD_FAILED: 'Failed to upload audio file. Please try again.',
  LOAD_FAILED: 'Failed to load audio file.',
  NOT_FOUND: 'Audio file not found.',
  PERMISSION_DENIED: 'Audio playback permission denied.',
  DECODE_ERROR: 'Failed to decode audio file. The file may be corrupted.',
} as const;

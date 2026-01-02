/**
 * Transcript Type Definitions
 *
 * Core types for managing audio transcriptions, including segments,
 * metadata, and transcription progress tracking.
 */

/**
 * Represents a single segment of a transcript with timing information.
 * Segments are typically sentence or phrase-level chunks from the transcription.
 */
export interface TranscriptSegment {
  /** Sequential index of the segment within the transcript */
  index: number;

  /** Start time of the segment in seconds */
  start: number;

  /** End time of the segment in seconds */
  end: number;

  /** Transcribed text content of the segment */
  text: string;

  /** Optional speaker identification (if diarization is available) */
  speaker?: string;
}

/**
 * Metadata about the transcription process and source audio.
 */
export interface TranscriptMetadata {
  /** Whisper model used for transcription (e.g., "whisper-1") */
  model: string;

  /** Detected or specified language code (e.g., "en", "es") */
  language?: string;

  /** Original audio file size in bytes */
  fileSize: number;

  /** Total duration of the audio in seconds */
  duration: number;
}

/**
 * Fingerprint for identifying duplicate audio uploads.
 */
export interface TranscriptFingerprint {
  /** SHA-256 hash of the audio file */
  fileHash: string;

  /** Optional duration used to disambiguate edge cases */
  lengthSeconds?: number;
}

/**
 * Complete transcript representation including all segments and metadata.
 */
export interface Transcript {
  /** Unique identifier for the transcript */
  id: string;

  /** Original filename of the uploaded audio */
  filename: string;

  /** Full concatenated transcript text */
  text: string;

  /** Array of timestamped transcript segments */
  segments: TranscriptSegment[];

  /** Optional browser ObjectURL for audio playback */
  audioUrl?: string;

  /** Timestamp when the transcript was created */
  createdAt: Date;

  /** Metadata about the transcription and source audio */
  metadata: TranscriptMetadata;

  /** AI-generated 1-2 sentence summary of the transcript content */
  summary?: string;

  /** City of Austin department (for organization and filtering) */
  department?: string;

  /** Optional fingerprint for duplicate detection */
  fingerprint?: TranscriptFingerprint;

  /** Index of the part when generated from chunked uploads */
  partIndex?: number;

  /** Total number of parts when generated from chunked uploads */
  totalParts?: number;
}

/**
 * Status stages of the transcription pipeline.
 */
export type TranscriptionStatus =
  | 'uploading'     // File is being uploaded to the server
  | 'processing'    // File is being processed/validated
  | 'transcribing'  // Transcription is in progress
  | 'complete'      // Transcription completed successfully
  | 'error';        // An error occurred during the process

/**
 * Real-time progress tracking for transcription operations.
 */
export interface TranscriptionProgress {
  /** Current status of the transcription process */
  status: TranscriptionStatus;

  /** Progress percentage (0-100) */
  progress: number;

  /** Optional human-readable status message */
  message?: string;

  /** Error message if status is 'error' */
  error?: string;
}

/**
 * Type guard to check if a status is a valid TranscriptionStatus.
 */
export function isTranscriptionStatus(status: string): status is TranscriptionStatus {
  return ['uploading', 'processing', 'transcribing', 'complete', 'error'].includes(status);
}

/**
 * Helper type for transcript creation (before ID and timestamps are assigned).
 */
export type TranscriptInput = Omit<Transcript, 'id' | 'createdAt'>;

/**
 * Helper type for updating transcript fields (all fields optional except ID).
 */
export type TranscriptUpdate = Partial<Omit<Transcript, 'id'>> & Pick<Transcript, 'id'>;

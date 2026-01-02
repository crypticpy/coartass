/**
 * Audio Storage Utilities
 *
 * Utilities for storing and retrieving audio files in IndexedDB,
 * creating ObjectURLs for playback, and managing audio file lifecycle.
 */

import {
  getDatabase,
  saveTranscript,
  getTranscript,
  type AudioFileEntry,
} from './db';
import type { AudioMetadata, AudioStorageResult } from '@/types/audio';

/**
 * Initializes audio files table if not already present
 *
 * This adds a new table to store audio Blobs separately from transcripts
 * to optimize performance and allow for better memory management.
 */
function getAudioDatabase() {
  const db = getDatabase();

  if (!db.audioFiles) {
    throw new Error('Audio storage is not initialized in IndexedDB.');
  }

  return db;
}

/**
 * Stores an audio file and associates it with a transcript
 *
 * @param transcriptId - The transcript ID to associate with
 * @param audioBlob - The audio file as a Blob
 * @param metadata - Audio file metadata
 * @returns ObjectURL for playback and metadata
 * @throws Error if storage fails
 */
export async function storeAudioFile(
  transcriptId: string,
  audioBlob: Blob,
  metadata: Omit<AudioMetadata, 'loadedAt'>
): Promise<AudioStorageResult> {
  try {
    const db = getAudioDatabase();

    // Create audio file entry
    const entry: AudioFileEntry = {
      transcriptId,
      audioBlob,
      metadata: {
        ...metadata,
        loadedAt: new Date(),
      },
      storedAt: new Date(),
    };

    // Store in database
    await db.audioFiles!.put(entry);

    // Create ObjectURL for playback
    const audioUrl = URL.createObjectURL(audioBlob);

    // Update transcript with audio URL
    const transcript = await getTranscript(transcriptId);
    if (transcript) {
      await saveTranscript({
        ...transcript,
        audioUrl,
      });
    }

    return {
      audioUrl,
      metadata: entry.metadata,
    };
  } catch (error) {
    console.error('Failed to store audio file:', error);
    throw new Error(
      `Failed to store audio file: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Retrieves an audio file by transcript ID and creates an ObjectURL
 *
 * @param transcriptId - The transcript ID
 * @returns AudioURL and metadata if found, null otherwise
 * @throws Error if retrieval fails
 */
export async function getAudioFile(
  transcriptId: string
): Promise<AudioStorageResult | null> {
  try {
    const db = getAudioDatabase();

    if (!db.audioFiles) {
      return null;
    }

    // Get audio file entry
    const entry = await db.audioFiles.get(transcriptId);

    if (!entry) {
      return null;
    }

    // Create ObjectURL for playback
    const audioUrl = URL.createObjectURL(entry.audioBlob);

    return {
      audioUrl,
      metadata: entry.metadata,
    };
  } catch (error) {
    console.error('Failed to retrieve audio file:', error);
    throw new Error(
      `Failed to retrieve audio file: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Deletes an audio file by transcript ID
 *
 * @param transcriptId - The transcript ID
 * @throws Error if deletion fails
 */
export async function deleteAudioFile(transcriptId: string): Promise<void> {
  try {
    const db = getAudioDatabase();

    if (!db.audioFiles) {
      return;
    }

    await db.audioFiles.delete(transcriptId);

    // Also remove audioUrl from transcript
    const transcript = await getTranscript(transcriptId);
    if (transcript && transcript.audioUrl) {
      // Revoke the ObjectURL if it exists
      URL.revokeObjectURL(transcript.audioUrl);

      // Update transcript to remove audioUrl
      await saveTranscript({
        ...transcript,
        audioUrl: undefined,
      });
    }
  } catch (error) {
    console.error('Failed to delete audio file:', error);
    throw new Error(
      `Failed to delete audio file: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Checks if an audio file exists for a transcript
 *
 * @param transcriptId - The transcript ID
 * @returns True if audio file exists
 */
export async function hasAudioFile(transcriptId: string): Promise<boolean> {
  try {
    const db = getAudioDatabase();

    if (!db.audioFiles) {
      return false;
    }

    const entry = await db.audioFiles.get(transcriptId);
    return !!entry;
  } catch (error) {
    console.error('Failed to check audio file existence:', error);
    return false;
  }
}

/**
 * Creates an ObjectURL from a Blob
 *
 * This is a wrapper around URL.createObjectURL for consistency.
 * Remember to revoke the URL when done using revokeAudioUrl().
 *
 * @param blob - Audio file as Blob
 * @returns ObjectURL string
 */
export function createAudioUrl(blob: Blob): string {
  return URL.createObjectURL(blob);
}

/**
 * Revokes an ObjectURL to free memory
 *
 * Should be called when the audio is no longer needed (e.g., component unmount)
 *
 * @param url - ObjectURL to revoke
 */
export function revokeAudioUrl(url: string): void {
  try {
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Failed to revoke audio URL:', error);
  }
}

/**
 * Loads an audio file from a File object and stores it
 *
 * @param transcriptId - The transcript ID to associate with
 * @param file - The File object (from input[type="file"])
 * @returns AudioURL and metadata
 * @throws Error if file processing fails
 */
export async function loadAndStoreAudioFile(
  transcriptId: string,
  file: File
): Promise<AudioStorageResult> {
  try {
    // Get audio duration
    const duration = await getAudioDuration(file);

    // Create metadata
    const metadata: Omit<AudioMetadata, 'loadedAt'> = {
      filename: file.name,
      size: file.size,
      type: file.type,
      duration,
    };

    // Store the audio file
    return await storeAudioFile(transcriptId, file, metadata);
  } catch (error) {
    console.error('Failed to load and store audio file:', error);
    throw new Error(
      `Failed to load audio file: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Gets audio duration from a File or Blob
 *
 * @param file - Audio file
 * @returns Duration in seconds
 */
export function getAudioDuration(file: File | Blob): Promise<number> {
  return new Promise((resolve, reject) => {
    const audio = document.createElement('audio');
    const url = URL.createObjectURL(file);

    audio.addEventListener('loadedmetadata', () => {
      URL.revokeObjectURL(url);
      resolve(audio.duration);
    });

    audio.addEventListener('error', () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load audio metadata'));
    });

    audio.src = url;
  });
}

/**
 * Validates if a file is a supported audio format
 *
 * @param file - File to validate
 * @returns True if file is a supported audio format
 */
export function isValidAudioFile(file: File): boolean {
  const supportedTypes = [
    'audio/mpeg', // Standard MP3 MIME type
    'audio/mp4',
    'audio/m4a',
    'audio/wav',
    'audio/webm',
    'audio/flac',
    'audio/ogg',
  ];

  return supportedTypes.includes(file.type);
}

/**
 * Gets the size of all stored audio files
 *
 * @returns Total size in bytes
 */
export async function getAudioStorageSize(): Promise<number> {
  try {
    const { getDatabase } = await import('./db');
    const database = getDatabase();

    if (!database.audioFiles) {
      return 0;
    }

    const entries = await database.audioFiles.toArray();
    return entries.reduce((total, entry) => total + entry.audioBlob.size, 0);
  } catch (error) {
    console.error('Failed to calculate audio storage size:', error);
    return 0;
  }
}

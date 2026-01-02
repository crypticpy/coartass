/**
 * IndexedDB Core (Dexie)
 *
 * Owns database schema, the singleton instance, and lifecycle helpers.
 */

import Dexie, { Table } from "dexie";
import type { Transcript } from "@/types/transcript";
import type { Template } from "@/types/template";
import type { Analysis } from "@/types/analysis";
import type { AudioMetadata } from "@/types/audio";
import type { Conversation } from "@/types/chat";
import type { SavedRecording } from "@/types/recording";
import type { RtassScorecard, RtassRubricTemplate } from "@/types/rtass";

/**
 * Custom error class for database operations.
 */
export class DatabaseError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly originalError?: Error
  ) {
    super(message);
    this.name = "DatabaseError";
  }
}

/**
 * Audio file table entry definition stored alongside transcripts.
 */
export interface AudioFileEntry {
  transcriptId: string;
  audioBlob: Blob;
  metadata: AudioMetadata;
  storedAt: Date;
}

/**
 * Main Dexie database class for Austin RTASS.
 *
 * Manages tables for transcripts, templates, analyses, audioFiles, conversations,
 * recordings, RTASS scorecards, and rubric templates.
 */
export class AustinRTASSDB extends Dexie {
  /** Transcripts table with full-text and date indexing */
  transcripts!: Table<Transcript, string>;

  /** Templates table with category and custom flag indexing */
  templates!: Table<Template, string>;

  /** Analyses table with transcript and template relationship indexing */
  analyses!: Table<Analysis, string>;

  /** Audio files table storing binary blobs for playback */
  audioFiles!: Table<AudioFileEntry, string>;

  /** Conversations table storing Q&A chat history for transcripts (client-side only) */
  conversations!: Table<Conversation, string>;

  /** Recordings table storing saved audio recordings with metadata */
  recordings!: Table<SavedRecording, number>;

  /** RTASS scorecards table storing rubric-based scoring results */
  rtassScorecards!: Table<RtassScorecard, string>;

  /** RTASS rubric templates table storing custom rubric templates */
  rtassRubricTemplates!: Table<RtassRubricTemplate, string>;

  constructor() {
    super("AustinRTASSDB");

    // Define database schema with version 1
    this.version(1).stores({
      // Transcripts: indexed by id (primary), createdAt, and filename
      transcripts: "id, filename, createdAt, metadata.duration",

      // Templates: indexed by id (primary), category, isCustom, and createdAt
      templates: "id, category, isCustom, createdAt, name",

      // Analyses: indexed by id (primary), transcriptId, templateId, and createdAt
      analyses: "id, transcriptId, templateId, createdAt",
    });

    // Version 2 adds audio file storage while preserving existing indexes
    this.version(2).stores({
      transcripts: "id, filename, createdAt, metadata.duration",
      templates: "id, category, isCustom, createdAt, name",
      analyses: "id, transcriptId, templateId, createdAt",
      audioFiles: "transcriptId, storedAt",
    });

    // Version 3 adds compound indexes for better query performance with large datasets
    this.version(3).stores({
      // Transcripts: added compound index [filename+createdAt] for efficient filtering
      transcripts: "id, filename, createdAt, metadata.duration, [filename+createdAt]",

      // Templates: unchanged
      templates: "id, category, isCustom, createdAt, name",

      // Analyses: added compound index [transcriptId+createdAt] for efficient transcript-based queries
      analyses: "id, transcriptId, templateId, createdAt, [transcriptId+createdAt]",

      // Audio files: unchanged
      audioFiles: "transcriptId, storedAt",
    });

    // Version 4 adds transcript fingerprint indexing for duplicate detection
    this.version(4).stores({
      transcripts:
        "id, filename, createdAt, metadata.duration, [filename+createdAt], fingerprint.fileHash",
      templates: "id, category, isCustom, createdAt, name",
      analyses: "id, transcriptId, templateId, createdAt, [transcriptId+createdAt]",
      audioFiles: "transcriptId, storedAt",
    });

    // Version 5 adds conversations table for Q&A chat feature (client-side only storage)
    this.version(5).stores({
      transcripts:
        "id, filename, createdAt, metadata.duration, [filename+createdAt], fingerprint.fileHash",
      templates: "id, category, isCustom, createdAt, name",
      analyses: "id, transcriptId, templateId, createdAt, [transcriptId+createdAt]",
      audioFiles: "transcriptId, storedAt",
      // Conversations: indexed by id (primary), transcriptId (FK), and compound [transcriptId+updatedAt]
      conversations: "id, transcriptId, updatedAt, [transcriptId+updatedAt]",
    });

    // Version 6 adds recordings table for storing saved audio recordings
    this.version(6).stores({
      transcripts:
        "id, filename, createdAt, metadata.duration, [filename+createdAt], fingerprint.fileHash",
      templates: "id, category, isCustom, createdAt, name",
      analyses: "id, transcriptId, templateId, createdAt, [transcriptId+createdAt]",
      audioFiles: "transcriptId, storedAt",
      conversations: "id, transcriptId, updatedAt, [transcriptId+updatedAt]",
      // Recordings: indexed by id (auto-increment primary key), status, transcriptId (optional FK), and metadata.createdAt
      recordings: "++id, status, transcriptId, metadata.createdAt",
    });

    // Version 7 adds summary field and fileSize index for sorting
    this.version(7).stores({
      transcripts:
        "id, filename, createdAt, metadata.duration, metadata.fileSize, [filename+createdAt], fingerprint.fileHash",
      templates: "id, category, isCustom, createdAt, name",
      analyses: "id, transcriptId, templateId, createdAt, [transcriptId+createdAt]",
      audioFiles: "transcriptId, storedAt",
      conversations: "id, transcriptId, updatedAt, [transcriptId+updatedAt]",
      recordings: "++id, status, transcriptId, metadata.createdAt",
    });

    // Version 8 adds RTASS scorecards (rubric-based scoring results)
    this.version(8).stores({
      transcripts:
        "id, filename, createdAt, metadata.duration, metadata.fileSize, [filename+createdAt], fingerprint.fileHash",
      templates: "id, category, isCustom, createdAt, name",
      analyses: "id, transcriptId, templateId, createdAt, [transcriptId+createdAt]",
      audioFiles: "transcriptId, storedAt",
      conversations: "id, transcriptId, updatedAt, [transcriptId+updatedAt]",
      recordings: "++id, status, transcriptId, metadata.createdAt",
      rtassScorecards: "id, transcriptId, rubricTemplateId, createdAt, [transcriptId+createdAt]",
    });

    // Version 9 adds RTASS rubric templates (custom rubrics created by trainers)
    this.version(9).stores({
      transcripts:
        "id, filename, createdAt, metadata.duration, metadata.fileSize, [filename+createdAt], fingerprint.fileHash",
      templates: "id, category, isCustom, createdAt, name",
      analyses: "id, transcriptId, templateId, createdAt, [transcriptId+createdAt]",
      audioFiles: "transcriptId, storedAt",
      conversations: "id, transcriptId, updatedAt, [transcriptId+updatedAt]",
      recordings: "++id, status, transcriptId, metadata.createdAt",
      rtassScorecards: "id, transcriptId, rubricTemplateId, createdAt, [transcriptId+createdAt]",
      rtassRubricTemplates: "id, jurisdiction, createdAt, name",
    });

    // Map tables to classes for better type inference
    this.transcripts = this.table("transcripts");
    this.templates = this.table("templates");
    this.analyses = this.table("analyses");
    this.audioFiles = this.table("audioFiles");
    this.conversations = this.table("conversations");
    this.recordings = this.table("recordings");
    this.rtassScorecards = this.table("rtassScorecards");
    this.rtassRubricTemplates = this.table("rtassRubricTemplates");
  }
}

// Singleton instance of the database
let dbInstance: AustinRTASSDB | null = null;

/**
 * Gets or creates the singleton database instance.
 *
 * @returns The AustinRTASSDB instance
 * @throws {DatabaseError} If the database cannot be initialized
 */
export function getDatabase(): AustinRTASSDB {
  if (!dbInstance) {
    // Check for IndexedDB support
    if (typeof window === "undefined" || !window.indexedDB) {
      throw new DatabaseError(
        "IndexedDB is not supported in this environment",
        "INDEXEDDB_NOT_SUPPORTED"
      );
    }

    dbInstance = new AustinRTASSDB();
  }

  return dbInstance;
}

/**
 * Closes the database connection.
 *
 * Should be called when the application is shutting down.
 * After calling this, getDatabase() will create a new instance.
 */
export function closeDatabase(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

/**
 * Deletes the entire database.
 *
 * WARNING: This will permanently delete all data!
 * Use with extreme caution.
 *
 * @throws {DatabaseError} If the deletion fails
 */
export async function deleteDatabase(): Promise<void> {
  try {
    closeDatabase();
    await Dexie.delete("AustinRTASSDB");
  } catch (error) {
    throw new DatabaseError(
      "Failed to delete database",
      "DATABASE_DELETE_FAILED",
      error instanceof Error ? error : undefined
    );
  }
}

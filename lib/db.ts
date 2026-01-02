/**
 * IndexedDB Database Wrapper (Dexie.js)
 *
 * Public entrypoint for client-side persistence.
 *
 * NOTE: This module is intentionally a façade to reduce change amplification.
 * Implementation details live under `lib/db/*` and are re-exported here.
 */

export {
  DatabaseError,
  MeetingTranscriberDB,
  getDatabase,
  closeDatabase,
  deleteDatabase,
  type AudioFileEntry,
} from "./db/core";

export type { PaginationOptions, PaginatedResult } from "./db/pagination";

export {
  findTranscriptByFingerprint,
  countTranscriptVersions,
  saveTranscript,
  getTranscript,
  getAllTranscripts,
  getTranscriptsPaginated,
  searchTranscriptsPaginated,
  deleteTranscript,
  saveTranscriptsBulk,
  deleteOldTranscripts,
  type TranscriptSortField,
  getTranscriptsSorted,
  deleteTranscriptsBulk,
  updateTranscriptSummary,
} from "./db/transcripts";

export { saveTemplate, getTemplate, getAllTemplates, deleteTemplate } from "./db/templates";

export {
  saveAnalysis,
  getAnalysisByTranscript,
  getAnalysesPaginated,
  deleteAnalysis,
  deleteAnalysesBulk,
} from "./db/analyses";

export {
  saveConversation,
  getConversationByTranscript,
  updateConversation,
  deleteConversation,
  getAllConversations,
} from "./db/conversations";

export {
  saveRtassScorecard,
  getRtassScorecardsByTranscript,
  getRtassScorecard,
  deleteRtassScorecard,
} from "./db/rtass-scorecards";

export {
  type RecordingStatus,
  type SavedRecording,
  type RecordingMetadata,
  type RecordingMode,
  saveRecording,
  getRecording,
  getAllRecordings,
  deleteRecording,
  updateRecordingStatus,
} from "./db/recordings";

export {
  type StorageEstimate,
  type StorageQuotaCheckResult,
  type StorageStatus,
  getStorageEstimate,
  getStorageStatus,
  checkStorageQuota,
  calculateStorageUsage,
} from "./db/storage";

export { getDatabase as default } from "./db/core";

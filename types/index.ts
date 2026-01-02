/**
 * Central Type Definitions Export
 *
 * This file provides a single entry point for all type definitions
 * used throughout the meeting transcription application.
 */

// Transcript types
export type {
  TranscriptSegment,
  TranscriptMetadata,
  Transcript,
  TranscriptionStatus,
  TranscriptionProgress,
  TranscriptInput,
  TranscriptUpdate,
} from './transcript';

export {
  isTranscriptionStatus,
} from './transcript';

// Template types
export type {
  OutputFormat,
  TemplateCategory,
  OutputType,
  TemplateSection,
  Template,
  TemplateInput,
  TemplateUpdate,
  TemplateSectionInput,
  DefaultTemplateConfig,
} from './template';

export {
  isOutputFormat,
  isTemplateCategory,
  isOutputType,
} from './template';

// Analysis types
export type {
  Evidence,
  AnalysisSection,
  AgendaItem,
  BenchmarkStatus,
  BenchmarkObservation,
  RadioReportType,
  RadioReport,
  SafetyEventType,
  SafetyEventSeverity,
  SafetyEvent,
  ActionItem,
  ActionPriority,
  Decision,
  VoteTally,
  Quote,
  QuoteCategory,
  QuoteSentiment,
  AnalysisResults,
  EvaluationResults,
  Analysis,
  EvidenceInput,
  AnalysisInput,
  AnalysisUpdate,
  AnalysisProgress,
  AnalysisConfig,
  AnalysisStats,
} from './analysis';

export {
  isValidRelevanceScore,
  calculateAnalysisStats,
  DEFAULT_ANALYSIS_CONFIG,
} from './analysis';

// Enrichment types
export type {
  EnrichmentConfig,
  MiningContext,
  MiningSegment,
  MiningPattern,
  MiningResult,
  MiningResultMetadata,
  ExtendedMiningResultMetadata,
  ActionItemEnrichment,
  DecisionEnrichment,
  QuoteEnrichment,
  EnrichedActionItem,
  EnrichedDecision,
  EnrichedQuote,
  EnrichedResults,
  EnrichmentMetadata,
} from './enrichment';

export {
  DEFAULT_ENRICHMENT_CONFIG,
  isEnrichedActionItem,
  isEnrichedDecision,
  isEnrichedQuote,
  hasEnrichmentData,
} from './enrichment';

// Audio types
export type {
  PlaybackState,
  PlaybackSpeed,
  AudioPlayerConfig,
  AudioSyncState,
  AudioPlayerControls,
  AudioLoadResult,
  WaveformRegion,
  AudioMetadata,
  AudioStorageResult,
  AudioKeyboardShortcut,
} from './audio';

export {
  DEFAULT_AUDIO_CONFIG,
} from './audio';

// Recording types
export type {
  RecordingMode,
  RecordingState,
  RecordingMetadata,
  SavedRecording,
  RecordingHookState,
  RecordingHookActions,
  UseRecordingReturn,
  BrowserCapabilities,
  RecordingModeConfig,
  MicCheckResult,
  MicCheckState,
  MicCheckError,
  MicCheckPreference,
} from './recording';

// Package types (export/import)
export type {
  ImportConflictAction,
  ExportableTranscript,
  ExportableAnalysis,
  PackageMetadata,
  MeetingTranscriberPackage,
  ValidationResult,
} from './package';

export {
  MAX_PACKAGE_SIZE,
  PACKAGE_FORMAT_VERSION,
  isImportConflictAction,
} from './package';

// Supplemental material types
export type {
  SupplementalDocumentType,
  SupplementalDocumentStatus,
  SupplementalDocument,
  ParseResult,
  SupplementalState,
} from './supplemental';

export {
  SUPPLEMENTAL_LIMITS,
  isSupportedExtension,
  getDocumentTypeFromExtension,
  getDocumentTypeLabel,
  EMPTY_SUPPLEMENTAL_STATE,
} from './supplemental';

// RTASS types
export type {
  RtassCriterionType,
  RtassVerdict,
  RtassEvidence,
  RtassObservedEvent,
  RtassCriterion,
  RtassRubricSection,
  RtassScoringConfig,
  RtassLlmConfig,
  RtassRubricTemplate,
  RtassScorecardCriterion,
  RtassScorecardSection,
  RtassScorecard,
} from './rtass';

/**
 * Common utility types used across the application.
 */

/**
 * Represents a unique identifier (UUID or similar).
 */
export type ID = string;

/**
 * ISO 8601 timestamp string.
 */
export type ISODateString = string;

/**
 * Generic API response wrapper.
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/**
 * Generic pagination parameters.
 */
export interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Generic paginated response.
 */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * File upload result.
 */
export interface UploadResult {
  filename: string;
  size: number;
  url?: string;
  uploadedAt: Date;
}

/**
 * Error types that can occur in the application.
 */
export type ErrorType =
  | 'validation_error'
  | 'upload_error'
  | 'transcription_error'
  | 'analysis_error'
  | 'api_error'
  | 'network_error'
  | 'unknown_error';

/**
 * Structured error information.
 */
export interface AppError {
  type: ErrorType;
  message: string;
  details?: Record<string, unknown>;
  timestamp: Date;
}

/**
 * Audio file constraints.
 */
export interface AudioFileConstraints {
  maxSize: number; // in bytes
  allowedFormats: string[]; // MIME types
  maxDuration?: number; // in seconds
}

/**
 * Default audio file constraints.
 */
export const DEFAULT_AUDIO_CONSTRAINTS: AudioFileConstraints = {
  maxSize: 25 * 1024 * 1024, // 25 MB (OpenAI Whisper limit)
  allowedFormats: [
    'audio/mpeg', // Standard MP3 MIME type
    'audio/mp4',
    'audio/m4a',
    'audio/wav',
    'audio/webm',
    'audio/flac',
    'audio/ogg',
  ],
  maxDuration: 3600, // 1 hour
};

/**
 * Application configuration.
 */
export interface AppConfig {
  audioConstraints: AudioFileConstraints;
  enableOfflineMode: boolean;
  enableSpeakerDiarization: boolean;
  defaultLanguage?: string;
  maxStoredTranscripts?: number;
}

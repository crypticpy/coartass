/**
 * Recording Type Definitions
 *
 * Type definitions for the standalone recording feature with three modes:
 * microphone, system audio, and commentary (combined).
 *
 * This module defines types for:
 * - Recording modes and states
 * - Recording metadata and storage
 * - Hook interfaces for recording functionality
 * - Browser capability detection
 * - UI configuration for recording modes
 */

/**
 * Recording mode determines the audio source(s).
 *
 * - 'microphone': Records from user's microphone only
 * - 'system-audio': Records system/computer audio only (e.g., meeting audio)
 * - 'commentary': Records both microphone and system audio simultaneously
 */
export type RecordingMode = 'microphone' | 'system-audio' | 'commentary';

/**
 * Recording state machine states.
 *
 * State transitions:
 * - idle -> preparing -> recording
 * - recording -> paused -> recording
 * - recording -> completed
 * - any state -> error
 */
export type RecordingState =
  | 'idle'           // Initial state, no recording in progress
  | 'preparing'      // Requesting permissions, setting up media streams
  | 'recording'      // Actively recording audio
  | 'paused'         // Recording paused (can be resumed)
  | 'completed'      // Recording finished, audio available for preview
  | 'error';         // Error occurred during recording process

/**
 * Metadata associated with a recording.
 *
 * Captures essential information about the recorded audio
 * including format, size, duration, and creation time.
 */
export interface RecordingMetadata {
  /** Recording mode used (microphone, system-audio, or commentary) */
  mode: RecordingMode;

  /** Duration of the recording in seconds */
  duration: number;

  /** File size in bytes */
  size: number;

  /** MIME type of the recorded audio (e.g., 'audio/webm', 'audio/mp4') */
  mimeType: string;

  /** Timestamp when the recording was created */
  createdAt: Date;

  /** Audio sample rate in Hz (if available from MediaRecorder) */
  sampleRate?: number;
}

/**
 * A saved recording stored in IndexedDB.
 *
 * Represents a complete recording with its audio data, metadata,
 * and potential links to transcripts if transcription has been performed.
 */
export interface SavedRecording {
  /** Auto-incremented unique identifier (assigned by Dexie) */
  id?: number;

  /** The recorded audio data as a Blob */
  blob: Blob;

  /** Metadata about the recording */
  metadata: RecordingMetadata;

  /** Current status of the recording */
  status: 'saved' | 'transcribed';

  /** Link to the associated transcript (if transcribed) */
  transcriptId?: string;

  /** Optional user-provided name for the recording */
  name?: string;
}

/**
 * Recording hook state.
 *
 * Represents the current state of the recording process
 * including status, mode, duration, errors, and audio output.
 */
export interface RecordingHookState {
  /** Current state in the recording state machine */
  state: RecordingState;

  /** Currently selected recording mode (null if not selected) */
  mode: RecordingMode | null;

  /** Current duration of the recording in seconds */
  duration: number;

  /** Error object if state is 'error', null otherwise */
  error: Error | null;

  /** Recorded audio as a Blob (available when recording is completed) */
  audioBlob: Blob | null;

  /** Object URL for audio playback (available when recording is completed) */
  audioUrl: string | null;
}

/**
 * Recording hook actions.
 *
 * Methods to control the recording lifecycle including
 * mode selection, start/stop, pause/resume, and cleanup.
 */
export interface RecordingHookActions {
  /** Select the recording mode (must be called before starting) */
  selectMode: (mode: RecordingMode) => void;

  /** Start recording (async - requests permissions and initializes streams) */
  startRecording: () => Promise<void>;

  /** Start recording with a provided MediaStream (used with useAudioSources hook) */
  startRecordingWithStream: (stream: MediaStream) => void;

  /** Pause the current recording */
  pauseRecording: () => void;

  /** Resume a paused recording */
  resumeRecording: () => void;

  /** Stop the recording and make audio available */
  stopRecording: () => void;

  /** Discard the current recording without saving */
  discardRecording: () => void;

  /** Reset the recording state to idle */
  reset: () => void;
}

/**
 * Combined recording hook return type.
 *
 * Merges state and actions into a single interface
 * returned by the useRecording hook.
 */
export type UseRecordingReturn = RecordingHookState & RecordingHookActions;

/**
 * Browser capability flags.
 *
 * Detects which recording modes are supported in the current
 * browser and execution context (secure context, browser type, etc.).
 */
export interface BrowserCapabilities {
  /** Whether microphone recording is supported */
  hasMicrophoneSupport: boolean;

  /** Whether system audio recording is supported (getDisplayMedia with audio) */
  hasSystemAudioSupport: boolean;

  /** Whether commentary mode (both sources) is supported */
  hasCommentarySupport: boolean;

  /** Detected browser name (for display and debugging) */
  browserName: string;

  /** Whether the page is served over HTTPS or localhost (required for MediaRecorder) */
  isSecureContext: boolean;
}

/**
 * Mode configuration for UI display.
 *
 * Provides metadata for each recording mode to render
 * selection UI, including icons, colors, and availability.
 */
export interface RecordingModeConfig {
  /** Unique identifier matching RecordingMode */
  id: RecordingMode;

  /** Display label for the mode */
  label: string;

  /** Description text explaining what the mode does */
  description: string;

  /** Lucide icon name for visual representation */
  icon: string;

  /** Mantine color theme for the mode */
  color: string;

  /** Whether this mode is supported in the current browser */
  supported: boolean;

  /** Explanation of why the mode is disabled (if not supported) */
  disabledReason?: string;
}

/**
 * Mic check result indicating audio level status.
 *
 * - 'good': Audio levels are adequate for transcription
 * - 'low': Audio is detected but may be too quiet
 * - 'silent': No audio detected (mic may be muted or disconnected)
 * - 'error': An error occurred during the mic check
 */
export type MicCheckResult = 'good' | 'low' | 'silent' | 'error';

/**
 * Mic check state machine states.
 *
 * State transitions:
 * - requesting: Waiting for user to grant microphone permission
 * - checking: Permission granted, analyzing audio levels
 * - ready: Audio levels are good, ready to record
 * - warning: Audio levels are low or silent, user should adjust
 * - error: An error occurred (permission denied, no mic, etc.)
 */
export type MicCheckState = 'requesting' | 'checking' | 'ready' | 'warning' | 'error';

/**
 * Specific microphone error conditions.
 *
 * Used to provide targeted help messages based on the type of error
 * encountered when accessing the microphone.
 */
export type MicCheckError =
  | 'permission_denied'  // User denied microphone permission
  | 'no_microphone'      // No microphone device found
  | 'device_in_use'      // Microphone is being used by another app
  | 'not_allowed'        // Policy restriction (e.g., enterprise policy)
  | 'unknown';           // Unexpected error

/**
 * User preference for skipping the mic level check.
 *
 * Stored in localStorage to remember user's preference across sessions.
 */
export interface MicCheckPreference {
  /** Whether to skip the mic check before recording */
  skipMicCheck: boolean;

  /** When the preference was last updated */
  lastUpdated: Date;
}

/**
 * Audio Player Type Definitions
 *
 * Types for audio playback, waveform visualization, and audio-transcript synchronization.
 */

import type { TranscriptSegment } from './transcript';

/**
 * Audio playback state
 */
export type PlaybackState = 'playing' | 'paused' | 'loading' | 'buffering' | 'error' | 'ready';

/**
 * Audio playback speed options
 */
export type PlaybackSpeed = 0.5 | 0.75 | 1 | 1.25 | 1.5 | 1.75 | 2;

/**
 * Zoom level preset for DAW-style waveform
 */
export type ZoomLevel = '30s' | '1m' | '5m' | 'full';

/**
 * Audio player configuration
 */
export interface AudioPlayerConfig {
  /** Enable waveform visualization */
  showWaveform: boolean;

  /** Enable timeline with timestamps */
  showTimeline: boolean;

  /** Enable volume control */
  showVolumeControl: boolean;

  /** Enable playback speed control */
  showSpeedControl: boolean;

  /** Waveform color (primary) */
  waveColor: string;

  /** Progress wave color */
  progressColor: string;

  /** Waveform height in pixels */
  waveformHeight: number;

  /** Width of waveform bars (for bar renderer) */
  barWidth: number;

  /** Spacing between waveform bars */
  barGap: number;

  /** Radius for waveform bars */
  barRadius: number;

  /** Cursor width for waveform */
  cursorWidth: number;

  /** Enable responsive container */
  responsive: boolean;

  /** Enable keyboard shortcuts */
  enableKeyboardShortcuts: boolean;

  /** Enable DAW-style scrolling waveform */
  scrollingWaveform: boolean;

  /** Auto-center playhead during playback */
  autoCenter: boolean;

  /** Minimum pixels per second (controls zoom) */
  minPxPerSec: number;
}

/**
 * Default audio player configuration
 */
export const DEFAULT_AUDIO_CONFIG: AudioPlayerConfig = {
  showWaveform: true,
  showTimeline: true,
  showVolumeControl: true,
  showSpeedControl: true,
  waveColor: '#9CA3AF',
  progressColor: '#3B82F6',
  waveformHeight: 80,
  barWidth: 2,
  barGap: 2,
  barRadius: 3,
  cursorWidth: 2,
  responsive: true,
  enableKeyboardShortcuts: true,
  scrollingWaveform: true,
  autoCenter: true,
  minPxPerSec: 50, // Default zoom showing ~20s of audio per 1000px
};

/**
 * Audio sync state for tracking playback position with transcript
 */
export interface AudioSyncState {
  /** Current playback time in seconds */
  currentTime: number;

  /** Total duration in seconds */
  duration: number;

  /** Current playback state */
  state: PlaybackState;

  /** Current playback speed */
  speed: PlaybackSpeed;

  /** Current volume (0-1) */
  volume: number;

  /** Is audio muted */
  muted: boolean;

  /** Currently active transcript segment (if any) */
  activeSegment: TranscriptSegment | null;

  /** Index of active segment */
  activeSegmentIndex: number;
}

/**
 * Audio player control methods
 */
export interface AudioPlayerControls {
  /** Play audio */
  play: () => void;

  /** Pause audio */
  pause: () => void;

  /** Toggle play/pause */
  togglePlayPause: () => void;

  /** Seek to specific time in seconds */
  seek: (time: number) => void;

  /** Set playback speed */
  setSpeed: (speed: PlaybackSpeed) => void;

  /** Set volume (0-1) */
  setVolume: (volume: number) => void;

  /** Toggle mute */
  toggleMute: () => void;

  /** Jump forward by seconds */
  skipForward: (seconds: number) => void;

  /** Jump backward by seconds */
  skipBackward: (seconds: number) => void;

  /** Jump to specific segment */
  jumpToSegment: (segmentIndex: number) => void;
}

/**
 * Audio loading result
 */
export interface AudioLoadResult {
  /** Whether audio loaded successfully */
  success: boolean;

  /** Duration in seconds (if successful) */
  duration?: number;

  /** Error message (if failed) */
  error?: string;
}

/**
 * Waveform region for highlighting (future feature)
 */
export interface WaveformRegion {
  /** Unique identifier */
  id: string;

  /** Start time in seconds */
  start: number;

  /** End time in seconds */
  end: number;

  /** Region color */
  color: string;

  /** Optional label */
  label?: string;

  /** Whether region is draggable */
  drag?: boolean;

  /** Whether region is resizable */
  resize?: boolean;
}

/**
 * Audio file metadata
 */
export interface AudioMetadata {
  /** File name */
  filename: string;

  /** File size in bytes */
  size: number;

  /** MIME type */
  type: string;

  /** Duration in seconds */
  duration: number;

  /** When audio was loaded */
  loadedAt: Date;
}

/**
 * Audio storage result
 */
export interface AudioStorageResult {
  /** Object URL for playback */
  audioUrl: string;

  /** Audio metadata */
  metadata: AudioMetadata;
}

/**
 * Keyboard shortcut for audio player
 */
export interface AudioKeyboardShortcut {
  /** Keyboard key */
  key: string;

  /** Description of action */
  description: string;

  /** Action to perform */
  action: () => void;
}

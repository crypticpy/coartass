/**
 * Audio-Transcript Synchronization Hook
 *
 * Custom hook that manages synchronization between audio playback and transcript segments.
 * Tracks current playback position, determines active segment, and provides controls.
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type WaveSurfer from 'wavesurfer.js';
import type {
  AudioSyncState,
  AudioPlayerControls,
  PlaybackState,
  PlaybackSpeed,
} from '@/types/audio';
import type { TranscriptSegment } from '@/types/transcript';

/**
 * Props for the useAudioSync hook
 */
interface UseAudioSyncProps {
  /** Array of transcript segments with timing information */
  segments: TranscriptSegment[];

  /** Callback when active segment changes */
  onSegmentChange?: (segment: TranscriptSegment | null, index: number) => void;

  /** Callback when playback state changes */
  onPlaybackStateChange?: (state: PlaybackState) => void;

  /** Initial playback speed */
  initialSpeed?: PlaybackSpeed;

  /** Initial volume (0-1) */
  initialVolume?: number;
}

/**
 * Return type for useAudioSync hook
 */
interface UseAudioSyncReturn {
  /** Current audio sync state */
  syncState: AudioSyncState;

  /** Audio player control methods */
  controls: AudioPlayerControls;

  /** Ref to attach to WaveSurfer instance */
  waveSurferRef: React.MutableRefObject<WaveSurfer | null>;

  /** Register WaveSurfer instance */
  registerWaveSurfer: (instance: WaveSurfer | null) => void;
}

/**
 * Finds the active transcript segment based on current playback time
 *
 * @param segments - Array of transcript segments
 * @param currentTime - Current playback time in seconds
 * @returns Tuple of [segment, index] or [null, -1] if no match
 */
function findActiveSegment(
  segments: TranscriptSegment[],
  currentTime: number
): [TranscriptSegment | null, number] {
  // Find the segment that contains the current time
  const index = segments.findIndex(
    (segment) => currentTime >= segment.start && currentTime < segment.end
  );

  if (index === -1) {
    // If no exact match, find the most recent segment
    const lastPassedIndex = segments.findIndex(
      (segment, i) => {
        const nextSegment = segments[i + 1];
        return segment.end <= currentTime && (!nextSegment || nextSegment.start > currentTime);
      }
    );

    if (lastPassedIndex !== -1) {
      return [segments[lastPassedIndex], lastPassedIndex];
    }

    return [null, -1];
  }

  return [segments[index], index];
}

/**
 * Custom hook for audio-transcript synchronization
 *
 * Provides state management and controls for syncing audio playback
 * with transcript segments, including automatic segment highlighting
 * and seeking to segments.
 *
 * @param props - Hook configuration
 * @returns Audio sync state, controls, and WaveSurfer registration
 */
export function useAudioSync({
  segments,
  onSegmentChange,
  onPlaybackStateChange,
  initialSpeed = 1,
  initialVolume = 0.8,
}: UseAudioSyncProps): UseAudioSyncReturn {
  // WaveSurfer instance reference
  const waveSurferRef = useRef<WaveSurfer | null>(null);

  // Track last active segment to avoid redundant callbacks
  const lastActiveSegmentIndex = useRef<number>(-1);

  // Audio sync state
  const [syncState, setSyncState] = useState<AudioSyncState>({
    currentTime: 0,
    duration: 0,
    state: 'loading',
    speed: initialSpeed,
    volume: initialVolume,
    muted: false,
    activeSegment: null,
    activeSegmentIndex: -1,
  });

  /**
   * Updates current time and active segment
   */
  const updateCurrentTime = useCallback(
    (time: number) => {
      const [activeSegment, activeSegmentIndex] = findActiveSegment(segments, time);

      setSyncState((prev) => ({
        ...prev,
        currentTime: time,
        activeSegment,
        activeSegmentIndex,
      }));

      // Call segment change callback if segment changed
      if (activeSegmentIndex !== lastActiveSegmentIndex.current) {
        lastActiveSegmentIndex.current = activeSegmentIndex;
        onSegmentChange?.(activeSegment, activeSegmentIndex);
      }
    },
    [segments, onSegmentChange]
  );

  /**
   * Register WaveSurfer instance and set up event listeners
   */
  const registerWaveSurfer = useCallback(
    (instance: WaveSurfer | null) => {
      if (!instance) return;

      waveSurferRef.current = instance;

      // Set initial volume and speed
      instance.setVolume(initialVolume);
      if (instance.setPlaybackRate) {
        instance.setPlaybackRate(initialSpeed);
      }

      // Listen to timeupdate for current position
      instance.on('timeupdate', (time: number) => {
        updateCurrentTime(time);
      });

      // Listen to ready event
      instance.on('ready', () => {
        const duration = instance.getDuration();
        setSyncState((prev) => ({
          ...prev,
          duration,
          state: 'ready',
        }));
        onPlaybackStateChange?.('ready');
      });

      // Listen to play event
      instance.on('play', () => {
        setSyncState((prev) => ({ ...prev, state: 'playing' }));
        onPlaybackStateChange?.('playing');
      });

      // Listen to pause event
      instance.on('pause', () => {
        setSyncState((prev) => ({ ...prev, state: 'paused' }));
        onPlaybackStateChange?.('paused');
      });

      // Listen to finish event
      instance.on('finish', () => {
        setSyncState((prev) => ({ ...prev, state: 'paused' }));
        onPlaybackStateChange?.('paused');
      });

      // Listen to error event
      instance.on('error', (error: Error) => {
        console.error('WaveSurfer error:', error);
        setSyncState((prev) => ({ ...prev, state: 'error' }));
        onPlaybackStateChange?.('error');
      });

      // Listen to loading event
      instance.on('loading', () => {
        setSyncState((prev) => ({ ...prev, state: 'loading' }));
        onPlaybackStateChange?.('loading');
      });
    },
    [initialVolume, initialSpeed, updateCurrentTime, onPlaybackStateChange]
  );

  /**
   * Play audio
   */
  const play = useCallback(() => {
    waveSurferRef.current?.play();
  }, []);

  /**
   * Pause audio
   */
  const pause = useCallback(() => {
    waveSurferRef.current?.pause();
  }, []);

  /**
   * Toggle play/pause
   */
  const togglePlayPause = useCallback(() => {
    waveSurferRef.current?.playPause();
  }, []);

  /**
   * Seek to specific time
   */
  const seek = useCallback((time: number) => {
    if (!waveSurferRef.current) return;

    const duration = waveSurferRef.current.getDuration();
    if (duration > 0) {
      const position = Math.max(0, Math.min(time / duration, 1));
      waveSurferRef.current.seekTo(position);
    }
  }, []);

  /**
   * Set playback speed
   */
  const setSpeed = useCallback((speed: PlaybackSpeed) => {
    if (!waveSurferRef.current) return;

    waveSurferRef.current.setPlaybackRate(speed);
    setSyncState((prev) => ({ ...prev, speed }));
  }, []);

  /**
   * Set volume
   */
  const setVolume = useCallback((volume: number) => {
    if (!waveSurferRef.current) return;

    const clampedVolume = Math.max(0, Math.min(1, volume));
    waveSurferRef.current.setVolume(clampedVolume);
    setSyncState((prev) => ({ ...prev, volume: clampedVolume, muted: false }));
  }, []);

  /**
   * Toggle mute
   */
  const toggleMute = useCallback(() => {
    const waveSurfer = waveSurferRef.current;
    if (!waveSurfer) return;

    setSyncState((prev) => {
      const newMuted = !prev.muted;
      waveSurfer.setVolume(newMuted ? 0 : prev.volume);
      return { ...prev, muted: newMuted };
    });
  }, []);

  /**
   * Skip forward
   */
  const skipForward = useCallback((seconds: number) => {
    if (!waveSurferRef.current) return;

    const currentTime = waveSurferRef.current.getCurrentTime();
    seek(currentTime + seconds);
  }, [seek]);

  /**
   * Skip backward
   */
  const skipBackward = useCallback((seconds: number) => {
    if (!waveSurferRef.current) return;

    const currentTime = waveSurferRef.current.getCurrentTime();
    seek(currentTime - seconds);
  }, [seek]);

  /**
   * Jump to specific segment
   */
  const jumpToSegment = useCallback(
    (segmentIndex: number) => {
      if (segmentIndex < 0 || segmentIndex >= segments.length) return;

      const segment = segments[segmentIndex];
      seek(segment.start);
    },
    [segments, seek]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (waveSurferRef.current) {
        waveSurferRef.current.destroy();
        waveSurferRef.current = null;
      }
    };
  }, []);

  // Create controls object
  const controls: AudioPlayerControls = {
    play,
    pause,
    togglePlayPause,
    seek,
    setSpeed,
    setVolume,
    toggleMute,
    skipForward,
    skipBackward,
    jumpToSegment,
  };

  return {
    syncState,
    controls,
    waveSurferRef,
    registerWaveSurfer,
  };
}

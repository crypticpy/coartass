/**
 * Audio-Transcript Synchronization Hook
 *
 * Custom hook that manages synchronization between audio playback and transcript segments.
 * Tracks current playback position, determines active segment, and provides controls.
 *
 * Browser Compatibility Notes:
 * - iOS Safari: Volume control via media element is disabled; uses Web Audio gain instead
 * - Safari: Requires user interaction before AudioContext can start
 * - Firefox: Full support
 * - Chrome: Full support
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
 * Detect if running on iOS Safari where volume control is restricted
 */
function isIOSSafari(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isSafari = /Safari/.test(ua) && !/Chrome|CriOS|FxiOS/.test(ua);
  return isIOS && isSafari;
}

/**
 * Audio enhancement settings for real-time processing
 */
export interface AudioEnhancementSettings {
  /** Volume boost (1 = 100%, 2 = 200%, etc.) */
  volumeBoost: number;
  /** High-pass filter enabled */
  highPassEnabled: boolean;
  /** High-pass cutoff frequency in Hz */
  highPassFreq: number;
  /** Compressor enabled for evening out levels */
  compressorEnabled: boolean;
}

/**
 * Default enhancement settings
 */
const DEFAULT_ENHANCEMENT: AudioEnhancementSettings = {
  volumeBoost: 1,
  highPassEnabled: false,
  highPassFreq: 80,
  compressorEnabled: false,
};

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
 * Extended audio controls including enhancement settings
 */
export interface ExtendedAudioControls extends AudioPlayerControls {
  /** Set volume boost (1-3, where 1 = 100%, 3 = 300%) */
  setVolumeBoost: (boost: number) => void;
  /** Toggle high-pass filter */
  toggleHighPass: (enabled?: boolean) => void;
  /** Set high-pass frequency */
  setHighPassFreq: (freq: number) => void;
  /** Toggle compressor */
  toggleCompressor: (enabled?: boolean) => void;
  /** Get current enhancement settings */
  getEnhancementSettings: () => AudioEnhancementSettings;
}

/**
 * Return type for useAudioSync hook
 */
interface UseAudioSyncReturn {
  /** Current audio sync state */
  syncState: AudioSyncState;

  /** Audio player control methods */
  controls: ExtendedAudioControls;

  /** Ref to attach to WaveSurfer instance */
  waveSurferRef: React.MutableRefObject<WaveSurfer | null>;

  /** Register WaveSurfer instance */
  registerWaveSurfer: (instance: WaveSurfer | null) => void;

  /** Current enhancement settings */
  enhancement: AudioEnhancementSettings;
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

  // Web Audio nodes for real-time processing
  const audioContextRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const highPassNodeRef = useRef<BiquadFilterNode | null>(null);
  const compressorNodeRef = useRef<DynamicsCompressorNode | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);

  // Track the media element to prevent multiple source creation
  const connectedMediaElementRef = useRef<HTMLMediaElement | null>(null);

  // Track last active segment to avoid redundant callbacks
  const lastActiveSegmentIndex = useRef<number>(-1);

  // Use ref for volume boost to avoid stale closures
  const volumeBoostRef = useRef<number>(DEFAULT_ENHANCEMENT.volumeBoost);

  // Track iOS Safari for volume workarounds
  const isIOSRef = useRef<boolean>(false);

  // Enhancement settings state
  const [enhancement, setEnhancement] = useState<AudioEnhancementSettings>(DEFAULT_ENHANCEMENT);

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
   * Initialize Web Audio processing chain
   * Creates gain, high-pass filter, and compressor nodes
   *
   * IMPORTANT: MediaElementAudioSourceNode can only be created once per media element.
   * This function tracks which element is connected and handles cleanup properly.
   */
  const initAudioProcessing = useCallback((mediaElement: HTMLMediaElement) => {
    // Skip if already initialized with the same media element
    if (audioContextRef.current && sourceNodeRef.current && connectedMediaElementRef.current === mediaElement) {
      return;
    }

    // If we have a different media element, we need to clean up and recreate
    // Note: You cannot create multiple MediaElementAudioSourceNode from the same element
    if (connectedMediaElementRef.current && connectedMediaElementRef.current !== mediaElement) {
      console.warn('[AudioSync] Media element changed - cleaning up previous audio context');
      // Close old context - the source node is automatically disconnected
      if (audioContextRef.current) {
        try {
          audioContextRef.current.close();
        } catch {
          // Ignore close errors
        }
      }
      audioContextRef.current = null;
      sourceNodeRef.current = null;
      gainNodeRef.current = null;
      highPassNodeRef.current = null;
      compressorNodeRef.current = null;
    }

    try {
      // Detect iOS Safari for volume workarounds
      isIOSRef.current = isIOSSafari();

      // Create audio context with webkit fallback for older Safari
      const AudioContextClass = window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

      if (!AudioContextClass) {
        console.warn('[AudioSync] AudioContext not supported - audio enhancement disabled');
        return;
      }

      const audioContext = new AudioContextClass();
      audioContextRef.current = audioContext;
      connectedMediaElementRef.current = mediaElement;

      // Handle AudioContext state changes (iOS Safari can suspend during calls, etc.)
      audioContext.addEventListener('statechange', () => {
        if (audioContext.state === 'suspended' && waveSurferRef.current?.isPlaying?.()) {
          // Context was suspended while playing - try to resume
          audioContext.resume().catch((err) => {
            console.warn('[AudioSync] Failed to resume suspended context:', err);
          });
        }
      });

      // Create source from media element
      const source = audioContext.createMediaElementSource(mediaElement);
      sourceNodeRef.current = source;

      // Create gain node for volume boost (can go above 1)
      const gainNode = audioContext.createGain();
      gainNode.gain.value = volumeBoostRef.current; // Use ref value
      gainNodeRef.current = gainNode;

      // Create high-pass filter (for removing low-frequency rumble)
      const highPassNode = audioContext.createBiquadFilter();
      highPassNode.type = 'highpass';
      highPassNode.frequency.value = 80; // Default, will be updated
      highPassNode.Q.value = 0.707; // Butterworth response
      highPassNodeRef.current = highPassNode;

      // Create compressor (for evening out loud/quiet sections)
      const compressor = audioContext.createDynamicsCompressor();
      compressor.threshold.value = -24;  // Start compressing at -24dB
      compressor.knee.value = 12;         // Soft knee
      compressor.ratio.value = 4;         // 4:1 compression ratio
      compressor.attack.value = 0.005;    // 5ms attack
      compressor.release.value = 0.1;     // 100ms release
      compressorNodeRef.current = compressor;

      // Initially connect: source -> gain -> destination
      // rebuildAudioChain will handle adding filters when enabled
      source.connect(gainNode);
      gainNode.connect(audioContext.destination);

      console.log('[AudioSync] Web Audio processing chain initialized, boost:', gainNode.gain.value);
    } catch (err) {
      console.error('[AudioSync] Failed to initialize Web Audio processing:', err);
      // Clean up partial initialization
      connectedMediaElementRef.current = null;
    }
  }, []);

  /**
   * Rebuild the audio processing chain based on current enhancement settings
   */
  const rebuildAudioChain = useCallback(() => {
    const source = sourceNodeRef.current;
    const gain = gainNodeRef.current;
    const highPass = highPassNodeRef.current;
    const compressor = compressorNodeRef.current;
    const context = audioContextRef.current;

    if (!source || !gain || !highPass || !compressor || !context) return;

    // Disconnect all nodes first
    try {
      source.disconnect();
      gain.disconnect();
      highPass.disconnect();
      compressor.disconnect();
    } catch {
      // Ignore disconnection errors
    }

    // Build chain: source -> [highpass] -> [compressor] -> gain -> destination
    let currentNode: AudioNode = source;

    if (enhancement.highPassEnabled) {
      currentNode.connect(highPass);
      currentNode = highPass;
    }

    if (enhancement.compressorEnabled) {
      currentNode.connect(compressor);
      currentNode = compressor;
    }

    // Always end with gain -> destination
    currentNode.connect(gain);
    gain.connect(context.destination);

    console.log(`[AudioSync] Audio chain rebuilt: highPass=${enhancement.highPassEnabled}, compressor=${enhancement.compressorEnabled}`);
  }, [enhancement.highPassEnabled, enhancement.compressorEnabled]);

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

        // Initialize Web Audio processing on first play (AudioContext requires user interaction)
        // WaveSurfer exposes the media element via getMediaElement() when using MediaElement backend
        if (!audioContextRef.current) {
          try {
            const mediaElement = instance.getMediaElement?.();
            if (mediaElement instanceof HTMLMediaElement) {
              initAudioProcessing(mediaElement);
            } else {
              console.warn('[AudioSync] No media element available - audio enhancement disabled');
            }
          } catch (err) {
            console.warn('[AudioSync] Could not access media element:', err);
          }
        }

        // Resume audio context if suspended (browser policy)
        if (audioContextRef.current?.state === 'suspended') {
          audioContextRef.current.resume().catch(console.error);
        }
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
    [initialVolume, initialSpeed, updateCurrentTime, onPlaybackStateChange, initAudioProcessing]
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
   * Note: Uses volumeBoostRef to avoid stale closure issues when boost changes while muted
   */
  const toggleMute = useCallback(() => {
    const waveSurfer = waveSurferRef.current;
    if (!waveSurfer) return;

    setSyncState((prev) => {
      const newMuted = !prev.muted;

      // On iOS Safari, volume control via media element doesn't work
      // So we only control via the gain node
      if (!isIOSRef.current) {
        waveSurfer.setVolume(newMuted ? 0 : prev.volume);
      }

      // Control volume via Web Audio gain node (works everywhere including iOS)
      if (gainNodeRef.current && audioContextRef.current) {
        const targetGain = newMuted ? 0 : volumeBoostRef.current;
        // Use setValueAtTime for smooth transition and to avoid click
        gainNodeRef.current.gain.setValueAtTime(
          targetGain,
          audioContextRef.current.currentTime
        );
      }
      return { ...prev, muted: newMuted };
    });
  }, []); // No dependencies needed - uses refs

  /**
   * Set volume boost (1 = 100%, 2 = 200%, 3 = 300%)
   * Updates both state and ref to ensure consistent behavior
   */
  const setVolumeBoost = useCallback((boost: number) => {
    const clampedBoost = Math.max(0.5, Math.min(3, boost));

    // Update ref immediately for use in other callbacks
    volumeBoostRef.current = clampedBoost;

    setEnhancement(prev => ({ ...prev, volumeBoost: clampedBoost }));

    // Apply to gain node if available
    // Read muted state from syncState via setState callback to get latest value
    setSyncState(prev => {
      if (gainNodeRef.current && audioContextRef.current) {
        const targetGain = prev.muted ? 0 : clampedBoost;
        gainNodeRef.current.gain.setValueAtTime(targetGain, audioContextRef.current.currentTime);
        console.log('[AudioSync] Volume boost set to:', clampedBoost, 'gain value:', targetGain);
      } else {
        console.log('[AudioSync] Gain node not ready, boost saved:', clampedBoost);
      }
      return prev; // Don't modify syncState, just read it
    });
  }, []); // No dependencies - uses refs and setState callback

  /**
   * Toggle high-pass filter
   */
  const toggleHighPass = useCallback((enabled?: boolean) => {
    setEnhancement(prev => {
      const newEnabled = enabled !== undefined ? enabled : !prev.highPassEnabled;
      return { ...prev, highPassEnabled: newEnabled };
    });
  }, []);

  /**
   * Set high-pass filter frequency
   */
  const setHighPassFreq = useCallback((freq: number) => {
    const clampedFreq = Math.max(20, Math.min(500, freq));
    setEnhancement(prev => ({ ...prev, highPassFreq: clampedFreq }));

    // Apply to filter node if available
    if (highPassNodeRef.current) {
      highPassNodeRef.current.frequency.value = clampedFreq;
    }
  }, []);

  /**
   * Toggle compressor
   */
  const toggleCompressor = useCallback((enabled?: boolean) => {
    setEnhancement(prev => {
      const newEnabled = enabled !== undefined ? enabled : !prev.compressorEnabled;
      return { ...prev, compressorEnabled: newEnabled };
    });
  }, []);

  /**
   * Get current enhancement settings
   */
  const getEnhancementSettings = useCallback(() => enhancement, [enhancement]);

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

  // Rebuild audio chain when filter settings change
  useEffect(() => {
    rebuildAudioChain();
  }, [rebuildAudioChain]);

  // Sync volume boost ref when enhancement state changes
  // This ensures the ref stays in sync if enhancement is updated externally
  useEffect(() => {
    volumeBoostRef.current = enhancement.volumeBoost;
  }, [enhancement.volumeBoost]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Clean up audio context
      if (audioContextRef.current) {
        try {
          audioContextRef.current.close();
        } catch {
          // Ignore close errors
        }
        audioContextRef.current = null;
      }
      sourceNodeRef.current = null;
      gainNodeRef.current = null;
      highPassNodeRef.current = null;
      compressorNodeRef.current = null;
      connectedMediaElementRef.current = null;

      if (waveSurferRef.current) {
        waveSurferRef.current.destroy();
        waveSurferRef.current = null;
      }
    };
  }, []);

  // Create controls object with extended enhancement controls
  const controls: ExtendedAudioControls = {
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
    // Enhancement controls
    setVolumeBoost,
    toggleHighPass,
    setHighPassFreq,
    toggleCompressor,
    getEnhancementSettings,
  };

  return {
    syncState,
    controls,
    waveSurferRef,
    registerWaveSurfer,
    enhancement,
  };
}

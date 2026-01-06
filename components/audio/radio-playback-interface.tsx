/**
 * Radio Playback Interface Component
 *
 * DAW-style audio playback optimized for radio traffic with:
 * - Scrollable waveform with zoom controls (30s, 1m, 5m, full)
 * - Auto-centering playhead during playback
 * - Virtualized transcript mini-view for performance
 * - Speed buttons for quick access
 * - Inline metadata display
 */

'use client';

import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { useDisclosure } from '@mantine/hooks';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Loader2,
  AlertCircle,
  RefreshCw,
  Clock,
  FileText,
  HardDrive,
  FastForward,
  Rewind,
  Settings,
  Presentation,
} from 'lucide-react';
import {
  Slider,
  Stack,
  Group,
  Text,
  Paper,
  Box,
  ActionIcon,
  Tooltip,
  SegmentedControl,
  Button,
} from '@mantine/core';
import { WaveformPlayer } from './waveform-player';
import { AudioControlsModal } from './audio-controls-modal';
import { useAudioSync } from '@/hooks/use-audio-sync';
import { formatTimestamp, formatDuration, formatFileSize } from '@/lib/transcript-utils';
import type { TranscriptSegment } from '@/types/transcript';
import type { PlaybackSpeed, PlaybackState, AudioPlayerConfig, AudioPlayerControls } from '@/types/audio';

/** Height of each transcript segment row */
const SEGMENT_HEIGHT = 48;
/** Number of extra items to render above/below viewport */
const OVERSCAN = 5;
/** Viewport height for transcript */
const VIEWPORT_HEIGHT = 200;

/**
 * Format segment timestamp for display
 */
function formatSegmentTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Virtualized Transcript View
 * Only renders visible segments + overscan buffer for performance
 */
function VirtualizedTranscriptView({
  segments,
  currentSegmentIndex,
  isPlaying,
  onSegmentClick,
}: {
  segments: TranscriptSegment[];
  currentSegmentIndex: number;
  isPlaying: boolean;
  onSegmentClick: (index: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [isUserScrolling, setIsUserScrolling] = useState(false);
  const userScrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Calculate which items are visible
  const { startIndex, endIndex, offsetY } = useMemo(() => {
    const start = Math.max(0, Math.floor(scrollTop / SEGMENT_HEIGHT) - OVERSCAN);
    const visibleCount = Math.ceil(VIEWPORT_HEIGHT / SEGMENT_HEIGHT);
    const end = Math.min(segments.length - 1, start + visibleCount + OVERSCAN * 2);
    return {
      startIndex: start,
      endIndex: end,
      offsetY: start * SEGMENT_HEIGHT,
    };
  }, [scrollTop, segments.length]);

  // Auto-scroll to active segment during playback
  useEffect(() => {
    if (isPlaying && !isUserScrolling && currentSegmentIndex >= 0 && containerRef.current) {
      const targetScrollTop = currentSegmentIndex * SEGMENT_HEIGHT - VIEWPORT_HEIGHT / 2 + SEGMENT_HEIGHT / 2;
      containerRef.current.scrollTop = Math.max(0, targetScrollTop);
    }
  }, [currentSegmentIndex, isPlaying, isUserScrolling]);

  // Handle scroll events
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);

    // Mark as user scrolling and reset timeout
    setIsUserScrolling(true);
    if (userScrollTimeoutRef.current) {
      clearTimeout(userScrollTimeoutRef.current);
    }
    userScrollTimeoutRef.current = setTimeout(() => {
      setIsUserScrolling(false);
    }, 2000); // Resume auto-scroll after 2s
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (userScrollTimeoutRef.current) {
        clearTimeout(userScrollTimeoutRef.current);
      }
    };
  }, []);

  // Total height for scrollbar
  const totalHeight = segments.length * SEGMENT_HEIGHT;

  // Visible segments
  const visibleSegments = segments.slice(startIndex, endIndex + 1);

  return (
    <Paper
      withBorder
      p={0}
      style={{
        backgroundColor: 'var(--mantine-color-default)',
        overflow: 'hidden',
      }}
    >
      <Box p="xs" style={{ borderBottom: '1px solid var(--mantine-color-default-border)' }}>
        <Group justify="space-between">
          <Text size="xs" fw={600} c="dimmed" tt="uppercase">
            Live Transcript
          </Text>
          <Text size="xs" c="dimmed">
            {segments.length} segments
          </Text>
        </Group>
      </Box>

      {/* Virtualized scroll container */}
      <Box
        ref={containerRef}
        onScroll={handleScroll}
        style={{
          height: VIEWPORT_HEIGHT,
          overflowY: 'auto',
          overflowX: 'hidden',
          position: 'relative',
        }}
        className="transcript-scroll-container"
      >
        {/* Spacer to create full scrollable height */}
        <Box style={{ height: totalHeight, position: 'relative' }}>
          {/* Positioned container for visible items */}
          <Box
            style={{
              position: 'absolute',
              top: offsetY,
              left: 0,
              right: 0,
            }}
          >
            {visibleSegments.map((segment, i) => {
              const idx = startIndex + i;
              const isActive = idx === currentSegmentIndex;
              return (
                <Box
                  key={segment.index}
                  onClick={() => onSegmentClick(idx)}
                  px="sm"
                  py="xs"
                  style={{
                    height: SEGMENT_HEIGHT,
                    cursor: 'pointer',
                    borderRadius: 'var(--mantine-radius-sm)',
                    backgroundColor: isActive
                      ? 'var(--mantine-color-blue-light)'
                      : 'transparent',
                    borderLeft: isActive
                      ? '3px solid var(--mantine-color-blue-filled)'
                      : '3px solid transparent',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                  className="transcript-segment-mini"
                >
                  <Text
                    size="xs"
                    c={isActive ? 'blue' : 'dimmed'}
                    ff="monospace"
                    style={{ flexShrink: 0, width: 45 }}
                  >
                    [{formatSegmentTimestamp(segment.start)}]
                  </Text>
                  <Text
                    size="sm"
                    fw={isActive ? 500 : 400}
                    lineClamp={1}
                    style={{
                      flex: 1,
                      color: isActive
                        ? 'var(--mantine-color-blue-filled)'
                        : 'var(--mantine-color-text)',
                    }}
                  >
                    {segment.text}
                  </Text>
                </Box>
              );
            })}
          </Box>
        </Box>
      </Box>
    </Paper>
  );
}

/**
 * Props for RadioPlaybackInterface component
 */
interface RadioPlaybackInterfaceProps {
  /** Audio source URL (ObjectURL from Blob) */
  audioUrl: string;

  /** Transcript segments for synchronization */
  segments: TranscriptSegment[];

  /** Cache key for waveform peaks (e.g., transcript ID) */
  cacheKey?: string;

  /** Total duration in seconds */
  duration?: number;

  /** Total word count */
  wordCount?: number;

  /** File size in bytes */
  fileSize?: number;

  /** Callback when active segment changes */
  onSegmentChange?: (segment: TranscriptSegment | null, index: number) => void;

  /** Callback to receive audio controls */
  onControlsReady?: (controls: AudioPlayerControls) => void;

  /** Custom configuration */
  config?: Partial<AudioPlayerConfig>;

  /** Additional CSS classes */
  className?: string;

  /** Callback when Review Mode button is clicked */
  onReviewModeClick?: () => void;
}

/**
 * Speed button options
 */
const SPEED_OPTIONS: PlaybackSpeed[] = [0.5, 0.75, 1, 1.25, 1.5, 2];

/**
 * RadioPlaybackInterface Component
 *
 * Radio-optimized audio player with:
 * - Large waveform (120px height) for easy scrubbing
 * - Scrolling transcript mini-view with visible scroll thumb
 * - Speed buttons for quick access
 * - Inline metadata (duration, word count, file size)
 *
 * @param props - Component props
 */
export function RadioPlaybackInterface({
  audioUrl,
  segments,
  cacheKey,
  duration: propDuration,
  wordCount = 0,
  fileSize = 0,
  onSegmentChange,
  onControlsReady,
  config,
  className = '',
  onReviewModeClick,
}: RadioPlaybackInterfaceProps) {
  // Track retry state (used only for the error recovery UI)
  const [isRetrying, setIsRetrying] = useState(false);
  const [waveformInstanceKey, setWaveformInstanceKey] = useState(0);

  const handlePlaybackStateChange = useCallback((nextState: PlaybackState) => {
    if (nextState !== 'loading') {
      setIsRetrying(false);
    }
  }, []);

  const handleWaveformError = useCallback(() => {
    setIsRetrying(false);
  }, []);

  // Use audio sync hook with enhancement support
  const { syncState, controls, registerWaveSurfer, enhancement } = useAudioSync({
    segments,
    onSegmentChange,
    onPlaybackStateChange: handlePlaybackStateChange,
  });

  // Audio controls modal state
  const [audioControlsOpened, { open: openAudioControls, close: closeAudioControls }] = useDisclosure(false);

  // Derive states
  const hasError = syncState.state === 'error';
  const { currentTime, duration: syncDuration, state, speed, volume, muted } = syncState;
  const duration = propDuration || syncDuration;
  const isPlaying = state === 'playing';
  const isLoading = state === 'loading';
  const isBuffering = state === 'buffering';

  // Derive retry display state: show retrying only while there's still an error
  const showRetrying = isRetrying && hasError;

  // Find current segment index based on playback time
  const currentSegmentIndex = useMemo(() => {
    if (!segments.length) return -1;
    for (let i = segments.length - 1; i >= 0; i--) {
      if (segments[i].start <= currentTime) {
        return i;
      }
    }
    return 0;
  }, [segments, currentTime]);

  // Expose controls to parent component
  useEffect(() => {
    if (onControlsReady) {
      onControlsReady(controls);
    }
  }, [controls, onControlsReady]);

  // Handle keyboard shortcuts
  useEffect(() => {
    if (config?.enableKeyboardShortcuts === false) return;

    const handleKeyPress = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      switch (e.key.toLowerCase()) {
        case ' ':
          e.preventDefault();
          controls.togglePlayPause();
          break;
        case 'arrowleft':
          e.preventDefault();
          controls.skipBackward(5);
          break;
        case 'arrowright':
          e.preventDefault();
          controls.skipForward(5);
          break;
        case 'm':
          e.preventDefault();
          controls.toggleMute();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [controls, config?.enableKeyboardShortcuts]);

  // Handle retry
  const handleRetry = useCallback(() => {
    setIsRetrying(true);
    setWaveformInstanceKey((prev) => prev + 1);
  }, []);

  // Handle segment click in mini transcript
  const handleSegmentClick = useCallback(
    (index: number) => {
      const segment = segments[index];
      if (segment) {
        controls.seek(segment.start);
        controls.jumpToSegment(index);
      }
    },
    [segments, controls]
  );

  // Skip to next transmission (1 second before next segment starts)
  const skipToNextTransmission = useCallback(() => {
    if (!segments.length) return;

    // Find the next segment that starts after current time
    const nextSegment = segments.find(s => s.start > currentTime + 0.5);
    if (nextSegment) {
      // Jump to 1 second before the transmission, or to the start if < 1s
      const targetTime = Math.max(0, nextSegment.start - 1);
      controls.seek(targetTime);
    }
  }, [segments, currentTime, controls]);

  // Skip to previous transmission (1 second before that segment)
  const skipToPrevTransmission = useCallback(() => {
    if (!segments.length) return;

    // Find the segment we're currently in or just passed
    let targetIndex = -1;
    for (let i = segments.length - 1; i >= 0; i--) {
      if (segments[i].start < currentTime - 1) {
        // Go to the one before this if we're past the start
        targetIndex = Math.max(0, i - 1);
        break;
      }
    }

    if (targetIndex >= 0) {
      const targetTime = Math.max(0, segments[targetIndex].start - 1);
      controls.seek(targetTime);
    } else if (segments[0]) {
      // Go to first segment
      controls.seek(Math.max(0, segments[0].start - 1));
    }
  }, [segments, currentTime, controls]);

  // Waveform config with larger height
  const waveformConfig = useMemo(() => ({
    ...config,
    waveformHeight: 120, // Larger waveform for easier scrubbing
  }), [config]);

  return (
    <Stack gap="md" className={className}>
      {/* Error Recovery UI */}
      {hasError && (
        <Paper
          p="md"
          withBorder
          style={{
            backgroundColor: 'rgba(250, 82, 82, 0.1)',
            borderColor: 'rgba(250, 82, 82, 0.3)',
          }}
        >
          <Group justify="space-between" align="center">
            <Group gap="xs">
              <AlertCircle size={16} style={{ color: 'var(--mantine-color-red-6)', flexShrink: 0 }} />
              <Text size="sm" style={{ color: 'var(--mantine-color-red-6)' }}>
                Audio failed to load. Please check your file or try again.
              </Text>
            </Group>
            <Button
              variant="default"
              size="sm"
              onClick={handleRetry}
              disabled={showRetrying}
              leftSection={showRetrying ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            >
              {showRetrying ? 'Retrying...' : 'Retry'}
            </Button>
          </Group>
        </Paper>
      )}

      {/* Large Waveform */}
      <Box style={{ width: '100%' }}>
        <WaveformPlayer
          key={waveformInstanceKey}
          audioUrl={audioUrl}
          cacheKey={cacheKey}
          config={waveformConfig}
          onReady={registerWaveSurfer}
          onError={handleWaveformError}
          className="w-full"
        />
      </Box>

      {/* Playback Controls Row */}
      <Group gap="md" align="center" justify="space-between" wrap="wrap">
        {/* Left: Play controls */}
        <Group gap="xs">
          {/* Skip to previous transmission */}
          <Tooltip label="Previous transmission" withArrow>
            <ActionIcon
              variant="light"
              color="blue"
              size="lg"
              onClick={skipToPrevTransmission}
              disabled={isLoading || !segments.length}
              aria-label="Skip to previous transmission"
            >
              <Rewind size={16} />
            </ActionIcon>
          </Tooltip>

          <ActionIcon
            variant="default"
            size="lg"
            onClick={() => controls.skipBackward(10)}
            disabled={isLoading}
            title="Skip backward 10s (←)"
            aria-label="Skip backward 10 seconds"
          >
            <SkipBack size={18} />
          </ActionIcon>

          <ActionIcon
            variant="filled"
            size="xl"
            onClick={controls.togglePlayPause}
            disabled={isLoading || hasError}
            title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
            aria-label={isPlaying ? 'Pause audio' : 'Play audio'}
            style={{ width: 56, height: 56 }}
          >
            {isLoading || isBuffering ? (
              <Loader2 size={24} className="animate-spin" />
            ) : isPlaying ? (
              <Pause size={24} />
            ) : (
              <Play size={24} />
            )}
          </ActionIcon>

          <ActionIcon
            variant="default"
            size="lg"
            onClick={() => controls.skipForward(10)}
            disabled={isLoading}
            title="Skip forward 10s (→)"
            aria-label="Skip forward 10 seconds"
          >
            <SkipForward size={18} />
          </ActionIcon>

          {/* Skip to next transmission */}
          <Tooltip label="Next transmission" withArrow>
            <ActionIcon
              variant="light"
              color="blue"
              size="lg"
              onClick={skipToNextTransmission}
              disabled={isLoading || !segments.length}
              aria-label="Skip to next transmission"
            >
              <FastForward size={16} />
            </ActionIcon>
          </Tooltip>

          {/* Time display */}
          <Text size="sm" c="dimmed" ff="monospace" ml="xs">
            {formatTimestamp(currentTime)} / {formatTimestamp(duration)}
          </Text>
        </Group>

        {/* Center: Speed buttons */}
        <SegmentedControl
          value={speed.toString()}
          onChange={(val) => controls.setSpeed(parseFloat(val) as PlaybackSpeed)}
          data={SPEED_OPTIONS.map((s) => ({
            value: s.toString(),
            label: `${s}x`,
          }))}
          size="xs"
          disabled={isLoading}
        />

        {/* Right: Volume and Settings */}
        <Group gap="xs">
          <Tooltip label={muted ? 'Unmute (M)' : 'Mute (M)'}>
            <ActionIcon
              variant="subtle"
              size="md"
              onClick={controls.toggleMute}
              aria-label={muted ? 'Unmute audio' : 'Mute audio'}
            >
              {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </ActionIcon>
          </Tooltip>
          <Slider
            value={muted ? 0 : volume}
            onChange={controls.setVolume}
            max={1}
            step={0.01}
            style={{ width: 80 }}
            disabled={isLoading}
            aria-label={`Volume: ${Math.round(volume * 100)}%`}
          />

          {/* Audio Controls Button */}
          <Tooltip label="Audio Controls">
            <ActionIcon
              variant={enhancement.highPassEnabled || enhancement.compressorEnabled || enhancement.volumeBoost > 1 ? 'filled' : 'light'}
              color={enhancement.highPassEnabled || enhancement.compressorEnabled || enhancement.volumeBoost > 1 ? 'blue' : 'gray'}
              size="md"
              onClick={openAudioControls}
              aria-label="Open audio controls"
            >
              <Settings size={16} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>

      {/* Review Mode Button - Large touch target for iPad */}
      {onReviewModeClick && (
        <Group justify="flex-end">
          <Button
            variant="light"
            color="orange"
            size="lg"
            leftSection={<Presentation size={20} />}
            onClick={onReviewModeClick}
            styles={{
              root: {
                minHeight: 48,
                paddingLeft: 20,
                paddingRight: 24,
              },
            }}
          >
            Review Mode
          </Button>
        </Group>
      )}

      {/* Audio Controls Modal */}
      <AudioControlsModal
        opened={audioControlsOpened}
        onClose={closeAudioControls}
        enhancement={enhancement}
        controls={controls}
      />

      {/* Metadata Row */}
      <Group gap="lg" c="dimmed">
        <Group gap={6}>
          <Clock size={14} />
          <Text size="sm">{formatDuration(duration)}</Text>
        </Group>
        <Group gap={6}>
          <FileText size={14} />
          <Text size="sm">{wordCount.toLocaleString()} words</Text>
        </Group>
        <Group gap={6}>
          <HardDrive size={14} />
          <Text size="sm">{formatFileSize(fileSize)}</Text>
        </Group>
      </Group>

      {/* Virtualized Transcript Mini-View */}
      {segments.length > 0 && (
        <VirtualizedTranscriptView
          segments={segments}
          currentSegmentIndex={currentSegmentIndex}
          isPlaying={isPlaying}
          onSegmentClick={handleSegmentClick}
        />
      )}

      {/* Keyboard shortcuts hint */}
      {config?.enableKeyboardShortcuts !== false && (
        <Text size="xs" c="dimmed">
          <Text component="span" fw={500}>Shortcuts:</Text>{' '}
          Space (play/pause), ← (back 5s), → (forward 5s), M (mute)
        </Text>
      )}

      {/* Styles for hover effects and scrollbar */}
      <style jsx global>{`
        .transcript-segment-mini:hover {
          background-color: var(--mantine-color-gray-1) !important;
        }
        [data-mantine-color-scheme='dark'] .transcript-segment-mini:hover {
          background-color: var(--mantine-color-dark-5) !important;
        }
        .transcript-scroll-container {
          scrollbar-width: thin;
          scrollbar-color: var(--mantine-color-gray-5) var(--mantine-color-gray-2);
        }
        .transcript-scroll-container::-webkit-scrollbar {
          width: 10px;
        }
        .transcript-scroll-container::-webkit-scrollbar-track {
          background: var(--mantine-color-gray-2);
          border-radius: 5px;
        }
        .transcript-scroll-container::-webkit-scrollbar-thumb {
          background: var(--mantine-color-gray-5);
          border-radius: 5px;
        }
        .transcript-scroll-container::-webkit-scrollbar-thumb:hover {
          background: var(--mantine-color-gray-6);
        }
        [data-mantine-color-scheme='dark'] .transcript-scroll-container {
          scrollbar-color: var(--mantine-color-dark-3) var(--mantine-color-dark-5);
        }
        [data-mantine-color-scheme='dark'] .transcript-scroll-container::-webkit-scrollbar-track {
          background: var(--mantine-color-dark-5);
        }
        [data-mantine-color-scheme='dark'] .transcript-scroll-container::-webkit-scrollbar-thumb {
          background: var(--mantine-color-dark-3);
        }
        [data-mantine-color-scheme='dark'] .transcript-scroll-container::-webkit-scrollbar-thumb:hover {
          background: var(--mantine-color-dark-2);
        }
      `}</style>
    </Stack>
  );
}

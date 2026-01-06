/**
 * AudioPlayer Component
 *
 * Complete audio player with waveform visualization, playback controls,
 * timeline, volume control, and speed adjustment. Integrates with
 * transcript segments for synchronized playback.
 */

'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Settings,
  Loader2,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { Button, Slider, Menu, Stack, Flex, Group, Text, Paper, Box } from '@mantine/core';
import { WaveformPlayer } from './waveform-player';
import { useAudioSync } from '@/hooks/use-audio-sync';
import { formatTimestamp } from '@/lib/transcript-utils';
import type { TranscriptSegment } from '@/types/transcript';
import type { PlaybackSpeed, PlaybackState, AudioPlayerConfig, AudioPlayerControls } from '@/types/audio';

/**
 * Props for AudioPlayer component
 */
interface AudioPlayerProps {
  /** Audio source URL (ObjectURL from Blob) */
  audioUrl: string;

  /** Transcript segments for synchronization */
  segments: TranscriptSegment[];

  /** Callback when active segment changes */
  onSegmentChange?: (segment: TranscriptSegment | null, index: number) => void;

  /** Callback to receive audio controls */
  onControlsReady?: (controls: AudioPlayerControls) => void;

  /** Custom configuration */
  config?: Partial<AudioPlayerConfig>;

  /** Additional CSS classes */
  className?: string;
}

/**
 * Available playback speeds
 */
const PLAYBACK_SPEEDS: PlaybackSpeed[] = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

/**
 * AudioPlayer Component
 *
 * Full-featured audio player with:
 * - Waveform visualization
 * - Play/pause controls
 * - Seek functionality (click waveform or use skip buttons)
 * - Volume control with mute
 * - Playback speed adjustment (0.5x to 2x)
 * - Time display (current / total)
 * - Keyboard shortcuts
 * - Transcript segment synchronization
 *
 * @param props - Component props
 */
export function AudioPlayer({
  audioUrl,
  segments,
  onSegmentChange,
  onControlsReady,
  config,
  className = '',
}: AudioPlayerProps) {
  const [waveformInstanceKey, setWaveformInstanceKey] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);

  const handlePlaybackStateChange = useCallback((nextState: PlaybackState) => {
    if (nextState !== 'loading') {
      setIsRetrying(false);
    }
  }, []);

  // Use audio sync hook
  const { syncState, controls, registerWaveSurfer } = useAudioSync({
    segments,
    onSegmentChange,
    onPlaybackStateChange: handlePlaybackStateChange,
  });

  // Derive error state from syncState to avoid setState in effect
  const hasError = syncState.state === 'error';

  // Expose controls to parent component
  useEffect(() => {
    if (onControlsReady) {
      onControlsReady(controls);
    }
  }, [controls, onControlsReady]);

  /**
   * Handle keyboard shortcuts
   */
  useEffect(() => {
    if (config?.enableKeyboardShortcuts === false) return;

    const handleKeyPress = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
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

  /**
   * Handle speed change
   */
  const handleSpeedChange = useCallback(
    (speed: PlaybackSpeed) => {
      controls.setSpeed(speed);
    },
    [controls]
  );

  const { currentTime, duration, state, speed, volume, muted } = syncState;
  const isPlaying = state === 'playing';
  const isLoading = state === 'loading';
  const isBuffering = state === 'buffering';
  const showRetrying = isRetrying && hasError;

  const handleWaveformError = useCallback(() => {
    setIsRetrying(false);
  }, []);

  /**
   * Handle retry after error
   */
  const handleRetry = useCallback(() => {
    setIsRetrying(true);
    setWaveformInstanceKey((prev) => prev + 1);
  }, []);

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
          <Flex justify="space-between" align="center">
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
          </Flex>
        </Paper>
      )}

      {/* Waveform */}
      <Box style={{ width: '100%' }}>
        <WaveformPlayer
          key={waveformInstanceKey}
          audioUrl={audioUrl}
          config={config}
          onReady={registerWaveSurfer}
          onError={handleWaveformError}
          className="w-full"
        />
      </Box>

      {/* Controls */}
      <Flex gap="md" align="center" role="group" aria-label="Audio player controls">
        {/* Playback controls */}
        <Group gap="xs">
          <Button
            variant="default"
            size="md"
            onClick={() => controls.skipBackward(10)}
            disabled={isLoading}
            title="Skip backward 10s (←)"
            aria-label="Skip backward 10 seconds"
          >
            <SkipBack size={16} aria-hidden="true" />
          </Button>

          <Button
            variant="filled"
            size="md"
            onClick={controls.togglePlayPause}
            disabled={isLoading || hasError}
            title={
              isLoading || isBuffering
                ? 'Loading...'
                : isPlaying
                ? 'Pause (Space)'
                : 'Play (Space)'
            }
            aria-label={
              isLoading || isBuffering
                ? 'Audio loading'
                : isPlaying
                ? 'Pause audio'
                : 'Play audio'
            }
            aria-pressed={isPlaying}
          >
            {isLoading || isBuffering ? (
              <Loader2 size={20} className="animate-spin" aria-hidden="true" />
            ) : isPlaying ? (
              <Pause size={20} aria-hidden="true" />
            ) : (
              <Play size={20} aria-hidden="true" />
            )}
          </Button>

          <Button
            variant="default"
            size="md"
            onClick={() => controls.skipForward(10)}
            disabled={isLoading}
            title="Skip forward 10s (→)"
            aria-label="Skip forward 10 seconds"
          >
            <SkipForward size={16} aria-hidden="true" />
          </Button>
        </Group>

        {/* Time display */}
        <Group
          gap={4}
          style={{ minWidth: 120 }}
          role="timer"
          aria-live="off"
          aria-label={`Current time: ${formatTimestamp(currentTime)} of ${formatTimestamp(duration)}`}
        >
          <Text size="sm" c="dimmed" ff="monospace" aria-hidden="true">
            {formatTimestamp(currentTime)}
          </Text>
          <Text size="sm" c="dimmed" ff="monospace" aria-hidden="true">
            /
          </Text>
          <Text size="sm" c="dimmed" ff="monospace" aria-hidden="true">
            {formatTimestamp(duration)}
          </Text>
        </Group>

        {/* Buffering indicator */}
        {isBuffering && (
          <Group gap="xs" style={{ opacity: 0.8 }}>
            <Loader2 size={12} className="animate-spin" />
            <Text size="xs" c="dimmed">
              Buffering...
            </Text>
          </Group>
        )}

        {/* Volume control */}
        {config?.showVolumeControl !== false && (
          <Group gap="xs" style={{ minWidth: 120 }} role="group" aria-label="Volume control">
            <Button
              variant="subtle"
              size="sm"
              onClick={controls.toggleMute}
              title={muted ? 'Unmute (M)' : 'Mute (M)'}
              aria-label={muted ? 'Unmute audio' : 'Mute audio'}
              aria-pressed={muted}
            >
              <Box style={{ position: 'relative', width: 16, height: 16 }}>
                <VolumeX
                  size={16}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    transition: 'all 200ms',
                    opacity: muted ? 1 : 0,
                    transform: muted ? 'scale(1)' : 'scale(0.75)',
                  }}
                  aria-hidden="true"
                />
                <Volume2
                  size={16}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    transition: 'all 200ms',
                    opacity: muted ? 0 : 1,
                    transform: muted ? 'scale(0.75)' : 'scale(1)',
                  }}
                  aria-hidden="true"
                />
              </Box>
            </Button>
            <Slider
              value={muted ? 0 : volume}
              onChange={controls.setVolume}
              max={1}
              step={0.01}
              style={{ width: 80 }}
              disabled={isLoading}
              aria-label={`Volume: ${Math.round(volume * 100)}%`}
            />
          </Group>
        )}

        {/* Speed control */}
        {config?.showSpeedControl !== false && (
          <Menu position="bottom-end">
            <Menu.Target>
              <Button
                variant="default"
                size="sm"
                disabled={isLoading}
                aria-label={`Playback speed: ${speed}x. Click to change speed`}
                leftSection={<Settings size={16} aria-hidden="true" />}
              >
                {speed}x
              </Button>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Label>Playback Speed</Menu.Label>
              <Menu.Divider />
              {PLAYBACK_SPEEDS.map((s) => (
                <Menu.Item
                  key={s}
                  onClick={() => handleSpeedChange(s)}
                  style={{ backgroundColor: s === speed ? 'var(--mantine-color-gray-1)' : undefined }}
                >
                  {s}x {s === 1 && '(Normal)'}
                </Menu.Item>
              ))}
            </Menu.Dropdown>
          </Menu>
        )}
      </Flex>

      {/* Keyboard shortcuts hint */}
      {config?.enableKeyboardShortcuts !== false && (
        <Text size="xs" c="dimmed">
          <Text component="span" fw={500}>
            Shortcuts:
          </Text>{' '}
          Space (play/pause), ← (back 5s), → (forward 5s), M (mute)
        </Text>
      )}
    </Stack>
  );
}

/**
 * WaveformPlayer Component
 *
 * Core wavesurfer.js integration component that handles waveform visualization
 * and audio playback. This is a low-level component that manages the WaveSurfer
 * instance lifecycle.
 */

'use client';

import React, { useEffect, useRef, useCallback, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';
import { Loader2, AlertCircle } from 'lucide-react';
import { Alert, Box, Flex, useMantineColorScheme } from '@mantine/core';
import { DEFAULT_AUDIO_CONFIG } from '@/types/audio';
import type { AudioPlayerConfig } from '@/types/audio';

function isAbortError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const name = (error as { name?: string }).name;
  return name === 'AbortError';
}

async function safelyDestroy(instance: WaveSurfer | null): Promise<void> {
  if (!instance) return;

  try {
    await Promise.resolve(instance.destroy());
  } catch (err) {
    if (!isAbortError(err)) {
      console.error('Error destroying WaveSurfer:', err);
    }
  }

  try {
    if (typeof instance.unAll === 'function') {
      instance.unAll();
    }
  } catch (cleanupError) {
    console.error('Error cleaning WaveSurfer listeners:', cleanupError);
  }
}

/**
 * Props for WaveformPlayer component
 */
interface WaveformPlayerProps {
  /** Audio source URL (ObjectURL from Blob) */
  audioUrl: string;

  /** Configuration for waveform appearance and behavior */
  config?: Partial<AudioPlayerConfig>;

  /** Callback when WaveSurfer instance is ready */
  onReady?: (wavesurfer: WaveSurfer) => void;

  /** Callback when audio loading fails */
  onError?: (error: Error) => void;

  /** Additional CSS classes */
  className?: string;
}

/**
 * WaveformPlayer Component
 *
 * Renders an audio waveform using wavesurfer.js and provides
 * a reference to the WaveSurfer instance for external control.
 *
 * Features:
 * - Waveform visualization with customizable colors
 * - Responsive container
 * - Loading and error states
 * - Automatic cleanup on unmount
 * - Click to seek functionality
 *
 * @param props - Component props
 */
export function WaveformPlayer({
  audioUrl,
  config,
  onReady,
  onError,
  className = '',
}: WaveformPlayerProps) {
  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const destroyPromiseRef = useRef<Promise<void> | null>(null);

  // State
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { colorScheme } = useMantineColorScheme();

  /**
   * Initializes WaveSurfer instance
   * RACE CONDITION FIX: Added cancellation support and proper async handling
   */
  const initializeWaveSurfer = useCallback(
    async (cancelledRef?: { current: boolean }) => {
      if (!containerRef.current || !audioUrl) {
        return;
      }

      try {
        if (destroyPromiseRef.current) {
          await destroyPromiseRef.current.catch((err) => {
            if (!isAbortError(err)) {
              console.error('WaveSurfer teardown error:', err);
            }
          });
          destroyPromiseRef.current = null;
        }

        if (wavesurferRef.current) {
          await safelyDestroy(wavesurferRef.current);
          wavesurferRef.current = null;
        }

        if (cancelledRef?.current || !containerRef.current) {
          return;
        }

        const isDarkMode = document.documentElement.classList.contains('dark');
        const defaultWaveColor = isDarkMode ? '#4B5563' : '#9CA3AF';
        const defaultProgressColor = isDarkMode ? '#60A5FA' : '#3B82F6';

        const wavesurfer = WaveSurfer.create({
          container: containerRef.current,
          waveColor: config?.waveColor ?? defaultWaveColor,
          progressColor: config?.progressColor ?? defaultProgressColor,
          cursorColor: config?.progressColor ?? defaultProgressColor,
          barWidth: typeof config?.barWidth === 'number' ? config.barWidth : DEFAULT_AUDIO_CONFIG.barWidth,
          barRadius: typeof config?.barRadius === 'number' ? config.barRadius : DEFAULT_AUDIO_CONFIG.barRadius,
          cursorWidth: typeof config?.cursorWidth === 'number' ? config.cursorWidth : DEFAULT_AUDIO_CONFIG.cursorWidth,
          height: typeof config?.waveformHeight === 'number' ? config.waveformHeight : DEFAULT_AUDIO_CONFIG.waveformHeight,
          barGap: typeof config?.barGap === 'number' ? config.barGap : DEFAULT_AUDIO_CONFIG.barGap,
          normalize: true,
          backend: 'WebAudio',
          mediaControls: false,
          interact: true,
        });

        if (cancelledRef?.current) {
          await safelyDestroy(wavesurfer);
          return;
        }

        wavesurferRef.current = wavesurfer;

        wavesurfer.on('ready', () => {
          if (cancelledRef?.current) {
            void safelyDestroy(wavesurfer);
            return;
          }

          setIsLoading(false);
          setError(null);
          onReady?.(wavesurfer);
        });

        wavesurfer.on('error', (err: Error) => {
          if (!cancelledRef?.current) {
            console.error('WaveSurfer error:', err);
            setError(err);
            setIsLoading(false);
            onError?.(err);
          }
        });

        wavesurfer.on('loading', () => {
          if (!cancelledRef?.current) {
            setIsLoading(true);
          }
        });

        if (!cancelledRef?.current) {
          try {
            const maybePromise = wavesurfer.load(audioUrl);
            if (maybePromise && typeof (maybePromise as Promise<unknown>).then === 'function') {
              destroyPromiseRef.current = (maybePromise as Promise<unknown>)
                .then(() => undefined)
                .catch((err: unknown) => {
                  if (!isAbortError(err)) {
                    console.error('Failed to load audio URL:', err);
                  }
                });
            } else {
              destroyPromiseRef.current = Promise.resolve();
            }
          } catch (err) {
            if (!isAbortError(err)) {
              console.error('Failed to load audio URL:', err);
            }
          }
        } else {
          void safelyDestroy(wavesurfer);
        }
      } catch (err) {
        if (!isAbortError(err)) {
          console.error('WaveSurfer init error:', err);
        }
      }
    },
    [audioUrl, config, onReady, onError]
  );

  /**
   * Initialize on mount and when audioUrl changes.
   * Uses a cancellation flag to prevent state updates after unmount.
   */
  useEffect(() => {
    const cancelledRef = { current: false };

    // Initialize with cancellation support
    initializeWaveSurfer(cancelledRef);

    // Cleanup on unmount or when audioUrl changes
    return () => {
      cancelledRef.current = true;
      const instance = wavesurferRef.current;
      wavesurferRef.current = null;

      if (instance) {
        destroyPromiseRef.current = Promise.resolve().then(() => safelyDestroy(instance));
      }
    };
  }, [initializeWaveSurfer]);

  /**
   * Re-initialize when theme changes
   */
  useEffect(() => {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'class') {
          // Theme changed, re-initialize to update colors
          if (wavesurferRef.current && !isLoading && !error) {
            initializeWaveSurfer();
          }
        }
      });
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => observer.disconnect();
  }, [initializeWaveSurfer, isLoading, error]);

  // Error state
  if (error) {
    return (
      <Box className={className}>
        <Alert
          icon={<AlertCircle size={16} />}
          color="red"
          title="Failed to load audio"
        >
          {error.message}
        </Alert>
      </Box>
    );
  }

  return (
    <Box className={className}>
      {/* Waveform container */}
      <Box pos="relative">
        <Box
          ref={containerRef}
          w="100%"
          style={{
            borderRadius: 'var(--mantine-radius-md)',
            overflow: 'hidden',
            backgroundColor: 'var(--mantine-color-default)',
            minHeight: config?.waveformHeight || 80,
          }}
        />

        {/* Loading overlay - only covers waveform area */}
        {isLoading && (
          <Box
            pos="absolute"
            top={0}
            left={0}
            right={0}
            bottom={0}
            style={{
              backgroundColor: colorScheme === 'dark' ? 'rgba(26, 27, 30, 0.8)' : 'rgba(255, 255, 255, 0.8)',
              backdropFilter: 'blur(4px)',
              borderRadius: 'var(--mantine-radius-md)',
            }}
          >
            <Flex
              align="center"
              justify="center"
              h="100%"
              gap="xs"
              c="dimmed"
              style={{ fontSize: 'var(--mantine-font-size-sm)' }}
            >
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Loading audio...</span>
            </Flex>
          </Box>
        )}
      </Box>
    </Box>
  );
}

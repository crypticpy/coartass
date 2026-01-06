/**
 * WaveformPlayer Component
 *
 * DAW-style wavesurfer.js integration with:
 * - Scrolling waveform with auto-center playhead
 * - Zoom controls (30s, 1m, 5m, full)
 * - Visible scrollbar for manual navigation
 * - Click to seek anywhere on the waveform
 */

'use client';

import React, { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import WaveSurfer from 'wavesurfer.js';
import { Loader2, AlertCircle, ZoomIn, ZoomOut } from 'lucide-react';
import { Alert, Box, Flex, useMantineColorScheme, Group, SegmentedControl, Text } from '@mantine/core';
import { DEFAULT_AUDIO_CONFIG } from '@/types/audio';
import type { AudioPlayerConfig, ZoomLevel } from '@/types/audio';

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
 * Calculate pixels per second for a given zoom level and container width
 */
function calculatePxPerSec(zoomLevel: ZoomLevel, containerWidth: number, duration: number): number {
  switch (zoomLevel) {
    case '30s':
      return containerWidth / 30; // 30 seconds visible
    case '1m':
      return containerWidth / 60; // 1 minute visible
    case '5m':
      return containerWidth / 300; // 5 minutes visible
    case 'full':
    default:
      return containerWidth / Math.max(duration, 1); // Full audio visible
  }
}

/**
 * Props for WaveformPlayer component
 */
interface WaveformPlayerProps {
  /** Audio source URL (ObjectURL from Blob) */
  audioUrl: string;

  /** Unique ID for caching peaks (e.g., transcript ID) */
  cacheKey?: string;

  /** Configuration for waveform appearance and behavior */
  config?: Partial<AudioPlayerConfig>;

  /** Callback when WaveSurfer instance is created (before load completes) */
  onReady?: (wavesurfer: WaveSurfer) => void;

  /** Callback when audio loading fails */
  onError?: (error: Error) => void;

  /** Enable zoom controls */
  showZoomControls?: boolean;

  /** Additional CSS classes */
  className?: string;
}

// IndexedDB cache for waveform peaks
const PEAKS_DB_NAME = 'waveform-peaks-cache';
const PEAKS_STORE_NAME = 'peaks';
const PEAKS_CACHE_MAX_ENTRIES = 50;
const PEAKS_CACHE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

type PeaksCacheRecordV2 = {
  peaks: number[][];
  storedAt: number;
};

function isPeaksCacheRecord(value: unknown): value is PeaksCacheRecordV2 {
  if (!value || typeof value !== 'object') return false;
  const maybe = value as Partial<PeaksCacheRecordV2>;
  return Array.isArray(maybe.peaks) && typeof maybe.storedAt === 'number';
}

async function prunePeaksCache(db: IDBDatabase): Promise<void> {
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(PEAKS_STORE_NAME, 'readwrite');
      const store = tx.objectStore(PEAKS_STORE_NAME);
      const entries: Array<{ key: IDBValidKey; storedAt: number }> = [];

      const cursorRequest = store.openCursor();
      cursorRequest.onsuccess = () => {
        const cursor = cursorRequest.result;
        if (cursor) {
          const value = cursor.value as unknown;
          const storedAt =
            isPeaksCacheRecord(value) ? value.storedAt : 0;
          entries.push({ key: cursor.key, storedAt });
          cursor.continue();
          return;
        }

        const now = Date.now();
        const keysToDelete = new Set<IDBValidKey>();

        for (const entry of entries) {
          if (entry.storedAt > 0 && now - entry.storedAt > PEAKS_CACHE_MAX_AGE_MS) {
            keysToDelete.add(entry.key);
          }
        }

        const newestFirst = [...entries].sort((a, b) => b.storedAt - a.storedAt);
        for (const entry of newestFirst.slice(PEAKS_CACHE_MAX_ENTRIES)) {
          keysToDelete.add(entry.key);
        }

        for (const key of keysToDelete) {
          store.delete(key);
        }
      };

      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

async function getCachedPeaks(key: string): Promise<Float32Array[] | null> {
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(PEAKS_DB_NAME, 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore(PEAKS_STORE_NAME);
      };
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction(PEAKS_STORE_NAME, 'readonly');
        const store = tx.objectStore(PEAKS_STORE_NAME);
        const getRequest = store.get(key);
        getRequest.onsuccess = () => {
          const data = getRequest.result;
          if (data && Array.isArray(data)) {
            // Legacy format: number[][]
            resolve((data as number[][]).map((arr) => new Float32Array(arr)));
            return;
          }

          if (isPeaksCacheRecord(data)) {
            resolve(data.peaks.map((arr) => new Float32Array(arr)));
          } else {
            resolve(null);
          }
        };
        getRequest.onerror = () => resolve(null);
      };
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function cachePeaks(key: string, peaks: Float32Array[]): Promise<void> {
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(PEAKS_DB_NAME, 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore(PEAKS_STORE_NAME);
      };
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction(PEAKS_STORE_NAME, 'readwrite');
        const store = tx.objectStore(PEAKS_STORE_NAME);
        // Convert to regular arrays for storage
        const payload: PeaksCacheRecordV2 = {
          peaks: peaks.map((arr) => Array.from(arr)),
          storedAt: Date.now(),
        };
        store.put(payload, key);
        tx.oncomplete = () => {
          void prunePeaksCache(db);
          resolve();
        };
        tx.onerror = () => resolve();
      };
      request.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

/**
 * WaveformPlayer Component
 *
 * DAW-style waveform with scrolling, zoom, and auto-center playhead.
 */
export function WaveformPlayer({
  audioUrl,
  cacheKey,
  config,
  onReady,
  onError,
  showZoomControls = true,
  className = '',
}: WaveformPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const destroyPromiseRef = useRef<Promise<void> | null>(null);
  const cachedPeaksRef = useRef<Float32Array[] | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>('1m');
  const [duration, setDuration] = useState(0);
  const { colorScheme } = useMantineColorScheme();

  // Load cached peaks on mount
  useEffect(() => {
    if (cacheKey) {
      getCachedPeaks(cacheKey).then(peaks => {
        if (peaks) {
          cachedPeaksRef.current = peaks;
        }
      });
    }
  }, [cacheKey]);

  // Merge config with defaults
  const mergedConfig = useMemo(() => ({
    ...DEFAULT_AUDIO_CONFIG,
    ...config,
  }), [config]);

  /**
   * Apply zoom level to wavesurfer
   * Includes error recovery - if zoom fails, the waveform remains usable
   */
  const applyZoom = useCallback((level: ZoomLevel) => {
    if (!wavesurferRef.current || !containerRef.current || duration <= 0) return;

    const containerWidth = containerRef.current.clientWidth;
    if (containerWidth <= 0) {
      // Container not yet rendered or has zero width
      return;
    }

    const pxPerSec = calculatePxPerSec(level, containerWidth, duration);

    // Sanity check: pxPerSec should be positive and reasonable
    if (!Number.isFinite(pxPerSec) || pxPerSec <= 0 || pxPerSec > 10000) {
      console.warn('[WaveformPlayer] Invalid pxPerSec calculated:', pxPerSec);
      return;
    }

    try {
      wavesurferRef.current.zoom(pxPerSec);
    } catch (err) {
      // Zoom can fail if wavesurfer is in a transitional state
      // This is non-fatal - the waveform will still work, just at wrong zoom
      console.warn('[WaveformPlayer] Zoom failed (non-fatal):', err);
    }
  }, [duration]);

  /**
   * Handle zoom level change
   */
  const handleZoomChange = useCallback((level: string) => {
    setZoomLevel(level as ZoomLevel);
    applyZoom(level as ZoomLevel);
  }, [applyZoom]);

  /**
   * Initialize WaveSurfer instance
   */
  const initializeWaveSurfer = useCallback(
    async (cancelledRef?: { current: boolean }) => {
      if (!containerRef.current || !audioUrl) return;

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

        if (cancelledRef?.current || !containerRef.current) return;

        const isDarkMode = document.documentElement.classList.contains('dark') ||
                          document.documentElement.getAttribute('data-mantine-color-scheme') === 'dark';
        const defaultWaveColor = isDarkMode ? '#4B5563' : '#9CA3AF';
        const defaultProgressColor = isDarkMode ? '#60A5FA' : '#3B82F6';
        const cursorColor = isDarkMode ? '#F59E0B' : '#EF4444'; // Bright playhead

        // Get container width for initial zoom calculation
        const containerWidth = containerRef.current.clientWidth;

        // Use cached peaks if available for instant rendering
        const hasCachedPeaks = cachedPeaksRef.current && cachedPeaksRef.current.length > 0;

        const wavesurfer = WaveSurfer.create({
          container: containerRef.current,
          waveColor: mergedConfig.waveColor ?? defaultWaveColor,
          progressColor: mergedConfig.progressColor ?? defaultProgressColor,
          cursorColor: cursorColor,
          cursorWidth: 3, // Thick, visible playhead
          barWidth: mergedConfig.barWidth ?? DEFAULT_AUDIO_CONFIG.barWidth,
          barRadius: mergedConfig.barRadius ?? DEFAULT_AUDIO_CONFIG.barRadius,
          height: mergedConfig.waveformHeight ?? 120,
          barGap: mergedConfig.barGap ?? DEFAULT_AUDIO_CONFIG.barGap,
          normalize: true,
          backend: 'MediaElement', // Use MediaElement for Web Audio API processing support
          mediaControls: false,
          interact: true,
          // DAW-style scrolling
          minPxPerSec: containerWidth / 60, // Default to 1 minute view
          autoScroll: true,
          autoCenter: true,
          hideScrollbar: false, // Show scrollbar for manual navigation
          // Use cached peaks for instant waveform rendering
          ...(hasCachedPeaks ? { peaks: cachedPeaksRef.current! } : {}),
        });

        if (cancelledRef?.current) {
          await safelyDestroy(wavesurfer);
          return;
        }

        wavesurferRef.current = wavesurfer;
        onReady?.(wavesurfer);

        wavesurfer.on('ready', () => {
          if (cancelledRef?.current) {
            void safelyDestroy(wavesurfer);
            return;
          }

          const audioDuration = wavesurfer.getDuration();
          setDuration(audioDuration);
          setIsLoading(false);
          setError(null);

          // Apply initial zoom after duration is known
          const pxPerSec = calculatePxPerSec(zoomLevel, containerWidth, audioDuration);
          wavesurfer.zoom(pxPerSec);

          // Cache peaks for future instant loading (only if we didn't use cached peaks)
          if (cacheKey && !hasCachedPeaks) {
            try {
              const peaks = wavesurfer.exportPeaks();
              if (peaks && peaks.length > 0) {
                // Convert number[][] to Float32Array[] for storage
                const float32Peaks = peaks.map(arr => new Float32Array(arr));
                cachePeaks(cacheKey, float32Peaks).catch((err) => {
                  console.error('Failed to cache waveform peaks:', err);
                });
              }
            } catch (err) {
              console.error('Error exporting peaks:', err);
            }
          }

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
    [audioUrl, cacheKey, mergedConfig, onReady, onError, zoomLevel]
  );

  // Initialize on mount
  useEffect(() => {
    const cancelledRef = { current: false };
    initializeWaveSurfer(cancelledRef);

    return () => {
      cancelledRef.current = true;
      const instance = wavesurferRef.current;
      wavesurferRef.current = null;
      if (instance) {
        destroyPromiseRef.current = Promise.resolve().then(() => safelyDestroy(instance));
      }
    };
  }, [initializeWaveSurfer]);

  // Re-apply zoom when zoom level changes (after duration is known)
  useEffect(() => {
    if (duration > 0) {
      applyZoom(zoomLevel);
    }
  }, [zoomLevel, duration, applyZoom]);

  // Handle window resize with debouncing for performance
  // This prevents excessive zoom recalculations during resize drag
  useEffect(() => {
    let resizeTimeout: NodeJS.Timeout | null = null;

    const handleResize = () => {
      // Clear any pending resize handler
      if (resizeTimeout) {
        clearTimeout(resizeTimeout);
      }

      // Debounce resize handling by 150ms
      resizeTimeout = setTimeout(() => {
        if (duration > 0) {
          applyZoom(zoomLevel);
        }
      }, 150);
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      if (resizeTimeout) {
        clearTimeout(resizeTimeout);
      }
    };
  }, [duration, zoomLevel, applyZoom]);

  if (error) {
    return (
      <Box className={className}>
        <Alert icon={<AlertCircle size={16} />} color="red" title="Failed to load audio">
          {error.message}
        </Alert>
      </Box>
    );
  }

  return (
    <Box className={className}>
      {/* Zoom Controls */}
      {showZoomControls && duration > 0 && (
        <Group justify="space-between" mb="xs" align="center">
          <Group gap="xs">
            <ZoomOut size={14} style={{ color: 'var(--mantine-color-dimmed)' }} />
            <SegmentedControl
              value={zoomLevel}
              onChange={handleZoomChange}
              data={[
                { label: '30s', value: '30s' },
                { label: '1m', value: '1m' },
                { label: '5m', value: '5m' },
                { label: 'Full', value: 'full' },
              ]}
              size="xs"
            />
            <ZoomIn size={14} style={{ color: 'var(--mantine-color-dimmed)' }} />
          </Group>
          <Text size="xs" c="dimmed">
            Scroll waveform or click to seek
          </Text>
        </Group>
      )}

      {/* Waveform container with custom scrollbar */}
      <Box pos="relative">
        <Box
          ref={containerRef}
          w="100%"
          style={{
            borderRadius: 'var(--mantine-radius-md)',
            overflow: 'hidden',
            backgroundColor: 'var(--mantine-color-default)',
            minHeight: mergedConfig.waveformHeight || 120,
          }}
          className="waveform-container"
        />

        {/* Loading overlay */}
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
            <Flex align="center" justify="center" h="100%" gap="xs" c="dimmed">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Loading waveform...</span>
            </Flex>
          </Box>
        )}
      </Box>

      {/* Scrollbar and playhead styles */}
      <style jsx global>{`
        .waveform-container {
          /* Scrollbar styling */
          scrollbar-width: thin;
          scrollbar-color: var(--mantine-color-gray-5) var(--mantine-color-gray-2);
        }
        .waveform-container::-webkit-scrollbar {
          height: 10px;
        }
        .waveform-container::-webkit-scrollbar-track {
          background: var(--mantine-color-gray-2);
          border-radius: 5px;
        }
        .waveform-container::-webkit-scrollbar-thumb {
          background: var(--mantine-color-gray-5);
          border-radius: 5px;
        }
        .waveform-container::-webkit-scrollbar-thumb:hover {
          background: var(--mantine-color-gray-6);
        }
        [data-mantine-color-scheme='dark'] .waveform-container {
          scrollbar-color: var(--mantine-color-dark-3) var(--mantine-color-dark-5);
        }
        [data-mantine-color-scheme='dark'] .waveform-container::-webkit-scrollbar-track {
          background: var(--mantine-color-dark-5);
        }
        [data-mantine-color-scheme='dark'] .waveform-container::-webkit-scrollbar-thumb {
          background: var(--mantine-color-dark-3);
        }
        [data-mantine-color-scheme='dark'] .waveform-container::-webkit-scrollbar-thumb:hover {
          background: var(--mantine-color-dark-2);
        }
      `}</style>
    </Box>
  );
}

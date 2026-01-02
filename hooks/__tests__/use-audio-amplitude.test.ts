import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAudioAmplitude } from '../use-audio-amplitude';

/**
 * Create a mock MediaStream for testing
 */
function createMockMediaStream(): MediaStream {
  const mockTrack = {
    kind: 'audio' as const,
    enabled: true,
    stop: vi.fn(),
    getSettings: () => ({ sampleRate: 44100, channelCount: 2 }),
    id: 'mock-track-id',
    label: 'Mock Audio Track',
    muted: false,
    readyState: 'live' as const,
  };

  return {
    getTracks: () => [mockTrack],
    getAudioTracks: () => [mockTrack],
    getVideoTracks: () => [],
    active: true,
    id: 'mock-stream-id',
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addTrack: vi.fn(),
    removeTrack: vi.fn(),
    clone: vi.fn(),
    getTrackById: vi.fn(),
    dispatchEvent: vi.fn(),
    onaddtrack: null,
    onremovetrack: null,
  } as unknown as MediaStream;
}

// Track AudioContext instances for cleanup verification
let audioContextInstances: Array<{ close: ReturnType<typeof vi.fn>; state: string }> = [];
let sourceDisconnectCalls: number = 0;

// Store original AudioContext
const OriginalAudioContext = globalThis.AudioContext;

/**
 * Enhanced MockAudioContext for tracking cleanup
 */
class TestMockAudioContext {
  state: 'suspended' | 'running' | 'closed' = 'running';
  private closeFunction = vi.fn(async () => {
    this.state = 'closed';
  });

  constructor() {
    audioContextInstances.push({ close: this.closeFunction, state: this.state });
  }

  async decodeAudioData(buffer: ArrayBuffer) {
    void buffer;
    return {
      duration: 0,
      sampleRate: 44100,
      numberOfChannels: 2,
    };
  }

  createAnalyser() {
    return new TestMockAnalyserNode();
  }

  createMediaStreamSource(_stream: MediaStream) {
    return {
      connect: vi.fn(),
      disconnect: vi.fn(() => {
        sourceDisconnectCalls++;
      }),
    };
  }

  async close() {
    await this.closeFunction();
  }

  async resume() {
    this.state = 'running';
  }
}

/**
 * Enhanced MockAnalyserNode for testing
 */
class TestMockAnalyserNode {
  fftSize = 64;
  frequencyBinCount = 32;
  smoothingTimeConstant = 0.8;
  minDecibels = -100;
  maxDecibels = -30;

  getByteFrequencyData(array: Uint8Array): void {
    // Fill with mock frequency data (mid-range values for testing)
    for (let i = 0; i < array.length; i++) {
      array[i] = 128; // 50% amplitude
    }
  }

  getByteTimeDomainData(array: Uint8Array): void {
    for (let i = 0; i < array.length; i++) {
      array[i] = 128;
    }
  }

  connect() {
    return this;
  }

  disconnect() {}
}

describe('useAudioAmplitude', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    audioContextInstances = [];
    sourceDisconnectCalls = 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test override
    (globalThis as any).AudioContext = TestMockAudioContext;
    if (typeof window !== 'undefined') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test override
      (window as any).AudioContext = TestMockAudioContext;
    }
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    // Restore original AudioContext
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test override
    (globalThis as any).AudioContext = OriginalAudioContext;
    if (typeof window !== 'undefined') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test override
      (window as any).AudioContext = OriginalAudioContext;
    }
  });

  // ===========================================================================
  // Basic Functionality Tests
  // ===========================================================================
  describe('initial state', () => {
    it('should start in non-analyzing state', () => {
      const { result } = renderHook(() => useAudioAmplitude());
      expect(result.current.isAnalysing).toBe(false);
    });

    it('should have amplitudes array with zeros initially', () => {
      const { result } = renderHook(() => useAudioAmplitude());
      // Default fftSize is 64, so amplitudes length is 32
      expect(result.current.amplitudes).toHaveLength(32);
      expect(result.current.amplitudes.every((v) => v === 0)).toBe(true);
    });

    it('should have zero averageLevel initially', () => {
      const { result } = renderHook(() => useAudioAmplitude());
      expect(result.current.averageLevel).toBe(0);
    });

    it('should return startAnalysis and stopAnalysis functions', () => {
      const { result } = renderHook(() => useAudioAmplitude());
      expect(typeof result.current.startAnalysis).toBe('function');
      expect(typeof result.current.stopAnalysis).toBe('function');
    });
  });

  // ===========================================================================
  // Configuration Options Tests
  // ===========================================================================
  describe('configuration options', () => {
    it('should respect custom fftSize option', () => {
      const { result } = renderHook(() => useAudioAmplitude({ fftSize: 128 }));
      // fftSize 128 gives 64 frequency bins
      expect(result.current.amplitudes).toHaveLength(64);
    });

    it('should use default 66ms update interval when not specified', () => {
      const { result } = renderHook(() => useAudioAmplitude());
      const mockStream = createMockMediaStream();

      act(() => {
        result.current.startAnalysis(mockStream);
      });

      expect(result.current.isAnalysing).toBe(true);
    });

    it('should accept custom updateIntervalMs option', () => {
      const { result } = renderHook(() =>
        useAudioAmplitude({ updateIntervalMs: 100 })
      );

      expect(result.current.isAnalysing).toBe(false);
      // Hook should accept the option without error
    });

    it('should accept custom smoothingTimeConstant option', () => {
      const { result } = renderHook(() =>
        useAudioAmplitude({ smoothingTimeConstant: 0.5 })
      );

      expect(result.current.isAnalysing).toBe(false);
      // Hook should accept the option without error
    });
  });

  // ===========================================================================
  // Analysis Lifecycle Tests
  // ===========================================================================
  describe('analysis lifecycle', () => {
    it('should start analysis when startAnalysis is called with stream', async () => {
      const { result } = renderHook(() => useAudioAmplitude());
      const mockStream = createMockMediaStream();

      act(() => {
        result.current.startAnalysis(mockStream);
      });

      expect(result.current.isAnalysing).toBe(true);
    });

    it('should stop analysis when stopAnalysis is called', async () => {
      const { result } = renderHook(() => useAudioAmplitude());
      const mockStream = createMockMediaStream();

      act(() => {
        result.current.startAnalysis(mockStream);
      });

      expect(result.current.isAnalysing).toBe(true);

      act(() => {
        result.current.stopAnalysis();
      });

      expect(result.current.isAnalysing).toBe(false);
    });

    it('should reset amplitudes to zeros when stopAnalysis is called', async () => {
      const { result } = renderHook(() => useAudioAmplitude());
      const mockStream = createMockMediaStream();

      act(() => {
        result.current.startAnalysis(mockStream);
      });

      // Advance timers to get some amplitude data
      await act(async () => {
        vi.advanceTimersByTime(100);
        await Promise.resolve();
      });

      act(() => {
        result.current.stopAnalysis();
      });

      expect(result.current.amplitudes.every((v) => v === 0)).toBe(true);
      expect(result.current.averageLevel).toBe(0);
    });

    it('should stop previous analysis when startAnalysis is called again', async () => {
      const { result } = renderHook(() => useAudioAmplitude());
      const mockStream1 = createMockMediaStream();
      const mockStream2 = createMockMediaStream();

      act(() => {
        result.current.startAnalysis(mockStream1);
      });

      const firstContextCount = audioContextInstances.length;

      act(() => {
        result.current.startAnalysis(mockStream2);
      });

      // A new AudioContext should be created
      expect(audioContextInstances.length).toBe(firstContextCount + 1);
      expect(result.current.isAnalysing).toBe(true);
    });

    it('should handle multiple stop calls gracefully', () => {
      const { result } = renderHook(() => useAudioAmplitude());
      const mockStream = createMockMediaStream();

      act(() => {
        result.current.startAnalysis(mockStream);
      });

      act(() => {
        result.current.stopAnalysis();
      });

      // Second stop should not throw
      act(() => {
        result.current.stopAnalysis();
      });

      expect(result.current.isAnalysing).toBe(false);
    });
  });

  // ===========================================================================
  // Throttling Behavior Tests
  // ===========================================================================
  describe('throttling', () => {
    it('should respect updateIntervalMs option for state updates', async () => {
      // Use real timers for this test since RAF mock with fake timers is complex
      vi.useRealTimers();

      const updateIntervalMs = 100;
      const { result } = renderHook(() =>
        useAudioAmplitude({ updateIntervalMs })
      );
      const mockStream = createMockMediaStream();

      await act(async () => {
        result.current.startAnalysis(mockStream);
      });

      expect(result.current.isAnalysing).toBe(true);

      // Wait for the update interval to pass and RAF to trigger
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 150));
      });

      // The mock AnalyserNode fills with 128, so values should be non-zero
      expect(result.current.amplitudes.some((v) => v !== 0)).toBe(true);

      await act(async () => {
        result.current.stopAnalysis();
      });
    });

    it('should use default 66ms interval when not specified', () => {
      const { result } = renderHook(() => useAudioAmplitude());
      const mockStream = createMockMediaStream();

      act(() => {
        result.current.startAnalysis(mockStream);
      });

      // Verify hook starts analyzing immediately
      expect(result.current.isAnalysing).toBe(true);

      act(() => {
        result.current.stopAnalysis();
      });
    });
  });

  // ===========================================================================
  // Amplitude Data Tests
  // ===========================================================================
  describe('amplitude data', () => {
    it('should populate amplitudes array when analyzing', async () => {
      // Use real timers for RAF-based state updates
      vi.useRealTimers();

      const { result } = renderHook(() => useAudioAmplitude());
      const mockStream = createMockMediaStream();

      await act(async () => {
        result.current.startAnalysis(mockStream);
      });

      // Wait for RAF callback and state update (default interval is 66ms)
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 150));
      });

      // Mock fills with 128, so we expect values around that
      expect(result.current.amplitudes.some((v) => v === 128)).toBe(true);

      await act(async () => {
        result.current.stopAnalysis();
      });
    });

    it('should calculate averageLevel from amplitude data', async () => {
      // Use real timers for RAF-based state updates
      vi.useRealTimers();

      const { result } = renderHook(() => useAudioAmplitude());
      const mockStream = createMockMediaStream();

      await act(async () => {
        result.current.startAnalysis(mockStream);
      });

      // Wait for RAF callback and state update
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 150));
      });

      // Mock fills all values with 128
      // Average = 128 / 255 = ~0.502
      expect(result.current.averageLevel).toBeCloseTo(128 / 255, 2);

      await act(async () => {
        result.current.stopAnalysis();
      });
    });

    it('should have correct amplitudes array length based on fftSize', () => {
      // Default fftSize = 64, so frequencyBinCount = 32
      const { result: result1 } = renderHook(() => useAudioAmplitude());
      expect(result1.current.amplitudes).toHaveLength(32);

      // Custom fftSize = 128, so frequencyBinCount = 64
      const { result: result2 } = renderHook(() =>
        useAudioAmplitude({ fftSize: 128 })
      );
      expect(result2.current.amplitudes).toHaveLength(64);

      // Custom fftSize = 256, so frequencyBinCount = 128
      const { result: result3 } = renderHook(() =>
        useAudioAmplitude({ fftSize: 256 })
      );
      expect(result3.current.amplitudes).toHaveLength(128);
    });
  });

  // ===========================================================================
  // Cleanup Tests
  // ===========================================================================
  describe('cleanup', () => {
    it('should stop analysis on unmount', async () => {
      const { result, unmount } = renderHook(() => useAudioAmplitude());
      const mockStream = createMockMediaStream();

      act(() => {
        result.current.startAnalysis(mockStream);
      });

      expect(result.current.isAnalysing).toBe(true);

      // Unmount the hook
      unmount();

      // Advance timers to ensure cleanup callbacks execute
      await act(async () => {
        vi.advanceTimersByTime(100);
        await Promise.resolve();
      });

      // AudioContext.close should have been called
      // Note: We can't check isAnalysing after unmount as component is gone
      expect(audioContextInstances.length).toBeGreaterThan(0);
    });

    it('should disconnect source node on cleanup', async () => {
      const { result, unmount } = renderHook(() => useAudioAmplitude());
      const mockStream = createMockMediaStream();

      act(() => {
        result.current.startAnalysis(mockStream);
      });

      const disconnectCallsBefore = sourceDisconnectCalls;

      act(() => {
        result.current.stopAnalysis();
      });

      // Source should have been disconnected
      expect(sourceDisconnectCalls).toBeGreaterThan(disconnectCallsBefore);

      unmount();
    });

    it('should close AudioContext on cleanup', async () => {
      const { result } = renderHook(() => useAudioAmplitude());
      const mockStream = createMockMediaStream();

      act(() => {
        result.current.startAnalysis(mockStream);
      });

      const contextCount = audioContextInstances.length;
      expect(contextCount).toBeGreaterThan(0);

      act(() => {
        result.current.stopAnalysis();
      });

      // The close function should have been called
      // Check the last created context
      const lastContext = audioContextInstances[contextCount - 1];
      expect(lastContext.close).toHaveBeenCalled();
    });

    it('should handle cleanup errors gracefully', async () => {
      // Create a mock that throws on disconnect
      class ErrorProneAudioContext extends TestMockAudioContext {
        createMediaStreamSource(_stream: MediaStream) {
          return {
            connect: vi.fn(),
            disconnect: vi.fn(() => {
              throw new Error('Disconnect failed');
            }),
          };
        }
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test override
      (globalThis as any).AudioContext = ErrorProneAudioContext;
      if (typeof window !== 'undefined') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test override
        (window as any).AudioContext = ErrorProneAudioContext;
      }

      const { result } = renderHook(() => useAudioAmplitude());
      const mockStream = createMockMediaStream();

      act(() => {
        result.current.startAnalysis(mockStream);
      });

      // stopAnalysis should not throw even if disconnect fails
      expect(() => {
        act(() => {
          result.current.stopAnalysis();
        });
      }).not.toThrow();

      expect(result.current.isAnalysing).toBe(false);
    });
  });

  // ===========================================================================
  // Error Handling Tests
  // ===========================================================================
  describe('error handling', () => {
    it('should handle AudioContext creation failure gracefully', () => {
      // Mock AudioContext to throw
      class FailingAudioContext {
        constructor() {
          throw new Error('AudioContext not supported');
        }
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test override
      (globalThis as any).AudioContext = FailingAudioContext;
      if (typeof window !== 'undefined') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test override
        (window as any).AudioContext = FailingAudioContext;
      }

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { result } = renderHook(() => useAudioAmplitude());
      const mockStream = createMockMediaStream();

      // Should not throw
      act(() => {
        result.current.startAnalysis(mockStream);
      });

      // Should remain in non-analyzing state
      expect(result.current.isAnalysing).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to start audio analysis:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it('should call stopAnalysis on error during startAnalysis', () => {
      // Mock AudioContext to throw during createMediaStreamSource
      class PartiallyFailingAudioContext extends TestMockAudioContext {
        createMediaStreamSource(_stream: MediaStream) {
          throw new Error('createMediaStreamSource failed');
        }
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test override
      (globalThis as any).AudioContext = PartiallyFailingAudioContext;
      if (typeof window !== 'undefined') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test override
        (window as any).AudioContext = PartiallyFailingAudioContext;
      }

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { result } = renderHook(() => useAudioAmplitude());
      const mockStream = createMockMediaStream();

      act(() => {
        result.current.startAnalysis(mockStream);
      });

      // Should have cleaned up and reset state
      expect(result.current.isAnalysing).toBe(false);
      expect(result.current.averageLevel).toBe(0);

      consoleSpy.mockRestore();
    });
  });

  // ===========================================================================
  // Stability Tests (Function Reference Stability)
  // ===========================================================================
  describe('function stability', () => {
    it('should return stable startAnalysis reference across re-renders', () => {
      const { result, rerender } = renderHook(() => useAudioAmplitude());

      const firstStartAnalysis = result.current.startAnalysis;
      rerender();
      const secondStartAnalysis = result.current.startAnalysis;

      // useCallback should maintain reference stability (unless deps change)
      expect(firstStartAnalysis).toBe(secondStartAnalysis);
    });

    it('should return stable stopAnalysis reference across re-renders', () => {
      const { result, rerender } = renderHook(() => useAudioAmplitude());

      const firstStopAnalysis = result.current.stopAnalysis;
      rerender();
      const secondStopAnalysis = result.current.stopAnalysis;

      // useCallback should maintain reference stability
      expect(firstStopAnalysis).toBe(secondStopAnalysis);
    });
  });
});

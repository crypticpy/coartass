import { webcrypto } from 'crypto';
import '@testing-library/jest-dom/vitest';

// Ensure WebCrypto is available in the test environment (jsdom).
if (!globalThis.crypto) {
  // @ts-expect-error - assigning WebCrypto for tests
  globalThis.crypto = webcrypto;
}

// =============================================================================
// Mock window.matchMedia for Mantine and other responsive libraries
// =============================================================================
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {}, // deprecated
      removeListener: () => {}, // deprecated
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => true,
    }),
  });
}

// =============================================================================
// Mock AnalyserNode for amplitude testing
// =============================================================================
class MockAnalyserNode {
  fftSize = 2048;
  frequencyBinCount = 1024;
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
    // Fill with mock time domain data
    for (let i = 0; i < array.length; i++) {
      array[i] = 128;
    }
  }

  connect(): MockAnalyserNode {
    return this;
  }

  disconnect(): void {}
}

// =============================================================================
// Enhanced MockAudioContext with analyser support
// =============================================================================
// JSDOM does not implement Web Audio APIs. Provide a minimal stub so hooks that
// extract audio metadata (duration/sampleRate/channels) don't throw or log noise.
class MockAudioContext {
  state: 'suspended' | 'running' | 'closed' = 'running';

  async decodeAudioData(buffer: ArrayBuffer) {
    void buffer;
    return {
      duration: 0,
      sampleRate: 44100,
      numberOfChannels: 2,
    };
  }

  createAnalyser(): MockAnalyserNode {
    return new MockAnalyserNode();
  }

  createMediaStreamSource(_stream: MediaStream): { connect: (node: MockAnalyserNode) => void } {
    return {
      connect: () => {},
    };
  }

  async close() {
    this.state = 'closed';
  }

  async resume() {
    this.state = 'running';
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- test-only polyfill
const AudioContextCtor = (globalThis as any).AudioContext ?? MockAudioContext;

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- test-only polyfill
(globalThis as any).AudioContext = AudioContextCtor;

if (typeof window !== 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test-only polyfill
  (window as any).AudioContext = (window as any).AudioContext ?? AudioContextCtor;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test-only polyfill
  (window as any).webkitAudioContext = (window as any).webkitAudioContext ?? AudioContextCtor;
}

// =============================================================================
// Mock MediaRecorder for recording tests
// =============================================================================
class MockMediaRecorder {
  static isTypeSupported(mimeType: string): boolean {
    // Support common audio MIME types
    return ['audio/webm', 'audio/mp4', 'audio/ogg', 'audio/wav'].includes(mimeType);
  }

  state: 'inactive' | 'recording' | 'paused' = 'inactive';
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  onerror: ((error: Error) => void) | null = null;
  onstart: (() => void) | null = null;
  onpause: (() => void) | null = null;
  onresume: (() => void) | null = null;

  private stream: MediaStream;
  private options: { mimeType?: string; audioBitsPerSecond?: number };

  constructor(stream: MediaStream, options: { mimeType?: string; audioBitsPerSecond?: number } = {}) {
    this.stream = stream;
    this.options = options;
  }

  start(timeslice?: number): void {
    void timeslice; // Acknowledge parameter
    this.state = 'recording';
    this.onstart?.();

    // In tests, we don't actually emit data on interval
    // Tests can manually call requestData() to simulate chunks
  }

  stop(): void {
    this.state = 'inactive';
    // Emit final data chunk
    this.ondataavailable?.({ data: new Blob(['mock-audio-data'], { type: this.options.mimeType || 'audio/webm' }) });
    this.onstop?.();
  }

  pause(): void {
    if (this.state === 'recording') {
      this.state = 'paused';
      this.onpause?.();
    }
  }

  resume(): void {
    if (this.state === 'paused') {
      this.state = 'recording';
      this.onresume?.();
    }
  }

  requestData(): void {
    this.ondataavailable?.({ data: new Blob(['mock-chunk'], { type: this.options.mimeType || 'audio/webm' }) });
  }

  // Satisfy linter: acknowledge stream is stored for potential future use
  getStream(): MediaStream {
    return this.stream;
  }
}

// Apply MediaRecorder mock globally
if (typeof globalThis !== 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test-only polyfill
  (globalThis as any).MediaRecorder = MockMediaRecorder;
}

if (typeof window !== 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test-only polyfill
  (window as any).MediaRecorder = MockMediaRecorder;
}

// =============================================================================
// Mock navigator.mediaDevices for microphone access tests
// =============================================================================
const mockMediaStream = {
  getTracks: () => [{
    kind: 'audio',
    enabled: true,
    stop: () => {},
    getSettings: () => ({ sampleRate: 44100, channelCount: 2 }),
  }],
  getAudioTracks: () => [{
    kind: 'audio',
    enabled: true,
    stop: () => {},
    getSettings: () => ({ sampleRate: 44100, channelCount: 2 }),
  }],
  active: true,
};

const mockMediaDevices = {
  getUserMedia: async (_constraints: MediaStreamConstraints): Promise<MediaStream> => {
    // Simulate successful permission grant
    return mockMediaStream as unknown as MediaStream;
  },
  getDisplayMedia: async (_constraints: DisplayMediaStreamOptions): Promise<MediaStream> => {
    return mockMediaStream as unknown as MediaStream;
  },
  enumerateDevices: async (): Promise<MediaDeviceInfo[]> => {
    return [
      { deviceId: 'default', kind: 'audioinput', label: 'Default Microphone', groupId: 'default' } as MediaDeviceInfo,
    ];
  },
};

// Apply mediaDevices mock
if (typeof navigator !== 'undefined') {
  Object.defineProperty(navigator, 'mediaDevices', {
    value: mockMediaDevices,
    writable: true,
    configurable: true,
  });
}

// =============================================================================
// Mock requestAnimationFrame for animation/throttle testing
// =============================================================================
let rafId = 0;
const rafCallbacks: Map<number, FrameRequestCallback> = new Map();

const mockRequestAnimationFrame = (callback: FrameRequestCallback): number => {
  rafId++;
  const currentId = rafId;
  rafCallbacks.set(currentId, callback);
  // Immediately schedule execution for synchronous testing
  setTimeout(() => {
    const cb = rafCallbacks.get(currentId);
    if (cb) {
      cb(performance.now());
      rafCallbacks.delete(currentId);
    }
  }, 0);
  return currentId;
};

const mockCancelAnimationFrame = (id: number): void => {
  rafCallbacks.delete(id);
};

if (typeof globalThis !== 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test-only polyfill
  (globalThis as any).requestAnimationFrame = mockRequestAnimationFrame;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test-only polyfill
  (globalThis as any).cancelAnimationFrame = mockCancelAnimationFrame;
}

if (typeof window !== 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test-only polyfill
  (window as any).requestAnimationFrame = (window as any).requestAnimationFrame ?? mockRequestAnimationFrame;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test-only polyfill
  (window as any).cancelAnimationFrame = (window as any).cancelAnimationFrame ?? mockCancelAnimationFrame;
}

// =============================================================================
// Mock localStorage for preference tests
// =============================================================================
type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'clear'> & Partial<Storage>;

function hasUsableLocalStorage(value: unknown): value is StorageLike {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.getItem === 'function' &&
    typeof candidate.setItem === 'function' &&
    typeof candidate.removeItem === 'function' &&
    typeof candidate.clear === 'function'
  );
}

// Node (>=20) may expose a partial/disabled Web Storage implementation depending on flags.
// Ensure a usable Storage implementation exists for tests.
if (!hasUsableLocalStorage(globalThis.localStorage)) {
  const store = new Map<string, string>();

  const localStorageMock: Storage = {
    get length() {
      return store.size;
    },
    clear(): void {
      store.clear();
    },
    getItem(key: string): string | null {
      return store.has(key) ? store.get(key)! : null;
    },
    key(index: number): string | null {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key: string): void {
      store.delete(key);
    },
    setItem(key: string, value: string): void {
      store.set(key, String(value));
    },
  };

  Object.defineProperty(globalThis, 'localStorage', {
    value: localStorageMock,
    writable: true,
    configurable: true,
  });

  if (typeof window !== 'undefined') {
    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
      writable: true,
      configurable: true,
    });
  }
}

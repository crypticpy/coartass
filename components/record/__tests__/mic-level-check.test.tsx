import * as React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup, RenderOptions } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MantineProvider } from '@mantine/core';
import { MicLevelCheck } from '../mic-level-check';

// =============================================================================
// Test Wrapper with MantineProvider
// =============================================================================
function TestWrapper({ children }: { children: React.ReactNode }) {
  return <MantineProvider>{children}</MantineProvider>;
}

function renderWithMantine(
  ui: React.ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) {
  return render(ui, { wrapper: TestWrapper, ...options });
}

// =============================================================================
// Mock browser-capabilities module
// =============================================================================

// Use vi.hoisted to ensure these are available when vi.mock factory runs
const { mockSetMicCheckPreference, mockDetectMicIssue, mockGetMicIssueMessage } = vi.hoisted(() => ({
  mockSetMicCheckPreference: vi.fn(),
  mockDetectMicIssue: vi.fn(() => 'unknown' as const),
  mockGetMicIssueMessage: vi.fn(() => ({
    title: 'Error',
    message: 'Test error message',
    action: 'Try again',
  })),
}));

vi.mock('@/lib/browser-capabilities', () => ({
  detectBrowserName: () => 'Chrome',
  setMicCheckPreference: (skip: boolean) => mockSetMicCheckPreference(skip),
  detectMicIssue: (error: Error) => mockDetectMicIssue(error),
  getMicIssueMessage: (issue: string, browser: string) => mockGetMicIssueMessage(issue, browser),
}));

// =============================================================================
// Mock useAudioAmplitude hook
// =============================================================================
const { mockStartAnalysis, mockStopAnalysis, getMockAverageLevel, setMockAverageLevel } = vi.hoisted(() => {
  let averageLevel = 0;
  return {
    mockStartAnalysis: vi.fn(),
    mockStopAnalysis: vi.fn(),
    getMockAverageLevel: () => averageLevel,
    setMockAverageLevel: (val: number) => { averageLevel = val; },
  };
});

vi.mock('@/hooks/use-audio-amplitude', () => ({
  useAudioAmplitude: () => ({
    averageLevel: getMockAverageLevel(),
    amplitudes: [],
    isAnalysing: false,
    startAnalysis: mockStartAnalysis,
    stopAnalysis: mockStopAnalysis,
  }),
}));

// =============================================================================
// Test Helpers
// =============================================================================

/**
 * Creates a mock MediaStream with configurable track behavior
 */
function createMockMediaStream() {
  const mockTrackStop = vi.fn();
  const mockTrack = {
    kind: 'audio' as const,
    enabled: true,
    stop: mockTrackStop,
    getSettings: () => ({ sampleRate: 44100, channelCount: 2 }),
  };

  return {
    stream: {
      getTracks: () => [mockTrack],
      getAudioTracks: () => [mockTrack],
      active: true,
    } as unknown as MediaStream,
    mockTrackStop,
  };
}

/**
 * Sets up navigator.mediaDevices.getUserMedia mock
 */
function setupGetUserMediaMock(
  behavior: 'success' | 'permission_denied' | 'no_microphone' | 'device_in_use'
) {
  const { stream, mockTrackStop } = createMockMediaStream();

  const mockGetUserMedia = vi.fn(async () => {
    if (behavior === 'success') {
      return stream;
    }

    // Simulate different error types
    const errorMap = {
      permission_denied: { name: 'NotAllowedError', message: 'Permission denied' },
      no_microphone: { name: 'NotFoundError', message: 'No device found' },
      device_in_use: { name: 'NotReadableError', message: 'Device in use' },
    };

    const errorInfo = errorMap[behavior];
    const error = new Error(errorInfo.message);
    error.name = errorInfo.name;
    throw error;
  });

  Object.defineProperty(navigator, 'mediaDevices', {
    value: {
      getUserMedia: mockGetUserMedia,
    },
    writable: true,
    configurable: true,
  });

  return { mockGetUserMedia, mockTrackStop, stream };
}

// =============================================================================
// Tests
// =============================================================================

describe('MicLevelCheck', () => {
  const defaultProps = {
    onCheckPassed: vi.fn(),
    onSkip: vi.fn(),
    onCancel: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    setMockAverageLevel(0);
    // Reset localStorage
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  // ===========================================================================
  // Initial Render & Permission Request
  // ===========================================================================
  describe('initial render and permission request', () => {
    it('should show requesting state initially', async () => {
      // Delay getUserMedia to observe initial state
      const mockGetUserMedia = vi.fn(() => new Promise(() => {})); // Never resolves
      Object.defineProperty(navigator, 'mediaDevices', {
        value: { getUserMedia: mockGetUserMedia },
        writable: true,
        configurable: true,
      });

      renderWithMantine(<MicLevelCheck {...defaultProps} />);

      expect(screen.getByText('Requesting Microphone Access...')).toBeInTheDocument();
    });

    it('should call getUserMedia on mount', async () => {
      const { mockGetUserMedia } = setupGetUserMediaMock('success');

      renderWithMantine(<MicLevelCheck {...defaultProps} />);

      await waitFor(() => {
        expect(mockGetUserMedia).toHaveBeenCalledWith({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
      });
    });

    it('should call getUserMedia with audio constraints', async () => {
      const { mockGetUserMedia } = setupGetUserMediaMock('success');

      renderWithMantine(<MicLevelCheck {...defaultProps} />);

      await waitFor(() => {
        expect(mockGetUserMedia).toHaveBeenCalledTimes(1);
        const calledWith = mockGetUserMedia.mock.calls[0][0];
        expect(calledWith.audio).toBeDefined();
        expect(calledWith.audio.echoCancellation).toBe(true);
        expect(calledWith.audio.noiseSuppression).toBe(true);
      });
    });
  });

  // ===========================================================================
  // State Transitions
  // ===========================================================================
  describe('state transitions', () => {
    it('should transition to checking state after permission granted', async () => {
      setupGetUserMediaMock('success');

      renderWithMantine(<MicLevelCheck {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Test Your Microphone')).toBeInTheDocument();
      });

      // Also verify startAnalysis was called
      expect(mockStartAnalysis).toHaveBeenCalled();
    });

    it('should transition to error state on permission denied', async () => {
      // Configure mocks BEFORE rendering
      mockDetectMicIssue.mockReturnValue('permission_denied');
      mockGetMicIssueMessage.mockReturnValue({
        title: 'Microphone access denied',
        message:
          'Click the lock icon in your browser address bar to update microphone permissions.',
        action: 'Update permissions and try again',
      });
      setupGetUserMediaMock('permission_denied');

      renderWithMantine(<MicLevelCheck {...defaultProps} />);

      await waitFor(
        () => {
          expect(screen.getByText('Microphone access denied')).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    });

    it('should transition to error state when no microphone found', async () => {
      // Configure mocks BEFORE rendering
      mockDetectMicIssue.mockReturnValue('no_microphone');
      mockGetMicIssueMessage.mockReturnValue({
        title: 'No microphone found',
        message: 'Please connect a microphone and try again.',
        action: 'Connect a microphone',
      });
      setupGetUserMediaMock('no_microphone');

      renderWithMantine(<MicLevelCheck {...defaultProps} />);

      await waitFor(
        () => {
          expect(screen.getByText('No microphone found')).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    });

    it('should transition to error state when device is in use', async () => {
      // Configure mocks BEFORE rendering
      mockDetectMicIssue.mockReturnValue('device_in_use');
      mockGetMicIssueMessage.mockReturnValue({
        title: 'Microphone is in use',
        message: 'Another application may be using your microphone.',
        action: 'Close other apps and retry',
      });
      setupGetUserMediaMock('device_in_use');

      renderWithMantine(<MicLevelCheck {...defaultProps} />);

      await waitFor(
        () => {
          expect(screen.getByText('Microphone is in use')).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    });

    it('should show description text after permission granted', async () => {
      setupGetUserMediaMock('success');

      renderWithMantine(<MicLevelCheck {...defaultProps} />);

      await waitFor(() => {
        expect(
          screen.getByText(/Speak normally to make sure your microphone is working/)
        ).toBeInTheDocument();
      });
    });
  });

  // ===========================================================================
  // Callback Props
  // ===========================================================================
  describe('callbacks', () => {
    it('should call onCheckPassed when continue button clicked', async () => {
      const user = userEvent.setup();
      setupGetUserMediaMock('success');

      renderWithMantine(<MicLevelCheck {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Test Your Microphone')).toBeInTheDocument();
      });

      // Click the continue button (text varies based on state)
      const continueButton = screen.getByRole('button', { name: /continue/i });
      await user.click(continueButton);

      expect(defaultProps.onCheckPassed).toHaveBeenCalledTimes(1);
    });

    it('should call onSkip when skip button clicked', async () => {
      const user = userEvent.setup();
      setupGetUserMediaMock('success');

      renderWithMantine(<MicLevelCheck {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Test Your Microphone')).toBeInTheDocument();
      });

      const skipButton = screen.getByRole('button', { name: /skip for now/i });
      await user.click(skipButton);

      expect(defaultProps.onSkip).toHaveBeenCalledTimes(1);
    });

    it('should call onCancel on Escape key press', async () => {
      setupGetUserMediaMock('success');

      renderWithMantine(<MicLevelCheck {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Test Your Microphone')).toBeInTheDocument();
      });

      fireEvent.keyDown(window, { key: 'Escape' });

      expect(defaultProps.onCancel).toHaveBeenCalledTimes(1);
    });

    it('should call onCancel when cancel button clicked in error state', async () => {
      const user = userEvent.setup();
      // Configure mocks BEFORE rendering
      mockDetectMicIssue.mockReturnValue('permission_denied');
      mockGetMicIssueMessage.mockReturnValue({
        title: 'Microphone access denied',
        message: 'Permission denied',
        action: 'Try again',
      });
      setupGetUserMediaMock('permission_denied');

      renderWithMantine(<MicLevelCheck {...defaultProps} />);

      await waitFor(
        () => {
          expect(screen.getByText('Microphone access denied')).toBeInTheDocument();
        },
        { timeout: 3000 }
      );

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      expect(defaultProps.onCancel).toHaveBeenCalledTimes(1);
    });
  });

  // ===========================================================================
  // Skip Preference
  // ===========================================================================
  describe('skip preference', () => {
    it('should persist skip preference to localStorage when checkbox checked and continue clicked', async () => {
      const user = userEvent.setup();
      setupGetUserMediaMock('success');

      renderWithMantine(<MicLevelCheck {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Test Your Microphone')).toBeInTheDocument();
      });

      // Check the "Don't show this check again" checkbox
      const checkbox = screen.getByRole('checkbox', {
        name: /don't show this check again/i,
      });
      await user.click(checkbox);

      // Click continue
      const continueButton = screen.getByRole('button', { name: /continue/i });
      await user.click(continueButton);

      expect(mockSetMicCheckPreference).toHaveBeenCalledWith(true);
    });

    it('should persist skip preference when skip button clicked with checkbox checked', async () => {
      const user = userEvent.setup();
      setupGetUserMediaMock('success');

      renderWithMantine(<MicLevelCheck {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Test Your Microphone')).toBeInTheDocument();
      });

      // Check the checkbox
      const checkbox = screen.getByRole('checkbox', {
        name: /don't show this check again/i,
      });
      await user.click(checkbox);

      // Click skip
      const skipButton = screen.getByRole('button', { name: /skip for now/i });
      await user.click(skipButton);

      expect(mockSetMicCheckPreference).toHaveBeenCalledWith(true);
    });

    it('should not persist preference if checkbox is not checked', async () => {
      const user = userEvent.setup();
      setupGetUserMediaMock('success');

      renderWithMantine(<MicLevelCheck {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Test Your Microphone')).toBeInTheDocument();
      });

      // Click continue without checking checkbox
      const continueButton = screen.getByRole('button', { name: /continue/i });
      await user.click(continueButton);

      expect(mockSetMicCheckPreference).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // Keyboard Accessibility
  // ===========================================================================
  describe('keyboard accessibility', () => {
    it('should handle Enter key to continue when in checking state', async () => {
      setupGetUserMediaMock('success');

      renderWithMantine(<MicLevelCheck {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Test Your Microphone')).toBeInTheDocument();
      });

      // Press Enter - should not work in 'checking' state (averageLevel = 0)
      fireEvent.keyDown(window, { key: 'Enter' });

      // Since we're in 'warning' state (averageLevel is 0), Enter should trigger continue
      expect(defaultProps.onCheckPassed).toHaveBeenCalledTimes(1);
    });

    it('should handle Escape key to cancel at any time', async () => {
      setupGetUserMediaMock('success');

      renderWithMantine(<MicLevelCheck {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Test Your Microphone')).toBeInTheDocument();
      });

      fireEvent.keyDown(window, { key: 'Escape' });

      expect(defaultProps.onCancel).toHaveBeenCalledTimes(1);
    });

    it('should handle Escape key during requesting state', async () => {
      // Delay getUserMedia to stay in requesting state
      const mockGetUserMedia = vi.fn(() => new Promise(() => {})); // Never resolves
      Object.defineProperty(navigator, 'mediaDevices', {
        value: { getUserMedia: mockGetUserMedia },
        writable: true,
        configurable: true,
      });

      renderWithMantine(<MicLevelCheck {...defaultProps} />);

      expect(screen.getByText('Requesting Microphone Access...')).toBeInTheDocument();

      fireEvent.keyDown(window, { key: 'Escape' });

      // onCancel should be called even during requesting state
      expect(defaultProps.onCancel).toHaveBeenCalledTimes(1);
    });

    it('should show keyboard hint text', async () => {
      setupGetUserMediaMock('success');

      renderWithMantine(<MicLevelCheck {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Test Your Microphone')).toBeInTheDocument();
      });

      expect(screen.getByText(/press/i)).toBeInTheDocument();
      expect(screen.getByText(/enter/i)).toBeInTheDocument();
      expect(screen.getByText(/escape/i)).toBeInTheDocument();
    });
  });

  // ===========================================================================
  // Cleanup
  // ===========================================================================
  describe('cleanup', () => {
    it('should stop media stream on unmount', async () => {
      setupGetUserMediaMock('success');

      const { unmount } = renderWithMantine(<MicLevelCheck {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Test Your Microphone')).toBeInTheDocument();
      });

      unmount();

      // Verify stopAnalysis was called
      expect(mockStopAnalysis).toHaveBeenCalled();
    });

    it('should call stopAnalysis when continue is clicked', async () => {
      const user = userEvent.setup();
      setupGetUserMediaMock('success');

      renderWithMantine(<MicLevelCheck {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Test Your Microphone')).toBeInTheDocument();
      });

      const continueButton = screen.getByRole('button', { name: /continue/i });
      await user.click(continueButton);

      expect(mockStopAnalysis).toHaveBeenCalled();
    });

    it('should call stopAnalysis when skip is clicked', async () => {
      const user = userEvent.setup();
      setupGetUserMediaMock('success');

      renderWithMantine(<MicLevelCheck {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Test Your Microphone')).toBeInTheDocument();
      });

      const skipButton = screen.getByRole('button', { name: /skip for now/i });
      await user.click(skipButton);

      expect(mockStopAnalysis).toHaveBeenCalled();
    });

    it('should call stopAnalysis when cancel is clicked', async () => {
      setupGetUserMediaMock('success');

      renderWithMantine(<MicLevelCheck {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Test Your Microphone')).toBeInTheDocument();
      });

      fireEvent.keyDown(window, { key: 'Escape' });

      expect(mockStopAnalysis).toHaveBeenCalled();
    });

    it('should stop stream tracks if unmounted while permission request pending', async () => {
      // Create a promise we can control
      let resolveGetUserMedia: (value: MediaStream) => void;
      const pendingPromise = new Promise<MediaStream>((resolve) => {
        resolveGetUserMedia = resolve;
      });

      const mockGetUserMedia = vi.fn(() => pendingPromise);
      Object.defineProperty(navigator, 'mediaDevices', {
        value: { getUserMedia: mockGetUserMedia },
        writable: true,
        configurable: true,
      });

      const { unmount } = renderWithMantine(<MicLevelCheck {...defaultProps} />);

      // Unmount before permission is granted
      unmount();

      // Now resolve the promise - the stream should be stopped
      const { stream, mockTrackStop } = createMockMediaStream();
      resolveGetUserMedia!(stream);

      // Wait a tick for the promise resolution to be processed
      await new Promise((r) => setTimeout(r, 0));

      // The component should have stopped the stream since it was unmounted
      expect(mockTrackStop).toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // Retry Behavior
  // ===========================================================================
  describe('retry behavior', () => {
    it('should allow retry after permission denied', async () => {
      const user = userEvent.setup();
      // Configure mocks BEFORE rendering
      mockDetectMicIssue.mockReturnValue('permission_denied');
      mockGetMicIssueMessage.mockReturnValue({
        title: 'Microphone access denied',
        message: 'Permission denied',
        action: 'Try again',
      });
      setupGetUserMediaMock('permission_denied');

      renderWithMantine(<MicLevelCheck {...defaultProps} />);

      await waitFor(
        () => {
          expect(screen.getByText('Microphone access denied')).toBeInTheDocument();
        },
        { timeout: 3000 }
      );

      // Find and click retry button
      const retryButton = screen.getByRole('button', { name: /retry/i });
      expect(retryButton).toBeInTheDocument();

      // Setup success for retry
      setupGetUserMediaMock('success');

      await user.click(retryButton);

      // Should transition to checking state
      await waitFor(
        () => {
          expect(screen.getByText('Test Your Microphone')).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    });
  });

  // ===========================================================================
  // UI Elements
  // ===========================================================================
  describe('UI elements', () => {
    it('should display audio level meter in checking state', async () => {
      setupGetUserMediaMock('success');

      renderWithMantine(<MicLevelCheck {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Test Your Microphone')).toBeInTheDocument();
      });

      expect(screen.getByText('Audio Level')).toBeInTheDocument();
    });

    it('should show error alert with proper styling', async () => {
      // Configure mocks BEFORE rendering
      mockDetectMicIssue.mockReturnValue('permission_denied');
      mockGetMicIssueMessage.mockReturnValue({
        title: 'Microphone access denied',
        message: 'Click the lock icon to update permissions.',
        action: 'Try again',
      });
      setupGetUserMediaMock('permission_denied');

      renderWithMantine(<MicLevelCheck {...defaultProps} />);

      await waitFor(
        () => {
          expect(screen.getByText('Microphone access denied')).toBeInTheDocument();
          expect(
            screen.getByText('Click the lock icon to update permissions.')
          ).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    });

    it('should show checkbox for skip preference', async () => {
      setupGetUserMediaMock('success');

      renderWithMantine(<MicLevelCheck {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Test Your Microphone')).toBeInTheDocument();
      });

      const checkbox = screen.getByRole('checkbox', {
        name: /don't show this check again/i,
      });
      expect(checkbox).toBeInTheDocument();
      expect(checkbox).not.toBeChecked();
    });
  });
});

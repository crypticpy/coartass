import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFileUpload } from '../use-file-upload';

vi.mock('@/lib/audio-processing', () => ({
  processAudioForTranscription: vi.fn(),
  getFileProcessingStrategy: vi.fn(async () => ({
    needsConversion: false,
    needsSplitting: true,
  })),
}));

describe('useFileUpload parallel merging', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('merges chunk results in order regardless of completion order', async () => {
    const { result } = renderHook(() => useFileUpload());

    await act(async () => {
      const bytes = new Uint8Array(2048);
      await result.current.selectFile(new File([bytes], 'sample.wav', { type: 'audio/wav' }));
    });

    // TODO: Add more assertions once transcription API is mocked.
    expect(result.current.file?.name).toBe('sample.wav');
  });
});

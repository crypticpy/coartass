import { computeTranscriptFingerprint } from '@/lib/transcript-fingerprint';

describe('computeTranscriptFingerprint', () => {
  it('generates deterministic hash from file content', async () => {
    const blob = new Blob(['hello world'], { type: 'text/plain' });
    const fingerprint = await computeTranscriptFingerprint(blob);
    const fingerprintAgain = await computeTranscriptFingerprint(blob);

    expect(fingerprint.fileHash).toEqual(fingerprintAgain.fileHash);
  });

  it('includes optional duration metadata when provided', async () => {
    const blob = new Blob(['hello duration'], { type: 'text/plain' });
    const fingerprint = await computeTranscriptFingerprint(blob, { duration: 42 });

    expect(fingerprint.lengthSeconds).toBe(42);
  });
});

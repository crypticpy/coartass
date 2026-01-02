import { hashArrayBuffer } from './file-hash';
import type { TranscriptFingerprint } from '@/types/transcript';

export async function computeTranscriptFingerprint(
  file: Blob,
  metadata?: { duration?: number }
): Promise<TranscriptFingerprint> {
  const arrayBuffer = await file.arrayBuffer();
  return {
    fileHash: hashArrayBuffer(arrayBuffer),
    lengthSeconds: metadata?.duration,
  };
}

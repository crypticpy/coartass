import { createHash } from 'crypto';

function arrayBufferToHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const hash = createHash('sha256');
  hash.update(bytes);
  return hash.digest('hex');
}

export async function hashFile(file: Blob): Promise<string> {
  const buffer = await file.arrayBuffer();
  return arrayBufferToHex(buffer);
}

export { arrayBufferToHex as hashArrayBuffer };

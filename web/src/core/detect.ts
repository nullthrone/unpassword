import type { Format } from './types';

const CFB_MAGIC = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];

export type Detected = Format | 'cfb-other' | null;

function startsWith(data: Uint8Array, bytes: number[], offset = 0): boolean {
  if (data.length < offset + bytes.length) return false;
  return bytes.every((b, i) => data[offset + i] === b);
}

/**
 * Identifies the container by its magic bytes. Encrypted OOXML files are not
 * ZIPs but Compound File Binary containers; whether such a container really is
 * encrypted OOXML (and not, say, a legacy .doc) is decided by the office module.
 */
export function detectFormat(data: Uint8Array): Format | null {
  // PDF: "%PDF-" may be preceded by up to 1 KiB of junk.
  const head = data.subarray(0, 1024 + 5);
  for (let i = 0; i + 5 <= head.length; i++) {
    if (head[i] === 0x25 && startsWith(head, [0x25, 0x50, 0x44, 0x46, 0x2d], i)) return 'pdf';
  }
  if (startsWith(data, CFB_MAGIC)) return 'ooxml';
  // local file header, or end of central directory of an empty archive
  if (startsWith(data, [0x50, 0x4b, 0x03, 0x04]) || startsWith(data, [0x50, 0x4b, 0x05, 0x06])) return 'zip';
  return null;
}

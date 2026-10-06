import { sha1 } from '@noble/hashes/legacy.js';
import { sha256, sha384, sha512 } from '@noble/hashes/sha2.js';
import { UnpasswordError } from '../types';

export type HashFn = ((data: Uint8Array) => Uint8Array) & { outputLen: number; blockLen: number; create(): unknown };

export const HASHES: Record<string, HashFn> = {
  SHA1: sha1 as unknown as HashFn,
  'SHA-1': sha1 as unknown as HashFn,
  SHA256: sha256 as unknown as HashFn,
  'SHA-256': sha256 as unknown as HashFn,
  SHA384: sha384 as unknown as HashFn,
  'SHA-384': sha384 as unknown as HashFn,
  SHA512: sha512 as unknown as HashFn,
  'SHA-512': sha512 as unknown as HashFn,
};

/** Office passwords are hashed as UTF-16LE without terminator. */
export function utf16le(s: string): Uint8Array {
  const out = new Uint8Array(s.length * 2);
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    out[i * 2] = c & 0xff;
    out[i * 2 + 1] = c >> 8;
  }
  return out;
}

export function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

export function le32(n: number): Uint8Array {
  const b = new Uint8Array(4);
  new DataView(b.buffer).setUint32(0, n >>> 0, true);
  return b;
}

/** Truncate, or pad with 0x36, to `len` bytes (MS-OFFCRYPTO 2.3.4.11). */
export function fit(data: Uint8Array, len: number): Uint8Array {
  if (data.length >= len) return data.slice(0, len);
  const out = new Uint8Array(len).fill(0x36);
  out.set(data);
  return out;
}

export function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a[i] ^ b[i];
  return d === 0;
}

/**
 * StreamSize of an EncryptedPackage. The field is 8 bytes, but common
 * implementations only read (and some writers only fill) the low 4 bytes; with
 * inputs far below 4 GiB the high half carries no information.
 */
export function readStreamSize(data: Uint8Array): number {
  return new DataView(data.buffer, data.byteOffset, 8).getUint32(0, true);
}

/** The ciphertext needed for `size` plaintext bytes, rounded up to the AES block size. */
export function blockAlignedBody(encryptedPackage: Uint8Array, size: number): Uint8Array {
  const needed = Math.ceil(size / 16) * 16;
  const body = encryptedPackage.subarray(8);
  if (needed > body.length) throw new RangeError('encrypted package truncated');
  return body.subarray(0, needed);
}

/**
 * H0 = H(salt + password); Hn = H(iterator + Hn-1) for n in 0..spinCount-1.
 * The spin count is taken from the file unchanged.
 */
export function iteratedHash(hash: HashFn, salt: Uint8Array, password: string, spinCount: number): Uint8Array {
  const pw = utf16le(password);
  let h = hash(concat(salt, pw));
  pw.fill(0);
  const buf = new Uint8Array(4 + h.length);
  const view = new DataView(buf.buffer);
  for (let i = 0; i < spinCount; i++) {
    view.setUint32(0, i, true);
    buf.set(h, 4);
    h = hash(buf);
  }
  buf.fill(0);
  return h;
}

export function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64.replace(/\s+/g, ''));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function packageBody(encryptedPackage: Uint8Array): { size: number; body: Uint8Array } {
  if (encryptedPackage.length < 8) throw new UnpasswordError('corrupt', 'encrypted package too short');
  const size = readStreamSize(encryptedPackage);
  try {
    return { size, body: blockAlignedBody(encryptedPackage, size) };
  } catch (cause) {
    throw new UnpasswordError('corrupt', 'encrypted package truncated', { cause });
  }
}

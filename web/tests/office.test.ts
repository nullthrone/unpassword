import { describe, expect, it } from 'vitest';
import { unlockOoxml } from '../src/core/office/index';
import { UnpasswordError } from '../src/core/types';
import { PW, fixture } from './helpers';

async function errorCode(p: Promise<unknown>): Promise<string> {
  try {
    await p;
  } catch (e) {
    if (e instanceof UnpasswordError) return e.code;
    throw e;
  }
  throw new Error('expected an error');
}

function indexOf(hay: Uint8Array, needle: Uint8Array): number {
  outer: for (let i = 0; i + needle.length <= hay.length; i++) {
    for (let j = 0; j < needle.length; j++) if (hay[i + j] !== needle[j]) continue outer;
    return i;
  }
  return -1;
}

/** Offset of the EncryptedPackage stream: it starts with its plaintext size as uint64 LE. */
function locate(data: Uint8Array, size: number): number {
  const header = new Uint8Array(8);
  new DataView(header.buffer).setUint32(0, size, true);
  const at = indexOf(data, header);
  if (at < 0) throw new Error('EncryptedPackage not found');
  return at;
}

function containsAscii(data: Uint8Array, text: string): boolean {
  return new TextDecoder('latin1').decode(data).includes(text);
}

describe('unlockOoxml', () => {
  it.each(['office/office-agile.docx', 'office/office-agile.xlsx'])(
    'decrypts Agile encryption written by Microsoft Office (%s) with a valid integrity HMAC',
    async (file) => {
      const r = await unlockOoxml(fixture(file), PW.officeStandard);
      expect(r).toMatchObject({ format: 'ooxml', mode: 'decrypted', warnings: [] });
      expect(containsAscii(r.data, '[Content_Types].xml')).toBe(true);
    },
  );

  it('decrypts Agile encryption with a non-ASCII password byte-exactly', async () => {
    const r = await unlockOoxml(fixture('office/agile.docx'), PW.office);
    expect(r.data).toEqual(fixture('office/plain.docx'));
    expect(r.warnings).toEqual([]);
  });

  it('decrypts ECMA-376 Standard encryption', async () => {
    const r = await unlockOoxml(fixture('office/standard.docx'), PW.officeStandard);
    expect(Array.from(r.data.subarray(0, 4))).toEqual([0x50, 0x4b, 0x03, 0x04]);
    expect(containsAscii(r.data, '[Content_Types].xml')).toBe(true);
  });

  it.each(['office/agile.docx', 'office/office-agile.docx', 'office/standard.docx'])(
    '%s rejects a wrong password',
    async (file) => {
      expect(await errorCode(unlockOoxml(fixture(file), 'wrong'))).toBe('wrong-password');
    },
  );

  it('detects tampering via the Agile data integrity HMAC', async () => {
    const data = fixture('office/office-agile.docx');
    const r = await unlockOoxml(data, PW.officeStandard);
    expect(r.warnings).toEqual([]);
    // flip one byte of the EncryptedPackage ciphertext
    const marker = locate(data, r.data.length);
    data[marker + 2000] ^= 0xff;
    const tampered = await unlockOoxml(data, PW.officeStandard).catch((e: UnpasswordError) => e);
    if (tampered instanceof UnpasswordError) expect(tampered.code).toBe('corrupt');
    else expect(tampered.warnings).toEqual(['integrity-check-failed']);
  });

  it('rejects non-OOXML compound files', async () => {
    const data = fixture('office/standard.docx');
    // break the stream name "EncryptionInfo" in the directory
    const name = new Uint8Array([...'EncryptionInfo'].flatMap((c) => [c.charCodeAt(0), 0]));
    const at = indexOf(data, name);
    expect(at).toBeGreaterThan(0);
    data[at] = 'X'.charCodeAt(0);
    expect(await errorCode(unlockOoxml(data, PW.officeStandard))).toBe('unsupported');
  });
});

import { Uint8ArrayReader, Uint8ArrayWriter, ZipReader } from '@zip.js/zip.js';
import { describe, expect, it } from 'vitest';
import { UnpasswordError } from '../src/core/types';
import { unlockZip } from '../src/core/zip/index';
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

async function contents(zip: Uint8Array): Promise<Record<string, { encrypted: boolean; text: string }>> {
  const reader = new ZipReader(new Uint8ArrayReader(zip));
  const out: Record<string, { encrypted: boolean; text: string }> = {};
  for (const e of await reader.getEntries()) {
    if (e.directory) continue;
    const data = await e.getData(new Uint8ArrayWriter());
    out[e.filename] = { encrypted: e.encrypted, text: new TextDecoder().decode(data) };
  }
  await reader.close();
  return out;
}

describe('unlockZip', () => {
  it.each(['zip/zipcrypto.zip', 'zip/aes.zip'])('%s → unencrypted archive with identical content', async (file) => {
    const r = await unlockZip(fixture(file), PW.zip);
    expect(r).toMatchObject({ format: 'zip', mode: 'decrypted' });
    const got = await contents(r.data);
    const expected = await contents(fixture('zip/plain.zip'));
    expect(Object.keys(got).sort()).toEqual(Object.keys(expected).sort());
    for (const [name, entry] of Object.entries(got)) {
      expect(entry.encrypted).toBe(false);
      expect(entry.text).toBe(expected[name].text);
    }
  });

  it('keeps unencrypted entries of partially encrypted archives', async () => {
    const got = await contents((await unlockZip(fixture('zip/partial.zip'), PW.zip)).data);
    expect(got).toEqual({
      'public.txt': { encrypted: false, text: 'not secret' },
      'secret.txt': { encrypted: false, text: 'secret' },
    });
  });

  it.each(['zip/zipcrypto.zip', 'zip/aes.zip'])('%s rejects a wrong password', async (file) => {
    expect(await errorCode(unlockZip(fixture(file), 'wrong'))).toBe('wrong-password');
  });

  it('rejects ZipCrypto wrong passwords that pass the 1-byte check', async () => {
    // Over many wrong passwords, ~1/256 pass ZipCrypto's check byte; all must still fail.
    const data = fixture('zip/zipcrypto.zip');
    for (let i = 0; i < 600; i++) {
      expect(await errorCode(unlockZip(data, `wrong-${i}`))).toBe('wrong-password');
    }
  });

  it('rejects archives whose entries use different passwords', async () => {
    expect(await errorCode(unlockZip(fixture('zip/mixed.zip'), PW.zip))).toBe('mixed-passwords');
  });

  it('reports unencrypted archives', async () => {
    expect(await errorCode(unlockZip(fixture('zip/plain.zip'), 'x'))).toBe('not-encrypted');
    expect(await errorCode(unlockZip(fixture('office/plain.docx'), 'x'))).toBe('not-encrypted');
  });
});

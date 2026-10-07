import { beforeAll, describe, expect, it } from 'vitest';
import { unlockPdf } from '../src/core/pdf/index';
import type { PdfCapabilities } from '../src/core/pdf/policy';
import { inspectEncryption } from '../src/core/pdf/qpdf';
import { UnpasswordError } from '../src/core/types';
import { PW, fixture, useNodeQpdf } from './helpers';

beforeAll(useNodeQpdf);

async function errorCode(p: Promise<unknown>): Promise<string> {
  try {
    await p;
  } catch (e) {
    if (e instanceof UnpasswordError) return e.code;
    throw e;
  }
  throw new Error('expected an error');
}

describe('unlockPdf', () => {
  it('fully decrypts with the user password when there are no restrictions', async () => {
    const r = await unlockPdf(fixture('pdf/user-aes256.pdf'), PW.pdfUser);
    expect(r.mode).toBe('decrypted');
    expect((await inspectEncryption(r.data, ''))?.encrypted).toBe(false);
  });

  it.each(['restricted-aes256.pdf', 'restricted-aes128.pdf', 'restricted-rc4.pdf'])(
    '%s: user password removes only the open password and keeps restrictions',
    async (file) => {
      const original = await inspectEncryption(fixture(`pdf/${file}`), PW.pdfUser);
      const r = await unlockPdf(fixture(`pdf/${file}`), PW.pdfUser);
      expect(r.mode).toBe('open-password-removed');
      const after = await inspectEncryption(r.data, '');
      expect(after).toMatchObject({ encrypted: true, userPasswordMatched: true, ownerPasswordMatched: false });
      expect(after?.capabilities.extract).toBe(false);
      expect(after?.capabilities.printhigh).toBe(false);
      expect(after?.capabilities.modifyassembly).toBe(false);
      expect(after?.capabilities.modifyother).toBe(false);
      expect(after?.capabilities.printlow).toBe(original?.capabilities.printlow);
      // the original owner password does not control the new file
      expect((await inspectEncryption(r.data, PW.pdfOwner))?.ownerPasswordMatched ?? false).toBe(false);
    },
  );

  it.each(['restricted-rc4-noaccess.pdf', 'restricted-rc4-40.pdf'])(
    '%s: a denied accessibility permission does not block removing the open password',
    async (file) => {
      // PDF 2.0 deprecates the accessibility bit; the AES-256 copy cannot carry it
      const original = await inspectEncryption(fixture(`pdf/${file}`), PW.pdfUser);
      expect(original?.capabilities.accessibility).toBe(false);
      const r = await unlockPdf(fixture(`pdf/${file}`), PW.pdfUser);
      expect(r.mode).toBe('open-password-removed');
      const after = await inspectEncryption(r.data, '');
      expect(after).toMatchObject({ encrypted: true, userPasswordMatched: true, ownerPasswordMatched: false });
      for (const [k, allowed] of Object.entries(original!.capabilities)) {
        if (k !== 'accessibility' && !allowed) expect(after?.capabilities[k as keyof PdfCapabilities]).toBe(false);
      }
      expect(after?.capabilities.extract).toBe(false);
    },
  );

  it.each([
    'restricted-aes256.pdf',
    'restricted-aes128.pdf',
    'restricted-rc4.pdf',
    'restricted-rc4-noaccess.pdf',
    'restricted-rc4-40.pdf',
    'owner-only.pdf',
  ])('%s: owner password fully decrypts', async (file) => {
    const r = await unlockPdf(fixture(`pdf/${file}`), PW.pdfOwner);
    expect(r.mode).toBe('decrypted');
    expect((await inspectEncryption(r.data, ''))?.encrypted).toBe(false);
  });

  it('unlocks a file in which the producer left a stream unencrypted', async () => {
    // that stream does not inflate after decryption; it must not abort the unlock
    const file = fixture('pdf/unencrypted-stream-aes256.pdf');
    const restricted = await unlockPdf(file, PW.pdfUser);
    expect(restricted.mode).toBe('open-password-removed');
    expect((await inspectEncryption(restricted.data, ''))?.capabilities.extract).toBe(false);
    const full = await unlockPdf(file, PW.pdfOwner);
    expect(full.mode).toBe('decrypted');
    expect((await inspectEncryption(full.data, ''))?.encrypted).toBe(false);
    expect(new TextDecoder('latin1').decode(full.data)).toContain('(unpassword fixture)');
  });

  it('accepts the password regardless of how the producer encoded it', async () => {
    // R3/R4 fixtures store PDFDocEncoding bytes, R6 stores UTF-8
    for (const f of ['restricted-rc4.pdf', 'restricted-aes128.pdf', 'restricted-aes256.pdf']) {
      expect((await inspectEncryption(fixture(`pdf/${f}`), PW.pdfUser))?.userPasswordMatched).toBe(true);
      // decomposed umlaut (NFD) is the same typed password
      expect((await inspectEncryption(fixture(`pdf/${f}`), PW.pdfUser.normalize('NFD')))?.userPasswordMatched).toBe(
        true,
      );
    }
  });

  it('rejects a wrong password', async () => {
    expect(await errorCode(unlockPdf(fixture('pdf/restricted-aes256.pdf'), 'wrong'))).toBe('wrong-password');
  });

  it('refuses to lift owner-only restrictions without the owner password', async () => {
    expect(await errorCode(unlockPdf(fixture('pdf/owner-only.pdf'), 'anything'))).toBe('wrong-password');
  });

  it('reports unencrypted files', async () => {
    expect(await errorCode(unlockPdf(fixture('pdf/plain.pdf'), 'x'))).toBe('not-encrypted');
  });
});

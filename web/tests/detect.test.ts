import { describe, expect, it } from 'vitest';
import { detectFormat } from '../src/core/detect';
import { fixture } from './helpers';

describe('detectFormat', () => {
  it.each([
    ['pdf/plain.pdf', 'pdf'],
    ['pdf/restricted-aes256.pdf', 'pdf'],
    ['office/agile.docx', 'ooxml'],
    ['office/standard.docx', 'ooxml'],
    ['office/plain.docx', 'zip'],
    ['zip/aes.zip', 'zip'],
    ['zip/zipcrypto.zip', 'zip'],
  ])('%s → %s', (file, format) => {
    expect(detectFormat(fixture(file))).toBe(format);
  });

  it('rejects unknown data', () => {
    expect(detectFormat(new TextEncoder().encode('hello world'))).toBeNull();
  });

  it('finds %PDF- after leading junk', () => {
    const data = new Uint8Array([...new TextEncoder().encode('junk\n'), ...fixture('pdf/plain.pdf')]);
    expect(detectFormat(data)).toBe('pdf');
  });
});

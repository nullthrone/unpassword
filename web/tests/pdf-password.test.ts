import { describe, expect, it } from 'vitest';
import { passwordEncodings, toPdfDocEncoding } from '../src/core/pdf/password';

describe('PDF password encodings', () => {
  it('encodes Latin-1 and PDFDoc specials', () => {
    expect(Array.from(toPdfDocEncoding('aä€•')!)).toEqual([0x61, 0xe4, 0xa0, 0x80]);
  });

  it('returns null for unrepresentable characters', () => {
    expect(toPdfDocEncoding('密码')).toBeNull();
  });

  it('produces distinct encodings of the same input only', () => {
    expect(passwordEncodings('abc')).toEqual(['616263']);
    expect(passwordEncodings('ä')).toEqual(['c3a4', 'e4']);
  });
});

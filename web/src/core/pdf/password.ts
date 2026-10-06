/**
 * Byte encodings of the one password the user typed.
 *
 * PDF R2–R4 hash passwords as PDFDocEncoding bytes, R5/R6 as UTF-8 (after
 * SASLprep). Producers are not always consistent, and the qpdf WASM build does
 * not transcode non-ASCII input for R≤4. We therefore hand qpdf the same typed
 * password in each plausible encoding. This is not guessing: every variant is
 * a byte representation of the identical user input.
 */

// PDFDocEncoding bytes 0x80–0xA0 that differ from Latin-1 (ISO 32000-1, Annex D.2)
const PDFDOC_SPECIAL: Record<number, number> = {
  0x2022: 0x80,
  0x2020: 0x81,
  0x2021: 0x82,
  0x2026: 0x83,
  0x2014: 0x84,
  0x2013: 0x85,
  0x0192: 0x86,
  0x2044: 0x87,
  0x2039: 0x88,
  0x203a: 0x89,
  0x2212: 0x8a,
  0x2030: 0x8b,
  0x201e: 0x8c,
  0x201c: 0x8d,
  0x201d: 0x8e,
  0x2018: 0x8f,
  0x2019: 0x90,
  0x201a: 0x91,
  0x2122: 0x92,
  0xfb01: 0x93,
  0xfb02: 0x94,
  0x0141: 0x95,
  0x0152: 0x96,
  0x0160: 0x97,
  0x0178: 0x98,
  0x017d: 0x99,
  0x0131: 0x9a,
  0x0142: 0x9b,
  0x0153: 0x9c,
  0x0161: 0x9d,
  0x017e: 0x9e,
  0x20ac: 0xa0,
};

/** PDFDocEncoding of `s`, or `null` if a character is not representable. */
export function toPdfDocEncoding(s: string): Uint8Array | null {
  const out: number[] = [];
  for (const ch of s.normalize('NFC')) {
    const cp = ch.codePointAt(0)!;
    if ((cp >= 0x20 && cp <= 0x7e) || (cp >= 0xa1 && cp <= 0xff && cp !== 0xad)) out.push(cp);
    else if (cp in PDFDOC_SPECIAL) out.push(PDFDOC_SPECIAL[cp]);
    else return null;
  }
  return Uint8Array.from(out);
}

function hex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Distinct hex-encoded byte representations of `password`, most likely first. */
export function passwordEncodings(password: string): string[] {
  const utf8 = new TextEncoder();
  const candidates = [
    utf8.encode(password.normalize('NFC')),
    toPdfDocEncoding(password),
    utf8.encode(password.normalize('NFKC')),
    utf8.encode(password),
  ];
  return [...new Set(candidates.filter((c): c is Uint8Array => c !== null).map(hex))];
}

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { setQpdfWasmLocation } from '../src/core/pdf/qpdf';

const require = createRequire(import.meta.url);

export function fixture(path: string): Uint8Array {
  return new Uint8Array(readFileSync(join(import.meta.dirname, 'fixtures', path)));
}

export function useNodeQpdf(): void {
  setQpdfWasmLocation(require.resolve('@neslinesli93/qpdf-wasm/dist/qpdf.wasm'));
}

export const PW = {
  pdfUser: 'user-Pässwort1',
  pdfOwner: 'owner-Pässwort2',
  office: 'Büro-Geheim 42',
  officeStandard: 'Password1234_',
  zip: 'zip-Geheim3',
} as const;

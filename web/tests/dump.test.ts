/**
 * Writes unlocked outputs to $UNPASSWORD_DUMP for an independent cross-check
 * with other tools (scripts/crosscheck.py). Skipped unless the variable is set.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, it } from 'vitest';
import { unlock } from '../src/core/index';
import { PW, fixture, useNodeQpdf } from './helpers';

const dir = process.env.UNPASSWORD_DUMP;

const cases: [string, string][] = [
  ['pdf/user-aes256.pdf', PW.pdfUser],
  ['pdf/restricted-aes256.pdf', PW.pdfUser],
  ['pdf/restricted-aes128.pdf', PW.pdfUser],
  ['pdf/restricted-rc4.pdf', PW.pdfUser],
  ['pdf/restricted-rc4.pdf', PW.pdfOwner],
  ['pdf/owner-only.pdf', PW.pdfOwner],
  ['office/agile.docx', PW.office],
  ['office/standard.docx', PW.officeStandard],
  ['office/office-agile.docx', PW.officeStandard],
  ['office/office-agile.xlsx', PW.officeStandard],
  ['zip/zipcrypto.zip', PW.zip],
  ['zip/aes.zip', PW.zip],
  ['zip/partial.zip', PW.zip],
];

describe.skipIf(!dir)('dump unlocked outputs', () => {
  beforeAll(() => {
    useNodeQpdf();
    mkdirSync(dir!, { recursive: true });
  });
  it.each(cases)('%s', async (file, password) => {
    const r = await unlock(fixture(file), password);
    const which = password === PW.pdfOwner ? 'owner' : 'user';
    const name = `${file.replace('/', '__')}.${which}.${r.mode}`;
    writeFileSync(join(dir!, name), r.data);
  });
});

// Runs the add-on's attachment detection against the shared fixtures (node --test).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';

const ctx = {};
vm.runInNewContext(readFileSync(join(import.meta.dirname, 'Code.js'), 'utf8'), ctx);
const fixtures = join(import.meta.dirname, '..', 'web', 'tests', 'fixtures');
// Apps Script hands out bytes as signed Java bytes
const bytes = (p) => Array.from(readFileSync(join(fixtures, p)), (b) => (b > 127 ? b - 256 : b));

test('detects protected attachments', () => {
  assert.equal(ctx.detectProtected_(bytes('pdf/restricted-aes256.pdf')), 'pdf');
  assert.equal(ctx.detectProtected_(bytes('pdf/owner-only.pdf')), 'pdf');
  assert.equal(ctx.detectProtected_(bytes('office/agile.docx')), 'ooxml');
  assert.equal(ctx.detectProtected_(bytes('office/standard.docx')), 'ooxml');
  assert.equal(ctx.detectProtected_(bytes('zip/zipcrypto.zip')), 'zip');
  assert.equal(ctx.detectProtected_(bytes('zip/aes.zip')), 'zip');
  assert.equal(ctx.detectProtected_(bytes('zip/partial.zip')), 'zip');
});

test('ignores unprotected attachments', () => {
  assert.equal(ctx.detectProtected_(bytes('pdf/plain.pdf')), null);
  assert.equal(ctx.detectProtected_(bytes('office/plain.docx')), null);
  assert.equal(ctx.detectProtected_(bytes('zip/plain.zip')), null);
});

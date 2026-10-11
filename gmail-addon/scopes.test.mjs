// Keeps the OAuth scopes in step 3 of docs/SETUP.md, the add-on manifest and the web app in
// agreement (node --test). The Marketplace review rejects the listing when the scopes the code
// requests differ from those on the consent screen and in the Marketplace SDK.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

const root = join(import.meta.dirname, '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

/** Rows of the scope table in SETUP.md step 3: [{ scope, usedBy }]. */
function documentedScopes() {
  const setup = read('docs/SETUP.md');
  const step3 = setup.slice(setup.indexOf('## 3. '), setup.indexOf('## 4. '));
  return [...step3.matchAll(/^\| `(https:\/\/www\.googleapis\.com\/auth\/[^`]+)` \| ([^|]+) \|/gm)].map((m) => ({
    scope: m[1],
    usedBy: m[2].trim(),
  }));
}

const sorted = (xs) => [...xs].sort();

test('the scope table lists each scope once', () => {
  const scopes = documentedScopes().map((r) => r.scope);
  assert.ok(scopes.length > 0, 'no scope table found in SETUP.md step 3');
  assert.deepEqual(sorted(new Set(scopes)), sorted(scopes));
});

test('the add-on manifest requests exactly the documented add-on scopes', () => {
  const manifest = JSON.parse(read('gmail-addon/appsscript.json'));
  const documented = documentedScopes()
    .filter((r) => /\badd-on\b/i.test(r.usedBy))
    .map((r) => r.scope);
  assert.deepEqual(sorted(manifest.oauthScopes), sorted(documented));
});

test('the web app requests exactly the documented web app scopes', () => {
  const config = read('web/src/google/config.ts');
  const requested = [...config.matchAll(/'(https:\/\/www\.googleapis\.com\/auth\/[^']+)'/g)].map((m) => m[1]);
  const documented = documentedScopes()
    .filter((r) => /\bweb app\b/i.test(r.usedBy))
    .map((r) => r.scope);
  assert.deepEqual(sorted(requested), sorted(documented));
});

test('step 8 names the number of scopes in step 3', () => {
  const words = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
  const m = read('docs/SETUP.md').match(/\| OAuth scopes \| Exactly the (\w+) scopes from step 3 \|/);
  assert.ok(m, 'OAuth scopes row missing in SETUP.md step 8');
  assert.equal(words.indexOf(m[1]), documentedScopes().length);
});

// Unit tests for the docs drift check (node --test scripts/docs-drift.test.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluate, matches, optOut, RULES } from './docs-drift.mjs';

const ids = (drift) => drift.map((d) => d.rule.id);

test('glob subset', () => {
  assert.ok(matches('web/src/core/**', 'web/src/core/pdf/index.ts'));
  assert.ok(matches('web/src/*.ts', 'web/src/i18n.ts'));
  assert.ok(!matches('web/src/*.ts', 'web/src/ui/app.ts'));
  assert.ok(!matches('web/index.html', 'web/indexXhtml'));
});

test('code change without docs drifts', () => {
  assert.deepEqual(ids(evaluate(['web/src/core/pdf/index.ts'])), ['formats']);
  assert.deepEqual(ids(evaluate(['web/src/core/guard.ts'])), ['formats', 'guardrails']);
});

test('any listed document satisfies a rule', () => {
  assert.deepEqual(evaluate(['web/src/core/pdf/index.ts', 'docs/SECURITY.md']), []);
  assert.deepEqual(ids(evaluate(['web/src/google/drive.ts', 'README.md'])), ['trust-boundaries']);
});

test('changes outside documented areas pass', () => {
  const changed = ['web/tests/pdf.test.ts', 'web/src/styles.css', 'scripts/gen-fixtures.py'];
  assert.deepEqual(evaluate(changed), []);
});

test('dependency rule fires only when runtime dependencies are added or removed', () => {
  const pkg = (deps) => JSON.stringify({ dependencies: deps, devDependencies: { vite: '1' } });
  const ctx = (before, after) => ({
    base: 'b',
    head: 'h',
    show: (ref) => (ref === 'b' ? pkg(before) : pkg(after)),
  });
  const changed = ['web/package.json'];
  assert.deepEqual(evaluate(changed, ctx({ a: '^1' }, { a: '^2' })), []);
  const added = ctx({ a: '^1' }, { a: '^1', b: '^1' });
  assert.deepEqual(ids(evaluate(changed, added)), ['dependencies']);
});

test('opt-out needs a reason', () => {
  assert.deepEqual(optOut(['Fix typo\n\nDocs-Impact: none – internal refactor']), {
    reason: 'internal refactor',
  });
  assert.deepEqual(optOut(['', '- Docs-Impact: none (tests only)']), { reason: '(tests only)' });
  assert.deepEqual(optOut(['Docs-Impact: none']), { missingReason: true });
  assert.equal(optOut(['Docs-Impact: README updated', undefined]), null);
});

test('every rule names existing documents', async () => {
  const { existsSync } = await import('node:fs');
  const { join } = await import('node:path');
  for (const rule of RULES)
    for (const doc of rule.docs) assert.ok(existsSync(join(import.meta.dirname, '..', doc)), doc);
});

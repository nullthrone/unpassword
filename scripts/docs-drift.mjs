// Docs drift check: fails when a change touches documented behaviour without updating the
// documents that describe it, unless the change declares that it has no documentation impact.
//
//   node scripts/docs-drift.mjs --base <ref> [--head <ref>]   CI and manual runs
//   node scripts/docs-drift.mjs --hook                        Claude Code PreToolUse hook (stdin)
//
// Opt-out, with a reason, in a commit message or the pull request description (env PR_BODY):
//   Docs-Impact: none – <reason>
// The threshold behind RULES is described in CONTRIBUTING.md#documentation.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';

/**
 * Code areas whose behaviour a document describes. A rule fires when a changed file matches
 * `when` (and `test`, if present); it is satisfied when any file in `docs` changed as well.
 */
export const RULES = [
  {
    id: 'formats',
    when: ['web/src/core/**'],
    docs: ['README.md', 'docs/SECURITY.md', 'site/index.html'],
    why: 'supported formats, protection handling and results (README, landing page, SECURITY)',
  },
  {
    id: 'guardrails',
    when: [
      'web/src/core/guard.ts',
      'web/src/core/session.ts',
      'web/tests/guardrails.test.ts',
      'web/eslint.config.js',
    ],
    docs: ['README.md', 'docs/SECURITY.md', 'site/index.html'],
    why: 'anti-misuse guarantees and their enforcement (README Guardrails, SECURITY)',
  },
  {
    id: 'trust-boundaries',
    when: ['web/src/google/**', 'web/src/worker.ts', 'web/vite.config.ts', 'web/index.html'],
    docs: ['docs/SECURITY.md', 'docs/PRIVACY.md'],
    why: 'data flows, CSP, OAuth scopes and worker isolation (SECURITY, PRIVACY)',
  },
  {
    id: 'user-flows',
    when: ['web/src/ui/**', 'web/src/i18n.ts', 'web/src/files.ts', 'web/src/unlocker.ts'],
    docs: ['README.md', 'docs/SUPPORT.md'],
    why: 'user-visible flows, messages and result file names (README How it works, SUPPORT)',
  },
  {
    id: 'gmail-addon',
    when: ['gmail-addon/Code.js', 'gmail-addon/appsscript.json'],
    docs: ['README.md', 'docs/PRIVACY.md', 'docs/SETUP.md'],
    why: 'add-on behaviour, scopes and deployment (README, PRIVACY, SETUP)',
  },
  {
    id: 'deployment',
    when: ['.github/workflows/pages.yml', 'web/scripts/checksums.mjs', 'web/src/google/config.ts'],
    docs: ['README.md', 'docs/SETUP.md'],
    why: 'build variables, deployment and verification (README, SETUP)',
  },
  {
    id: 'dependencies',
    when: ['web/package.json'],
    docs: ['THIRD_PARTY_NOTICES.md'],
    why: 'bundled third-party components and their licenses (THIRD_PARTY_NOTICES)',
    // only runtime dependencies are bundled; version bumps and dev tooling change no document
    test: (ctx) => keysChanged(ctx, 'web/package.json', 'dependencies'),
  },
];

const OPT_OUT = /^[ \t>*-]*Docs-Impact:[ \t]*none\b[ \t:,;–—-]*(.*)$/gim;

/** Glob subset: `**` spans directories, `*` stays within one path segment. */
export function matches(pattern, file) {
  const re = pattern
    .split('**')
    .map((part) =>
      part
        .split('*')
        .map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
        .join('[^/]*'),
    )
    .join('.*');
  return new RegExp(`^${re}$`).test(file);
}

/** Opt-out declared in commit messages or the PR description: { reason } or { missingReason }. */
export function optOut(texts) {
  let missingReason = false;
  for (const text of texts) {
    for (const m of (text ?? '').matchAll(OPT_OUT)) {
      const reason = m[1].trim();
      if (reason) return { reason };
      missingReason = true;
    }
  }
  return missingReason ? { missingReason } : null;
}

function keysChanged(ctx, path, field) {
  const keys = (ref) => {
    try {
      return Object.keys(JSON.parse(ctx.show(ref, path))[field] ?? {}).sort().join('\n');
    } catch {
      return ''; // file absent on this side
    }
  };
  return keys(ctx.base) !== keys(ctx.head);
}

/** Rules that fire for `changed` and are not satisfied by a documentation change. */
export function evaluate(changed, ctx = {}, rules = RULES) {
  return rules.flatMap((rule) => {
    const files = changed.filter((f) => rule.when.some((p) => matches(p, f)));
    if (!files.length || (rule.test && !rule.test(ctx))) return [];
    if (changed.some((f) => rule.docs.includes(f))) return [];
    return [{ rule, files }];
  });
}

export function report(drift, opt) {
  const lines = [
    'Docs drift: this change touches documented behaviour without updating its documentation.',
    '',
  ];
  for (const { rule, files } of drift) {
    lines.push(`  ${rule.id}: ${rule.why}`);
    lines.push(`    changed: ${files.join(', ')}`);
    lines.push(`    update one of: ${rule.docs.join(', ')}`);
  }
  lines.push(
    '',
    'Update the documentation in this change. If the change does not alter what those',
    'documents describe, say so with a reason, as a commit message trailer or in the pull',
    'request description:',
    '',
    '  Docs-Impact: none – <reason>',
    '',
    'Threshold: CONTRIBUTING.md#documentation',
  );
  if (opt?.missingReason) lines.push('', 'Found "Docs-Impact: none" without a reason; add one.');
  return lines.join('\n');
}

const git = (...args) =>
  execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });

/** Runs the check for base...head. Returns the report, or null when there is no drift. */
export function check({ base, head = 'HEAD', prBody = '' }) {
  const changed = git('diff', '--name-only', `${base}...${head}`).split('\n').filter(Boolean);
  const messages = git('log', '--format=%B%x00', `${base}..${head}`).split('\0');
  const opt = optOut([prBody, ...messages]);
  if (opt?.reason) return null;
  const ctx = {
    base: git('merge-base', base, head).trim(),
    head,
    show: (ref, p) => git('show', `${ref}:${p}`),
  };
  const drift = evaluate(changed, ctx);
  return drift.length ? report(drift, opt) : null;
}

function mergeBase(ref) {
  try {
    return git('merge-base', 'HEAD', ref).trim();
  } catch {
    return '';
  }
}

/** Claude Code PreToolUse hook: blocks `git push` and PR creation while docs drift. */
function hook() {
  const input = JSON.parse(readFileSync(0, 'utf8'));
  const tool = input.tool_name ?? '';
  const args = input.tool_input ?? {};
  let prBody = '';
  if (tool === 'Bash') {
    if (!/\bgit\b[^;&|\n]*\spush\b/.test(args.command ?? '')) return 0;
  } else if (/create_pull_request$/.test(tool)) {
    prBody = args.body ?? '';
  } else {
    return 0;
  }
  if (input.cwd) process.chdir(input.cwd);
  const base = ['origin/HEAD', 'origin/main'].map(mergeBase).find(Boolean);
  if (!base) return 0; // no default branch to compare against; CI still enforces the check
  const result = check({ base, prBody });
  if (!result) return 0;
  process.stderr.write(`${result}\n`);
  return 2; // blocks the tool call and hands the report to Claude
}

function main() {
  const { values } = parseArgs({
    options: { base: { type: 'string' }, head: { type: 'string' }, hook: { type: 'boolean' } },
  });
  if (values.hook) return hook();
  if (!values.base) throw new Error('--base <ref> is required');
  const result = check({ base: values.base, head: values.head, prBody: process.env.PR_BODY });
  if (!result) {
    console.log('No docs drift.');
    return 0;
  }
  console.log(result);
  if (process.env.GITHUB_ACTIONS)
    console.log('::error title=Docs drift::Documentation not updated, see log');
  return 1;
}

if (import.meta.url === `file://${process.argv[1]}`) process.exitCode = main();

/**
 * Static guardrails: unpassword must never grow features that guess or
 * enumerate passwords, persist secrets or talk to third parties.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = join(import.meta.dirname, '..', 'src');

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? files(p) : p.endsWith('.ts') ? [p] : [];
  });
}

const sources = files(SRC).map((p) => ({ path: relative(SRC, p), text: readFileSync(p, 'utf8') }));

describe('guardrails', () => {
  it.each([
    // zip.js password-candidate / prompt-loop features (filesystem API)
    [/\bpasswords\s*:/, 'zip.js password candidate lists'],
    [/\brequestPassword\b/, 'zip.js password request loops'],
    [/@zip\.js\/zip\.js\/.*fs|\bzip\.fs\b|\bfs\.ZipFS\b/, 'zip.js filesystem API'],
    [/recovereduserpassword/i, 'recovering user passwords from owner passwords'],
    [/wordlist|dictionary attack|brute.?force/i, 'password guessing'],
    [/hashcat|john ?the ?ripper/i, 'exporting crackable hashes'],
  ])('source contains no %s (%s)', (pattern) => {
    const hits = sources.filter((s) => pattern.test(s.text)).map((s) => s.path);
    expect(hits).toEqual([]);
  });

  it('core never touches the network', () => {
    const hits = sources
      .filter((s) => s.path.startsWith('core'))
      .filter((s) => /\bfetch\(|XMLHttpRequest|WebSocket|sendBeacon|EventSource/.test(s.text))
      .map((s) => s.path);
    expect(hits).toEqual([]);
  });

  it('network access is confined to the Google API module', () => {
    const hits = sources
      .filter((s) => /\bfetch\(/.test(s.text))
      .map((s) => s.path)
      .filter((p) => p !== 'google/drive.ts');
    expect(hits).toEqual([]);
  });

  it('only Google endpoints are referenced', () => {
    const urls = sources.flatMap((s) => [...s.text.matchAll(/https:\/\/[^\s'"`)]+/g)].map((m) => m[0]));
    const foreign = urls.filter(
      (u) =>
        !/^https:\/\/(www\.googleapis\.com|accounts\.google\.com|apis\.google\.com|docs\.google\.com|drive\.google\.com)\//.test(
          u,
        ) &&
        !/^https:\/\/schemas\.(microsoft|openxmlformats)\.(com|org)\//.test(u) &&
        u !== 'https://github.com/nullthrone/unpassword',
    );
    expect(foreign).toEqual([]);
  });
});

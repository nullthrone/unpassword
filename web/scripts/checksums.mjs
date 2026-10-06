// Writes dist/SHA256SUMS.txt so anyone can compare the deployed site with a local build.
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const dist = join(import.meta.dirname, '..', 'dist');
const files = (dir) =>
  readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? files(p) : [p];
  });

const lines = files(dist)
  .filter((p) => !p.endsWith('SHA256SUMS.txt'))
  .map((p) => `${createHash('sha256').update(readFileSync(p)).digest('hex')}  ${relative(dist, p)}`)
  .sort((a, b) => a.slice(66).localeCompare(b.slice(66)));
writeFileSync(join(dist, 'SHA256SUMS.txt'), lines.join('\n') + '\n');
console.log(lines.join('\n'));

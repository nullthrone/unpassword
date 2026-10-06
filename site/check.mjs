// Static checks for the built site (../_site or --dir DIR):
// - every page has a CSP meta tag and a <title>
// - no page loads a resource from another origin (src, stylesheet, icon)
// - every internal link and anchor resolves
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, normalize, relative } from "node:path";
import { parseArgs } from "node:util";

const { values: args } = parseArgs({ options: { dir: { type: "string" } } });
const DIR = normalize(args.dir ?? join(import.meta.dirname, "..", "_site"));
/** Generated at deploy time, not present in local builds. */
const DEPLOY_ONLY = new Set(["SHA256SUMS.txt"]);

function htmlFiles(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory())
      return relative(DIR, p) === "app" ? [] : htmlFiles(p);
    return p.endsWith(".html") ? [p] : [];
  });
}

const errors = [];
const ids = new Map();
const files = htmlFiles(DIR);
for (const f of files)
  ids.set(
    f,
    new Set(
      [...readFileSync(f, "utf8").matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]),
    ),
  );

function resolveTarget(from, url) {
  const [path, hash] = url.split("#");
  let target = path ? normalize(join(dirname(from), path)) : from;
  if (
    path.endsWith("/") ||
    (existsSync(target) && statSync(target).isDirectory())
  )
    target = join(target, "index.html");
  return { target, hash };
}

for (const f of files) {
  const rel = relative(DIR, f);
  const html = readFileSync(f, "utf8");
  if (!/<meta http-equiv="Content-Security-Policy"/.test(html))
    errors.push(`${rel}: missing CSP`);
  if (!/<title>[^<]+<\/title>/.test(html))
    errors.push(`${rel}: missing <title>`);
  if (/<script\b/i.test(html)) errors.push(`${rel}: contains a <script>`);

  for (const m of html.matchAll(
    /<(img|script|source|iframe)\b[^>]*\ssrc="([^"]+)"/g,
  )) {
    if (/^(https?:)?\/\//.test(m[2]))
      errors.push(`${rel}: external resource ${m[2]}`);
  }
  for (const m of html.matchAll(/<link\b[^>]*\shref="([^"]+)"/g)) {
    if (/^(https?:)?\/\//.test(m[1]))
      errors.push(`${rel}: external resource ${m[1]}`);
  }
  if (rel === "404.html") continue; // absolute /unpassword/ links, checked via the other pages
  for (const m of html.matchAll(/<a\b[^>]*\shref="([^"]+)"/g)) {
    const href = m[1];
    if (/^(https?:|mailto:)/.test(href)) continue;
    const { target, hash } = resolveTarget(f, href);
    if (DEPLOY_ONLY.has(relative(DIR, target))) continue;
    if (relative(DIR, target).startsWith("app/")) {
      if (!existsSync(join(DIR, "app"))) continue; // app copied only with --app
    }
    if (!existsSync(target)) {
      errors.push(`${rel}: broken link ${href}`);
      continue;
    }
    if (hash && target.endsWith(".html") && !ids.get(target)?.has(hash))
      errors.push(`${rel}: missing anchor ${href}`);
  }
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log(`site ok: ${files.length} pages checked in ${DIR}`);

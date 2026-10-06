// Builds the unpassword documentation site into ../_site (or --out DIR).
// Sources: site/index.html (landing page), docs/*.md (rendered into the page
// template), design/ (tokens, fonts, brand assets). Optionally copies a built
// web app into <out>/app (--app DIR). The output contains no JavaScript.
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, normalize, posix } from "node:path";
import { parseArgs } from "node:util";
import { Marked } from "marked";

const ROOT = join(import.meta.dirname, "..");
const REPO = "https://github.com/nullthrone/unpassword";
export const SITE_URL = "https://nullthrone.github.io/unpassword/";

const { values: args } = parseArgs({
  options: { out: { type: "string" }, app: { type: "string" } },
});
const OUT = args.out ? normalize(args.out) : join(ROOT, "_site");

/** Markdown documents published as pages: repo path → route and page eyebrow. */
export const DOCS = [
  {
    src: "docs/SECURITY.md",
    route: "security",
    eyebrow: "Security model",
    nav: "Security",
  },
  {
    src: "docs/PRIVACY.md",
    route: "privacy",
    eyebrow: "Policy",
    nav: "Privacy",
  },
  { src: "docs/TERMS.md", route: "terms", eyebrow: "Policy" },
  {
    src: "docs/SETUP.md",
    route: "setup",
    eyebrow: "Documentation",
    nav: "Setup",
  },
  { src: "docs/SUPPORT.md", route: "support", eyebrow: "Help", nav: "Support" },
  { src: "docs/IMPRINT.md", route: "imprint", eyebrow: "Legal" },
];

const CSP = [
  "default-src 'self'",
  "script-src 'none'",
  "style-src 'self'",
  "img-src 'self' data:",
  "font-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-src 'none'",
].join("; ");

const esc = (s) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
const read = (p) => readFileSync(join(ROOT, p), "utf8");

function slug(text) {
  return text
    .toLowerCase()
    .replace(/<[^>]+>/g, "")
    .replace(/&[a-z]+;/g, "")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

/** Rewrites a link found in a repo file to its published location. */
function rewriteHref(href, fromRepoPath, depth) {
  if (/^([a-z]+:|#|\/\/)/i.test(href)) return href;
  const [path, hash = ""] = href.split("#");
  const anchor = hash ? `#${hash}` : "";
  const target = posix.normalize(posix.join(posix.dirname(fromRepoPath), path));
  const prefix = "../".repeat(depth);
  const doc = DOCS.find((d) => d.src === target);
  if (doc) return `${prefix}${doc.route}/${anchor}`;
  if (target === "README.md") return `${prefix}${anchor}`;
  return `${REPO}/blob/main/${target}${anchor}`;
}

function renderMarkdown(src, depth) {
  const marked = new Marked({ gfm: true });
  marked.use({
    renderer: {
      heading({ tokens, depth: level }) {
        const html = this.parser.parseInline(tokens);
        const id = slug(html);
        return `<h${level} id="${id}">${html}</h${level}>\n`;
      },
      link({ href, title, tokens }) {
        const text = this.parser.parseInline(tokens);
        const out = rewriteHref(href, src, depth);
        const external = /^https?:/.test(out);
        return `<a href="${esc(out)}"${title ? ` title="${esc(title)}"` : ""}${external ? ' rel="noopener"' : ""}>${text}</a>`;
      },
    },
  });
  // wide tables scroll inside a wrapper instead of widening the page
  return marked
    .parse(read(src))
    .replaceAll("<table>", '<div class="table-wrap"><table>')
    .replaceAll("</table>", "</table></div>");
}

/** unpassword mark (small variant) as inline SVG, fills with currentColor. */
function inlineMark(file, size) {
  return read(`design/unpassword/${file}`)
    .replace(/\s*role="img"/, "")
    .replace(/\s*aria-label="[^"]*"/, "")
    .replace(
      "<svg ",
      `<svg width="${size}" height="${size}" aria-hidden="true" focusable="false" `,
    );
}

export function layout({
  title,
  description,
  depth,
  body,
  active = "",
  bodyClass = "",
}) {
  const p = "../".repeat(depth);
  const nav = [
    ["", "Overview"],
    ...DOCS.filter((d) => d.nav).map((d) => [`${d.route}/`, d.nav]),
  ];
  const navHtml = nav
    .map(
      ([href, label]) =>
        `<a href="${p}${href}"${active === href ? ' aria-current="page"' : ""}>${label}</a>`,
    )
    .join("");
  const pageTitle = title
    ? `${title} – unpassword`
    : "unpassword – remove passwords you already know";
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${CSP}">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="referrer" content="strict-origin">
<title>${esc(pageTitle)}</title>
<meta name="description" content="${esc(description)}">
<meta property="og:title" content="${esc(pageTitle)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:image" content="${SITE_URL}brand/social-card.png">
<meta property="og:type" content="website">
<link rel="icon" type="image/svg+xml" href="${p}brand/favicon.svg">
<link rel="icon" type="image/png" sizes="32x32" href="${p}brand/icon-32.png">
<link rel="stylesheet" href="${p}assets/site.css">
</head>
<body class="${bodyClass}">
<a class="skip" href="#content">Skip to content</a>
<header class="band">
  <div class="wrap band-inner">
    <a class="brand" href="${p}">${inlineMark("mark-small.svg", 26)}<span class="wordmark">unpassword</span><span class="byline">by Nullthrone</span></a>
    <nav class="nav" aria-label="Main">${navHtml}<a class="nav-app" href="${p}app/">Open app</a></nav>
  </div>
</header>
<main id="content">
${body}
</main>
<footer class="band footer">
  <div class="wrap footer-inner">
    <div class="footer-brand">${inlineMark("mark.svg", 40)}<div><div class="wordmark">unpassword</div><div class="byline">Open source · MIT license · by Nullthrone</div></div></div>
    <nav class="footer-nav" aria-label="Footer">
      <a href="${p}privacy/">Privacy</a><a href="${p}terms/">Terms</a><a href="${p}security/">Security</a><a href="${p}setup/">Setup</a><a href="${p}support/">Support</a><a href="${p}imprint/">Imprint</a><a href="${p}marketplace/">Brand assets</a><a href="${REPO}" rel="noopener">Source</a>
    </nav>
    <p class="footer-note">© 2026 Nullthrone · Thomas Sprock. Decryption happens in your browser. This site loads no scripts.</p>
  </div>
</footer>
</body>
</html>
`;
}

function docPage(doc) {
  const html = renderMarkdown(doc.src, 1);
  const m = html.match(/<h1 id="[^"]*">([\s\S]*?)<\/h1>\n?/);
  const title = m ? m[1].replace(/<[^>]+>/g, "") : doc.route;
  const content = m ? html.replace(m[0], "") : html;
  const body = `<article class="doc wrap-narrow">
  <p class="eyebrow">${esc(doc.eyebrow)}</p>
  <h1>${m ? m[1] : esc(title)}</h1>
  <div class="double-rule" aria-hidden="true"></div>
  <div class="prose">
${content}
  </div>
</article>`;
  return layout({
    title,
    description: `${title} of unpassword, the zero-knowledge tool to remove passwords you already know from PDF, Office and ZIP files.`,
    depth: 1,
    body,
    active: `${doc.route}/`,
  });
}

function marketplacePage() {
  const assets = [
    ["icon-32.png", "Icon 32 × 32"],
    ["icon-48.png", "Icon 48 × 48"],
    ["icon-96.png", "Icon 96 × 96"],
    ["icon-128.png", "Icon 128 × 128 (also the Gmail add-on logo)"],
    ["banner-220x140.png", "Card banner 220 × 140"],
    ["social-card.png", "Social card 1200 × 630"],
    ["screenshot-1-pick.png", "Screenshot 1280 × 800 – choose a file"],
    ["screenshot-2-password.png", "Screenshot 1280 × 800 – enter the password"],
    ["screenshot-3-result.png", "Screenshot 1280 × 800 – result"],
    ["mark.svg", "Mark (SVG, currentColor)"],
    ["favicon.svg", "Favicon (SVG, light/dark)"],
  ];
  const rows = assets
    .map(
      ([file, label]) =>
        `<li class="asset"><a href="../brand/${file}"><img src="../brand/${file}" alt="" loading="lazy"></a><span>${label}</span><code>brand/${file}</code></li>`,
    )
    .join("\n");
  const body = `<section class="wrap doc-wide">
  <p class="eyebrow">Google Workspace Marketplace</p>
  <h1>Brand assets</h1>
  <div class="double-rule" aria-hidden="true"></div>
  <p class="lede">Graphics for the Marketplace listing, generated from <code>design/unpassword</code> by <code>scripts/render-brand-assets.mjs</code>. The URLs the listing references are in the <a href="../setup/#5-marketplace-listing">setup guide</a>.</p>
  <ul class="assets">
${rows}
  </ul>
</section>`;
  return layout({
    title: "Brand assets",
    description:
      "Icons, banner and screenshots of unpassword for the Google Workspace Marketplace listing.",
    depth: 1,
    body,
    active: "marketplace/",
  });
}

/** Concatenates design tokens and site styles into one stylesheet (no @import chains). */
function stylesheet() {
  const files = [
    "fonts",
    "colors",
    "typography",
    "spacing",
    "effects",
    "motion",
    "base",
  ];
  const tokens = files
    .map((f) =>
      read(`design/nullthrone/tokens/${f}.css`).replaceAll(
        "url('../fonts/",
        "url('fonts/",
      ),
    )
    .join("\n");
  return `/* Generated by site/build.mjs – edit site/styles/site.css or design/nullthrone/tokens */\n${tokens}\n${read("site/styles/site.css")}`;
}

function write(rel, content) {
  const file = join(OUT, rel);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
}

export function build() {
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });

  write("index.html", layout({ ...landing(), depth: 0, active: "" }));
  for (const doc of DOCS) write(`${doc.route}/index.html`, docPage(doc));
  write("marketplace/index.html", marketplacePage());
  write(
    "404.html",
    layout({
      title: "Not found",
      description: "This page does not exist.",
      depth: 0,
      body: `<section class="wrap-narrow doc"><p class="eyebrow">404</p><h1>This page does not exist.</h1><div class="double-rule" aria-hidden="true"></div><p class="prose">Go to the <a href="/unpassword/">overview</a>.</p></section>`,
    }).replace(/(href|src)="(?!https?:|\/|#|mailto:)/g, '$1="/unpassword/'),
  );

  write("assets/site.css", stylesheet());
  cpSync(join(ROOT, "design/nullthrone/fonts"), join(OUT, "assets/fonts"), {
    recursive: true,
  });
  cpSync(join(ROOT, "design/unpassword/png"), join(OUT, "brand"), {
    recursive: true,
  });
  for (const f of ["mark.svg", "mark-small.svg", "favicon.svg"]) {
    cpSync(join(ROOT, "design/unpassword", f), join(OUT, "brand", f));
  }
  write(".nojekyll", "");

  if (args.app) {
    if (!existsSync(join(args.app, "index.html")))
      throw new Error(`no web app build in ${args.app}`);
    cpSync(args.app, join(OUT, "app"), { recursive: true });
  }
  console.log(`site written to ${OUT}`);
}

function landing() {
  const body = read("site/index.html")
    .replaceAll("{{MARK}}", inlineMark("mark.svg", 132))
    .replaceAll("{{REPO}}", REPO);
  return {
    title: "",
    description:
      "unpassword removes the password protection of PDF, Office and ZIP files whose password you know – entirely in your browser. Zero-knowledge, open source, for Google Workspace.",
    body,
    bodyClass: "home",
  };
}

if (import.meta.url === `file://${process.argv[1]}`) build();

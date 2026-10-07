// Renders unpassword's PNG brand assets and Marketplace screenshots into
// design/unpassword/png/. Uses the Playwright Chromium from web/node_modules.
//
//   cd web && npm run build && cd .. && node scripts/render-brand-assets.mjs
//
// Set PLAYWRIGHT_CHROMIUM_PATH to use a preinstalled Chromium binary.
import { createServer } from 'node:http';
import { mkdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { extname, join, normalize } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const OUT = join(ROOT, 'design/unpassword/png');
const require = createRequire(join(ROOT, 'web/package.json'));
const { chromium } = require('@playwright/test');

const INK = '#141317';
const PAPER = '#F4F2EC';
const BRASS = '#C09A4B';
const BRASS_ICON = '#A87E2F'; // --brass-500

const svg = (file) => readFileSync(join(ROOT, 'design/unpassword', file), 'utf8');
// Fonts inlined as data URIs: pages rendered via setContent may not load file:// URLs.
const fontsCss = readFileSync(join(ROOT, 'design/nullthrone/tokens/fonts.css'), 'utf8').replace(
  /url\('\.\.\/fonts\/([^']+)'\)/g,
  (_, f) => `url('data:font/woff2;base64,${readFileSync(join(ROOT, 'design/nullthrone/fonts', f)).toString('base64')}')`,
);

function page(width, height, inner, bg = 'transparent') {
  return `<!doctype html><html><head><style>${fontsCss}
    html,body{margin:0;width:${width}px;height:${height}px;background:${bg};overflow:hidden}
    .caps{font-family:'Jost';font-weight:500;text-transform:uppercase}
  </style></head><body>${inner}</body></html>`;
}

const browser = await chromium.launch(
  process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {},
);
mkdirSync(OUT, { recursive: true });

async function shot(name, width, height, html) {
  const p = await browser.newPage({ viewport: { width, height } });
  await p.setContent(html, { waitUntil: 'load' });
  await p.evaluate(() => document.fonts.ready);
  await p.screenshot({ path: join(OUT, name), omitBackground: true });
  await p.close();
  console.log(`  ${name}`);
}

// Icons: brass mark on a transparent background, as the Marketplace review requires.
// Brass (an allowed mark colour) stays legible on light and dark surfaces, e.g. Gmail's dark theme.
for (const size of [16, 32, 48, 96, 128]) {
  const file = size <= 32 ? 'mark-small.svg' : 'mark.svg';
  const pad = Math.max(1, Math.round(size * 0.06));
  const inner = `<div style="width:${size}px;height:${size}px;color:${BRASS_ICON};display:flex;align-items:center;justify-content:center">
    ${svg(file).replace('<svg ', `<svg width="${size - 2 * pad}" height="${size - 2 * pad}" `)}</div>`;
  await shot(`icon-${size}.png`, size, size, page(size, size, inner));
}

// Marketplace card banner 220 × 140
await shot(
  'banner-220x140.png',
  220,
  140,
  page(
    220,
    140,
    `<div style="height:140px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;color:${PAPER}">
      ${svg('mark.svg').replace('<svg ', '<svg width="56" height="56" ')}
      <div class="caps" style="font-size:13px;letter-spacing:0.22em">unpassword</div>
      <div style="display:flex;align-items:center;gap:8px"><span style="width:24px;border-top:1px solid ${BRASS}"></span><span class="caps" style="font-size:8px;letter-spacing:0.22em;color:${BRASS}">by Nullthrone</span><span style="width:24px;border-top:1px solid ${BRASS}"></span></div>
    </div>`,
    INK,
  ),
);

// Social card 1200 × 630
await shot(
  'social-card.png',
  1200,
  630,
  page(
    1200,
    630,
    `<div style="height:630px;display:grid;grid-template-columns:1fr 360px;align-items:center;padding:0 88px;color:${PAPER}">
      <div>
        <div class="caps" style="font-size:18px;letter-spacing:0.22em;color:${BRASS};margin-bottom:24px">Open source · Zero knowledge · by Nullthrone</div>
        <div style="font-family:'Jost';font-weight:500;font-size:72px;line-height:1.08;margin-bottom:28px">Remove passwords<br>you already know.</div>
        <div style="font-family:'Public Sans';font-size:26px;color:#B6B3B8">PDF · Office · ZIP, decrypted in your browser.</div>
      </div>
      <div style="display:flex;justify-content:center;border-left:1px solid #3A3740;height:380px;align-items:center">
        ${svg('mark.svg').replace('<svg ', '<svg width="240" height="240" ')}
      </div>
    </div>`,
    INK,
  ),
);

// Marketplace screenshots 1280 × 800 from the built web app (web/dist), English UI.
const dist = join(ROOT, 'web/dist');
if (!existsSync(join(dist, 'index.html'))) {
  console.log('  (skipping screenshots: build web/ first)');
} else {
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.wasm': 'application/wasm', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
  const server = createServer((req, res) => {
    let p = normalize(join(dist, decodeURIComponent(new URL(req.url, 'http://x').pathname)));
    if (!p.startsWith(dist)) return res.writeHead(403).end();
    if (existsSync(p) && statSync(p).isDirectory()) p = join(p, 'index.html');
    if (!existsSync(p)) return res.writeHead(404).end();
    res.writeHead(200, { 'Content-Type': types[extname(p)] ?? 'application/octet-stream' }).end(readFileSync(p));
  }).listen(0);
  const url = `http://localhost:${server.address().port}/`;
  const fixtures = join(ROOT, 'web/tests/fixtures');
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: 'en-US', colorScheme: 'light' });
  const p = await ctx.newPage();
  await p.goto(url);
  await p.evaluate(() => document.fonts.ready);
  await p.screenshot({ path: join(OUT, 'screenshot-1-pick.png') });
  await p.locator('#file').setInputFiles(join(fixtures, 'pdf/restricted-aes256.pdf'));
  await p.getByLabel('Current password').fill('user-Pässwort1');
  await p.getByLabel(/I am entitled/).check();
  await p.screenshot({ path: join(OUT, 'screenshot-2-password.png') });
  await p.getByRole('button', { name: 'Remove password protection' }).click();
  await p.getByText(/open password is removed/).waitFor();
  await p.screenshot({ path: join(OUT, 'screenshot-3-result.png') });
  console.log('  screenshot-1-pick.png, screenshot-2-password.png, screenshot-3-result.png');
  await ctx.close();
  server.close();
}

await browser.close();
console.log(`brand assets written to ${OUT}`);

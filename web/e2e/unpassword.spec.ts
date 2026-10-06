import { expect, test, type Page, type Request, type Route } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { inspectEncryption, setQpdfWasmLocation } from '../src/core/pdf/qpdf';

setQpdfWasmLocation(createRequire(import.meta.url).resolve('@neslinesli93/qpdf-wasm/dist/qpdf.wasm'));

const fixtures = join(import.meta.dirname, '..', 'tests', 'fixtures');
const fixture = (p: string) => readFileSync(join(fixtures, p));

const PDF_USER = 'user-Pässwort1';
const ZIP_PW = 'zip-Geheim3';

/** Records every request the page (and its workers) make. */
function recordRequests(page: Page): Request[] {
  const seen: Request[] = [];
  page.context().on('request', (r) => seen.push(r));
  return seen;
}

function assertNoLeak(requests: Request[], password: string, allowedHosts: string[]) {
  for (const r of requests) {
    const url = new URL(r.url());
    if (url.protocol === 'data:' || url.protocol === 'blob:') continue;
    expect(allowedHosts, `unexpected host for ${r.url()}`).toContain(url.host);
    expect(decodeURIComponent(r.url())).not.toContain(password);
    const body = r.postDataBuffer();
    if (body) expect(body.toString('latin1')).not.toContain(password);
    if (body) expect(body.toString('utf8')).not.toContain(password);
  }
}

async function unlock(page: Page, password: string) {
  await page.getByLabel('Bisheriges Passwort').fill(password);
  const attest = page.getByLabel(/Ich bin berechtigt/);
  if (!(await attest.isChecked())) await attest.check();
  await page.getByRole('button', { name: 'Passwortschutz entfernen' }).click();
}

test('local mode: PDF with open password and restrictions', async ({ page }) => {
  const requests = recordRequests(page);
  await page.goto('./');
  await page.locator('#file').setInputFiles(join(fixtures, 'pdf/restricted-aes256.pdf'));
  await expect(page.getByText('restricted-aes256.pdf')).toBeVisible();

  await unlock(page, 'falsch');
  await expect(page.getByText(/Das Passwort ist falsch\. Noch 9 Versuche\./)).toBeVisible();

  await unlock(page, PDF_USER);
  await expect(page.getByText(/Der Öffnen-Schutz ist entfernt/)).toBeVisible();

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Herunterladen' }).click(),
  ]);
  expect(download.suggestedFilename()).toBe('restricted-aes256 (entsperrt).pdf');
  const out = new Uint8Array(readFileSync((await download.path())!));
  // opens without a password, restrictions intact
  const info = await inspectEncryption(out, '');
  expect(info).toMatchObject({ encrypted: true, userPasswordMatched: true });
  expect(info?.capabilities).toMatchObject({ extract: false, printhigh: false, modifyassembly: false });

  // local mode: nothing but this origin, and no Google script was loaded
  assertNoLeak(requests, PDF_USER, ['localhost:4173']);
});

test('local mode: ZIP and Office files', async ({ page }) => {
  const requests = recordRequests(page);
  await page.goto('./');
  await page.locator('#file').setInputFiles(join(fixtures, 'zip/aes.zip'));
  await unlock(page, ZIP_PW);
  await expect(page.getByText(/nicht mehr passwortgeschützt/)).toBeVisible();

  await page.getByRole('button', { name: 'Andere Datei' }).click();
  await page.locator('#file').setInputFiles(join(fixtures, 'office/office-agile.xlsx'));
  await unlock(page, 'Password1234_');
  await expect(page.getByText(/nicht mehr passwortgeschützt/)).toBeVisible();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Herunterladen' }).click(),
  ]);
  expect(download.suggestedFilename()).toBe('office-agile (entsperrt).xlsx');
  expect(
    readFileSync((await download.path())!)
      .subarray(0, 2)
      .toString(),
  ).toBe('PK');

  assertNoLeak(requests, ZIP_PW, ['localhost:4173']);
});

test('rate limiting: cooldown after the third failure', async ({ page }) => {
  await page.goto('./');
  await page.locator('#file').setInputFiles(join(fixtures, 'zip/zipcrypto.zip'));
  await unlock(page, 'a');
  await unlock(page, 'b');
  await unlock(page, 'c');
  await expect(page.getByText(/Nächster Versuch in \d+ s\./)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Passwortschutz entfernen' })).toBeDisabled();
});

test('refuses files without password protection', async ({ page }) => {
  await page.goto('./');
  await page.locator('#file').setInputFiles(join(fixtures, 'pdf/plain.pdf'));
  await unlock(page, 'irgendwas');
  await expect(page.getByText(/nicht passwortgeschützt/)).toBeVisible();
});

test('the built page carries a restrictive CSP', async ({ page }) => {
  await page.goto('./');
  const csp = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content');
  expect(csp).toContain("default-src 'self'");
  expect(csp).toContain("connect-src 'self' https://www.googleapis.com");
});

// ----------------------------------------------------------------- Drive flow

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': 'GET, POST, PUT, PATCH, OPTIONS',
  'access-control-expose-headers': 'Location',
};

const GIS_STUB = `
window.google = window.google || {};
google.accounts = { oauth2: { initTokenClient(cfg) {
  if (cfg.scope !== 'https://www.googleapis.com/auth/drive.file') throw new Error('unexpected scope ' + cfg.scope);
  return { requestAccessToken() { setTimeout(() => cfg.callback({ access_token: 'e2e-token', expires_in: 3600 }), 0); } };
} } };`;

test('Drive mode: open from Gmail add-on link, unlock, save back to Drive', async ({ page }) => {
  const requests = recordRequests(page);
  const uploads: { meta?: unknown; body?: Buffer } = {};
  let trashed = false;

  await page.route('https://accounts.google.com/gsi/client', (route) =>
    route.fulfill({ contentType: 'text/javascript', body: GIS_STUB }),
  );
  await page.route('https://www.googleapis.com/**', async (route: Route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    expect(req.headers()['authorization']).toBe('Bearer e2e-token');
    const url = new URL(req.url());
    if (url.pathname === '/drive/v3/files/FILE1' && url.searchParams.get('alt') === 'media') {
      return route.fulfill({ headers: CORS, body: fixture('zip/aes.zip') });
    }
    if (url.pathname === '/drive/v3/files/FILE1' && req.method() === 'GET') {
      return route.fulfill({
        headers: CORS,
        json: { id: 'FILE1', name: 'Lohnabrechnung.zip', mimeType: 'application/zip', parents: ['FOLDER'] },
      });
    }
    if (url.pathname === '/drive/v3/files/FILE1' && req.method() === 'PATCH') {
      trashed = JSON.parse(req.postData()!).trashed === true;
      return route.fulfill({ headers: CORS, json: { id: 'FILE1' } });
    }
    if (url.pathname === '/upload/drive/v3/files' && req.method() === 'POST') {
      uploads.meta = JSON.parse(req.postData()!);
      return route.fulfill({
        headers: {
          ...CORS,
          Location: 'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&upload_id=U1',
        },
        body: '',
      });
    }
    if (url.pathname === '/upload/drive/v3/files' && req.method() === 'PUT') {
      uploads.body = req.postDataBuffer()!;
      return route.fulfill({ headers: CORS, json: { id: 'NEW1', name: 'Lohnabrechnung (entsperrt).zip' } });
    }
    return route.fulfill({ status: 404, headers: CORS, body: 'unexpected' });
  });

  await page.goto('./#/drive?fileId=FILE1');
  await expect(page.getByText('Lohnabrechnung.zip')).toBeVisible();
  await unlock(page, ZIP_PW);
  await expect(page.getByText(/nicht mehr passwortgeschützt/)).toBeVisible();

  await page.getByLabel(/Originaldatei in den Papierkorb/).check();
  await page.getByRole('button', { name: 'In Google Drive speichern' }).click();
  await expect(page.getByText(/Gespeichert: Lohnabrechnung \(entsperrt\)\.zip/)).toBeVisible();

  expect(uploads.meta).toEqual({
    name: 'Lohnabrechnung (entsperrt).zip',
    mimeType: 'application/zip',
    parents: ['FOLDER'],
    appProperties: { unpassword: 'unlocked' },
  });
  // the uploaded archive is the decrypted one: a ZIP whose general purpose flag has no encryption bit
  expect(uploads.body!.subarray(0, 4).toString('latin1')).toBe('PK\x03\x04');
  expect(uploads.body!.readUInt16LE(6) & 1).toBe(0);
  expect(trashed).toBe(true);

  assertNoLeak(requests, ZIP_PW, ['localhost:4173', 'accounts.google.com', 'www.googleapis.com']);
});

test('Drive mode: falls back to My Drive when the original folder is not writable', async ({ page }) => {
  const created: unknown[] = [];
  await page.route('https://accounts.google.com/gsi/client', (route) =>
    route.fulfill({ contentType: 'text/javascript', body: GIS_STUB }),
  );
  await page.route('https://www.googleapis.com/**', (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    const url = new URL(req.url());
    if (url.searchParams.get('alt') === 'media') return route.fulfill({ headers: CORS, body: fixture('zip/aes.zip') });
    if (url.pathname.startsWith('/drive/v3/files/')) {
      return route.fulfill({
        headers: CORS,
        json: { id: 'F', name: 'a.zip', mimeType: 'application/zip', parents: ['NOACCESS'] },
      });
    }
    if (req.method() === 'POST') {
      const meta = JSON.parse(req.postData()!);
      created.push(meta);
      if (meta.parents) return route.fulfill({ status: 404, headers: CORS, json: { error: 'not found' } });
      return route.fulfill({
        headers: { ...CORS, Location: 'https://www.googleapis.com/upload/drive/v3/files?upload_id=U2' },
        body: '',
      });
    }
    return route.fulfill({ headers: CORS, json: { id: 'N', name: 'a (entsperrt).zip' } });
  });
  await page.goto('./#/drive?fileId=F');
  await unlock(page, ZIP_PW);
  await page.getByRole('button', { name: 'In Google Drive speichern' }).click();
  await expect(page.getByText(/Gespeichert in „Meine Ablage“/)).toBeVisible();
  expect(created).toHaveLength(2);
  expect(created[1]).not.toHaveProperty('parents');
});

test('Drive "Open with" state parameter is honoured', async ({ page }) => {
  await page.route('https://accounts.google.com/gsi/client', (route) =>
    route.fulfill({ contentType: 'text/javascript', body: GIS_STUB }),
  );
  await page.route('https://www.googleapis.com/**', (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    if (new URL(req.url()).searchParams.get('alt') === 'media') {
      return route.fulfill({ headers: CORS, body: fixture('pdf/user-aes256.pdf') });
    }
    return route.fulfill({
      headers: CORS,
      json: { id: 'X', name: 'Befund.pdf', mimeType: 'application/pdf', parents: [] },
    });
  });
  const state = encodeURIComponent(JSON.stringify({ ids: ['X'], action: 'open', userId: '1' }));
  await page.goto(`./?state=${state}`);
  await expect(page.getByText('Befund.pdf')).toBeVisible();
  await unlock(page, PDF_USER);
  await expect(page.getByText(/nicht mehr passwortgeschützt/)).toBeVisible();
});

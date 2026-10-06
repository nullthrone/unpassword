/**
 * Minimal Drive v3 client. The browser talks to Google directly; unpassword
 * has no server in between. Only ciphertext is downloaded, and the plaintext
 * is uploaded solely to the user's own Drive on explicit request.
 */
const API = 'https://www.googleapis.com/drive/v3/files';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  parents?: string[];
  webViewLink?: string;
}

export class DriveError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function call(token: string, url: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(url, {
    ...init,
    headers: { ...(init.headers as Record<string, string>), Authorization: `Bearer ${token}` },
    // never send cookies or referrers to Google along with file data
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
  });
  if (!res.ok) throw new DriveError(res.status, `Drive API ${res.status}`);
  return res;
}

export async function getMetadata(token: string, id: string): Promise<DriveFile> {
  const res = await call(
    token,
    `${API}/${encodeURIComponent(id)}?fields=id,name,mimeType,size,parents&supportsAllDrives=true`,
  );
  return res.json();
}

export async function download(token: string, id: string): Promise<Uint8Array> {
  const res = await call(token, `${API}/${encodeURIComponent(id)}?alt=media&supportsAllDrives=true`);
  return new Uint8Array(await res.arrayBuffer());
}

/**
 * Saves next to the original if possible. With the drive.file scope the app
 * may not be allowed to write into a folder it has not been granted; then the
 * file goes to the root of My Drive instead.
 */
export async function uploadNextTo(
  token: string,
  meta: { name: string; mimeType: string; parents?: string[] },
  data: Uint8Array,
): Promise<{ file: DriveFile; inParent: boolean }> {
  if (meta.parents?.length) {
    try {
      return { file: await upload(token, meta, data), inParent: true };
    } catch (e) {
      if (!(e instanceof DriveError && (e.status === 403 || e.status === 404))) throw e;
    }
  }
  return { file: await upload(token, { name: meta.name, mimeType: meta.mimeType }, data), inParent: false };
}

/** Resumable upload (works for any size) into the given parent folders. */
export async function upload(
  token: string,
  meta: { name: string; mimeType: string; parents?: string[] },
  data: Uint8Array,
): Promise<DriveFile> {
  const init = await call(token, `${UPLOAD}?uploadType=resumable&supportsAllDrives=true&fields=id,name,webViewLink`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Type': meta.mimeType,
      'X-Upload-Content-Length': String(data.length),
    },
    body: JSON.stringify({ ...meta, appProperties: { unpassword: 'unlocked' } }),
  });
  const session = init.headers.get('Location');
  if (!session?.startsWith(UPLOAD)) throw new DriveError(0, 'no upload session');
  const res = await call(token, session, {
    method: 'PUT',
    headers: { 'Content-Type': meta.mimeType },
    body: new Blob([data as Uint8Array<ArrayBuffer>], { type: meta.mimeType }),
  });
  return res.json();
}

export async function trash(token: string, id: string): Promise<void> {
  await call(token, `${API}/${encodeURIComponent(id)}?supportsAllDrives=true`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ trashed: true }),
  });
}

/**
 * The file ID unpassword was opened with, if any:
 * - Drive "Open with": `?state={"ids":["…"],"action":"open",…}`
 * - Gmail add-on:      `#/drive?fileId=…`
 */
export function launchFileId(loc: Location = location): string | null {
  const state = new URLSearchParams(loc.search).get('state');
  if (state) {
    try {
      const parsed = JSON.parse(state) as { action?: string; ids?: unknown };
      const id = Array.isArray(parsed.ids) ? parsed.ids[0] : undefined;
      if (parsed.action === 'open' && typeof id === 'string' && /^[\w-]+$/.test(id)) return id;
    } catch {
      /* ignore malformed state */
    }
  }
  const hash = loc.hash.match(/^#\/drive\?(.*)$/);
  if (hash) {
    const id = new URLSearchParams(hash[1]).get('fileId');
    if (id && /^[\w-]+$/.test(id)) return id;
  }
  return null;
}

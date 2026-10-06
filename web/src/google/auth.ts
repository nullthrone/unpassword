import { DRIVE_SCOPE, googleConfig, loadScript } from './config';

let tokenClient: google.accounts.oauth2.TokenClient | null = null;
let token: { value: string; expiresAt: number } | null = null;
let pending: { resolve: (t: string) => void; reject: (e: Error) => void } | null = null;

/**
 * Returns an OAuth access token for drive.file, prompting the user if needed.
 * The token lives in memory only.
 */
export async function getAccessToken(): Promise<string> {
  if (token && token.expiresAt - 60_000 > Date.now()) return token.value;
  await loadScript('https://accounts.google.com/gsi/client');
  tokenClient ??= google.accounts.oauth2.initTokenClient({
    client_id: googleConfig.clientId!,
    scope: DRIVE_SCOPE,
    callback: (r) => {
      const p = pending;
      pending = null;
      if (r.error || !r.access_token) {
        p?.reject(new Error(r.error_description || r.error || 'authorization failed'));
        return;
      }
      token = { value: r.access_token, expiresAt: Date.now() + r.expires_in * 1000 };
      p?.resolve(r.access_token);
    },
    error_callback: (e) => {
      const p = pending;
      pending = null;
      p?.reject(new Error(e.message || e.type));
    },
  });
  return new Promise((resolve, reject) => {
    pending = { resolve, reject };
    tokenClient!.requestAccessToken({ prompt: '' });
  });
}

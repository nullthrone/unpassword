/**
 * Public identifiers of the Google Cloud project. None of these is a secret:
 * the OAuth client ID and the API key are embedded in every Google web app
 * and must be restricted to this site's origin in the Cloud console.
 */
export const googleConfig = {
  clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined,
  apiKey: import.meta.env.VITE_GOOGLE_API_KEY as string | undefined,
  /** Cloud project number, required by the Picker for drive.file grants. */
  appId: import.meta.env.VITE_GOOGLE_APP_ID as string | undefined,
};

export const driveEnabled = Boolean(googleConfig.clientId && googleConfig.apiKey && googleConfig.appId);

/** The only OAuth scope unpassword requests: files the user opens or creates with the app. */
export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

const loaded = new Map<string, Promise<void>>();

/** Loads a Google script on demand – never in local-only mode. */
export function loadScript(src: string): Promise<void> {
  let p = loaded.get(src);
  if (!p) {
    p = new Promise<void>((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => {
        loaded.delete(src);
        reject(new Error(`failed to load ${src}`));
      };
      document.head.append(s);
    });
    loaded.set(src, p);
  }
  return p;
}

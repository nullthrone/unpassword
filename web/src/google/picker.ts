import { getAccessToken } from './auth';
import { googleConfig, loadScript } from './config';
import { lang } from '../i18n';

export const PICKABLE_MIME_TYPES = [
  'application/pdf',
  'application/zip',
  'application/x-zip-compressed',
  'application/octet-stream',
  'application/x-ole-storage',
  'application/encrypted',
  'application/vnd.ms-office',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
];

/** Opens the Google Picker; resolves with the chosen file ID or `null` on cancel. */
export async function pickDriveFile(): Promise<string | null> {
  const token = await getAccessToken();
  await loadScript('https://apis.google.com/js/api.js');
  await new Promise<void>((resolve) => gapi.load('picker', resolve));
  return new Promise((resolve) => {
    const view = new google.picker.DocsView(google.picker.ViewId.DOCS)
      .setMimeTypes(PICKABLE_MIME_TYPES.join(','))
      .setIncludeFolders(true);
    new google.picker.PickerBuilder()
      .addView(view)
      .setAppId(googleConfig.appId!)
      .setOAuthToken(token)
      .setDeveloperKey(googleConfig.apiKey!)
      .setLocale(lang)
      .setCallback((r) => {
        if (r.action === google.picker.Action.PICKED && r.docs?.[0]) resolve(r.docs[0].id);
        else if (r.action === google.picker.Action.CANCEL) resolve(null);
      })
      .build()
      .setVisible(true);
  });
}

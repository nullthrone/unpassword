// Minimal typings for the parts of Google Identity Services and the Picker we use.
declare namespace google.accounts.oauth2 {
  interface TokenResponse {
    access_token: string;
    expires_in: number;
    error?: string;
    error_description?: string;
  }
  interface TokenClient {
    requestAccessToken(overrides?: { prompt?: string }): void;
  }
  function initTokenClient(config: {
    client_id: string;
    scope: string;
    callback: (r: TokenResponse) => void;
    error_callback?: (e: { type: string; message?: string }) => void;
  }): TokenClient;
  function revoke(token: string, done?: () => void): void;
}

declare namespace google.picker {
  enum Action {
    PICKED = 'picked',
    CANCEL = 'cancel',
  }
  enum ViewId {
    DOCS = 'all',
  }
  interface PickerDocument {
    id: string;
    name: string;
    mimeType: string;
  }
  interface ResponseObject {
    action: string;
    docs?: PickerDocument[];
  }
  class DocsView {
    constructor(viewId?: ViewId);
    setMimeTypes(mimeTypes: string): DocsView;
    setIncludeFolders(include: boolean): DocsView;
    setParent(folderId: string): DocsView;
    setMode(mode: unknown): DocsView;
  }
  class PickerBuilder {
    addView(view: DocsView): PickerBuilder;
    setAppId(appId: string): PickerBuilder;
    setOAuthToken(token: string): PickerBuilder;
    setDeveloperKey(key: string): PickerBuilder;
    setLocale(locale: string): PickerBuilder;
    setTitle(title: string): PickerBuilder;
    setCallback(cb: (r: ResponseObject) => void): PickerBuilder;
    build(): { setVisible(v: boolean): void };
  }
}

declare const gapi: { load(api: string, cb: () => void): void };

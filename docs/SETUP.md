# Deployment setup

unpassword consists of a static web app and an optional Gmail add-on. Both must belong to the **same Google Cloud project**: `drive.file` grants are per project, and that is what lets the web app open the encrypted attachment the add-on stored.

These steps need a Google account with access to the Cloud console and, for Marketplace publication, a Google Workspace Marketplace developer registration.

## 1. Google Cloud project

1. Create a project in the [Cloud console](https://console.cloud.google.com/) and note its **project number**. That number is `VITE_GOOGLE_APP_ID`.
2. Enable the **Google Drive API**, **Google Picker API**, **Gmail API** (for the add-on) and **Google Workspace Marketplace SDK**.
3. **OAuth consent screen:** set the app name to *unpassword*, add the privacy policy URL (`docs/PRIVACY.md` on GitHub or a published copy) and the scopes:
   - `https://www.googleapis.com/auth/drive.file`
   - `https://www.googleapis.com/auth/gmail.addons.execute`
   - `https://www.googleapis.com/auth/gmail.addons.current.message.readonly`
4. **OAuth client ID** of type *Web application*:
   - Authorized JavaScript origin: `https://<user>.github.io` (or your domain).
   - This is `VITE_GOOGLE_CLIENT_ID`.
5. **API key:** restrict it to *HTTP referrers* `https://<user>.github.io/*` (the app sends only its origin as referrer, `strict-origin`) and to the *Google Picker API*. This is `VITE_GOOGLE_API_KEY`.

None of these three values is secret. They end up in the public JavaScript bundle by design, and the restrictions above are what protect them.

## 2. Web app (GitHub Pages)

1. In the repository settings, go to *Pages* and set *Source* to **GitHub Actions**.
2. In *Settings → Secrets and variables → Actions → Variables*, add `GOOGLE_CLIENT_ID`, `GOOGLE_API_KEY` and `GOOGLE_APP_ID`.
3. Push a tag `v*` (e.g. `v0.1.0`), or run the workflow manually. `.github/workflows/pages.yml` builds the web app and the documentation site, then deploys both:
   - `https://<user>.github.io/unpassword/` – documentation site (`site/`, rendered from `docs/`)
   - `https://<user>.github.io/unpassword/app/` – the web app (`web/`)
   - `https://<user>.github.io/unpassword/SHA256SUMS.txt` – checksums of every published file, also attached to the workflow run

To host elsewhere, build the same way (`site/build.mjs --app web/dist`) and serve `_site/` statically. If your server can set headers, also send the CSP from `web/vite.config.ts` as an HTTP header, plus `frame-ancestors 'none'`.

## 3. Drive "Open with" integration

In the Cloud console, open *Google Workspace Marketplace SDK* and then *App Configuration*:

1. Enable **Drive app** integration.
2. **Open URL:** `https://<user>.github.io/unpassword/app/`. Drive appends `?state={"ids":[…],"action":"open",…}`, which the app reads (`web/src/google/drive.ts` → `launchFileId`).
3. **Default MIME types:** `application/pdf`, `application/zip`
   **Secondary MIME types:** `application/x-zip-compressed`, `application/octet-stream`, `application/x-ole-storage`, `application/vnd.ms-office`, `application/encrypted`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`, `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, `application/vnd.openxmlformats-officedocument.presentationml.presentation`
   **File extensions:** `pdf`, `zip`, `docx`, `xlsx`, `pptx`, `docm`, `xlsm`, `pptm`
4. Leave "Creating files" disabled. unpassword only opens existing files.

## 4. Gmail add-on

```bash
npm install -g @google/clasp
cd gmail-addon
clasp login
clasp create --type standalone --title unpassword   # or copy .clasp.json.example and set scriptId
clasp push
```

1. In the Apps Script editor, open *Project Settings* and set the **Google Cloud Platform project** to the project number from step 1 (same project as the web app).
2. Optionally, in *Project Settings → Script properties*, set `UNPASSWORD_WEB_URL` if the web app is not at `https://nullthrone.github.io/unpassword/app/`. Update `openLinkUrlPrefixes` and `logoUrl` in `appsscript.json` to match.
3. Choose *Deploy → Test deployments → Install* and open a message with a protected attachment in Gmail.
4. For Marketplace publication, add the deployment ID under *Marketplace SDK → App Configuration → Gmail add-on*.

## 5. Marketplace listing

The documentation site is the listing's reference. Use these values in *Marketplace SDK → Store Listing* and on the OAuth consent screen:

| Field | Value |
|---|---|
| Application name | unpassword |
| Short description | Remove passwords you already know from PDF, Office and ZIP files – decrypted in your browser, zero-knowledge. |
| Category | Productivity / Utilities |
| Application homepage / Developer website | `https://nullthrone.github.io/unpassword/` |
| Privacy policy URL | `https://nullthrone.github.io/unpassword/privacy/` |
| Terms of service URL | `https://nullthrone.github.io/unpassword/terms/` |
| Support URL | `https://nullthrone.github.io/unpassword/support/` |
| Developer name / email | Nullthrone · Thomas Sprock, `github@nullthrone.xyz` (see `/imprint/`) |
| Application icons 32/48/96/128 | `brand/icon-32.png`, `icon-48.png`, `icon-96.png`, `icon-128.png` |
| Card banner 220 × 140 | `brand/banner-220x140.png` |
| Screenshots 1280 × 800 | `brand/screenshot-1-pick.png`, `-2-password.png`, `-3-result.png` |
| Authorized domain (OAuth consent) | `nullthrone.github.io` |

All graphics are listed with previews on `/marketplace/`. They are generated from `design/unpassword/` by `scripts/render-brand-assets.mjs`; rerun it after changing the mark or the app's look.

- In the description, state the legitimate purpose plainly: removing **known** passwords for personal archiving. The guardrails on the homepage are written to be quoted in the review.
- Expect an OAuth verification for the Gmail scopes. `drive.file` is a non-sensitive scope.

## 6. Check after deployment

- Local mode: drop a protected file and unlock it. In the browser's network panel, verify that no request leaves the page's origin.
- Drive: use "Open with → unpassword" on a protected PDF in Drive, then save. The new file should appear next to the original.
- Gmail: open a message with a protected ZIP, choose *Open in unpassword*, and confirm that the encrypted copy lands in "unpassword – Eingang" and the web app opens it.

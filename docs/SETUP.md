# Deployment and Marketplace setup

This guide takes unpassword from the repository to a public listing in the Google Workspace Marketplace. The listing contains both the web app with its Drive integration and the Gmail add-on.

The web app and the Gmail add-on must belong to the **same Google Cloud project**. `drive.file` grants are per project, and that is what lets the web app open the encrypted attachment the add-on stored.

| | Value |
|---|---|
| Site | `https://unpassword.nullthrone.xyz/` |
| Web app | `https://unpassword.nullthrone.xyz/app/` |
| Authorized domain | `nullthrone.xyz` |
| Developer contact | `github@nullthrone.xyz` |

## 1. Domain

The site runs on GitHub Pages under its own domain. Google verifies the ownership of every domain the OAuth consent screen names, so it must be a domain you control. `github.io` does not qualify.

1. **DNS (GoDaddy → nullthrone.xyz → DNS):** add a `CNAME` record with name `unpassword` and value `nullthrone.github.io`. Do not add A records or forwarding for the subdomain.
2. **GitHub domain verification:** in GitHub, open organization *nullthrone* → *Settings* → *Pages* → *Add a domain* and enter `nullthrone.xyz`. Add the TXT record GitHub shows (`_github-pages-challenge-nullthrone`) at GoDaddy, then click *Verify*. This protects all subdomains from takeover.
3. **Repository:** in *Settings* → *Pages*:
   - set *Source* to **GitHub Actions**;
   - set *Custom domain* to `unpassword.nullthrone.xyz`;
   - enable **Enforce HTTPS** once it becomes available.

   With an Actions deployment, no `CNAME` file is needed; GitHub uses this setting. The old `nullthrone.github.io/unpassword/` address redirects.
4. **Google Search Console:** add a *Domain* property `nullthrone.xyz` and add the `google-site-verification=…` TXT record with name `@` at GoDaddy. Use an account that is owner or editor of the Cloud project.

*"Domain is not eligible for HTTPS at this time"*: GitHub has not issued the certificate yet. This usually takes minutes to an hour. If it persists, remove the custom domain, wait a minute and enter it again; this starts a new certificate request. Check that `dig unpassword.nullthrone.xyz CNAME +short` returns `nullthrone.github.io.`.

## 2. Google Cloud project

1. Create a project in the [Cloud console](https://console.cloud.google.com/) and note its **project number**. That number is `GOOGLE_APP_ID`.
2. Enable these APIs: **Google Drive API**, **Google Picker API**, **Gmail API** and **Google Workspace Marketplace SDK**.

## 3. OAuth consent screen

In *Google Auth Platform* (OAuth consent screen), fill in *Branding*, *Audience* and *Data access*:

| Field | Value |
|---|---|
| App name | `unpassword` (must match the Marketplace listing exactly) |
| User support email | `github@nullthrone.xyz` |
| App logo | `brand/icon-128.png` |
| Application home page | `https://unpassword.nullthrone.xyz/` |
| Privacy policy | `https://unpassword.nullthrone.xyz/privacy/` |
| Terms of service | `https://unpassword.nullthrone.xyz/terms/` |
| Authorized domains | `nullthrone.xyz` |
| Developer contact | `github@nullthrone.xyz` |
| Audience | External, then *Publish app* to move to production |

Add exactly these scopes, no more. The same list goes into the Marketplace SDK (step 8); Google rejects the listing when the two differ, or when the Apps Script project requests a scope that is missing here.

| Scope | Used by | Purpose |
|---|---|---|
| `https://www.googleapis.com/auth/drive.file` | Web app, add-on | Open the file the user picked, create the unlocked copy, store the encrypted attachment |
| `https://www.googleapis.com/auth/gmail.addons.execute` | Add-on | Run the add-on in Gmail |
| `https://www.googleapis.com/auth/gmail.addons.current.message.readonly` | Add-on | Read the attachments of the open message to detect password protection |
| `https://www.googleapis.com/auth/drive.install` | Marketplace install | List unpassword in Drive's *Open with* menu (Drive app integration) |
| `https://www.googleapis.com/auth/userinfo.email` | Marketplace install | Added by the Marketplace SDK by default; do not remove |
| `https://www.googleapis.com/auth/userinfo.profile` | Marketplace install | Added by the Marketplace SDK by default; do not remove |

At runtime each part requests only what it uses: the web app `drive.file`, the add-on the three scopes in `gmail-addon/appsscript.json` (rows marked *Add-on*). `gmail-addon/scopes.test.mjs` checks that this table, the manifest and the web app agree.

`gmail.addons.current.message.readonly` is a **sensitive** scope. That triggers the verification in step 7. The console shows the classification of each scope; go by what it says.

## 4. Credentials

1. **OAuth client ID** of type *Web application*:
   - Authorized JavaScript origin: `https://unpassword.nullthrone.xyz`
   - This value is `GOOGLE_CLIENT_ID`.
2. **API key:**
   - Application restriction *HTTP referrers*: `https://unpassword.nullthrone.xyz/*`. The app sends only its origin as referrer (`strict-origin`).
   - API restriction: *Google Picker API* only.
   - This value is `GOOGLE_API_KEY`.
3. In the repository, under *Settings* → *Secrets and variables* → *Actions* → **Variables**, add `GOOGLE_CLIENT_ID`, `GOOGLE_API_KEY` and `GOOGLE_APP_ID`.

None of these values is secret. They end up in the public JavaScript bundle by design, and the restrictions above are what protect them.

## 5. Deploy the site and the web app

`.github/workflows/pages.yml` builds the web app and the documentation site, then deploys both:

- `/` – documentation site (`site/`, rendered from `docs/`)
- `/app/` – the web app (`web/`), always built from a release tag
- `/BUILD.txt` – the release tag of the app and the commit of the site
- `/SHA256SUMS.txt` – checksums of every published file, also attached to the workflow run

It runs when:

- **a tag `v*` is pushed** (e.g. `v0.1.0`): site and app from that tag. This is how a release is published, and the first deployment needs one.
- **`docs/`, `site/` or `design/` change on `main`**: site from `main`, app from the latest release tag. Skipped while `main` contains app changes that are not released yet, so the site never describes an app that is not deployed; the documentation then goes live with the next tag.
- **started manually** (*Actions* → *Deploy to GitHub Pages* → *Run workflow*): site from the chosen branch or tag, app from that tag or else the latest release tag, without the skip. Use it to publish an urgent documentation fix (e.g. the privacy policy) ahead of a release.

The `github-pages` environment must allow deployments from `main` and from `v*` tags (*Settings* → *Environments* → *github-pages* → *Deployment branches and tags*).

Then check the deployment:

- **Local mode:** drop a protected file and unlock it. In the browser's network panel, verify that no request leaves the page's origin.
- **Drive:** pick a protected PDF with *Choose from Google Drive*, unlock it and save it. The new file appears next to the original, or in My Drive if the folder is not writable for unpassword.

To host elsewhere, build the same way (`site/build.mjs --app web/dist`) and serve `_site/` statically. If your server can set headers, also send the CSP from `web/vite.config.ts` as an HTTP header, plus `frame-ancestors 'none'`.

## 6. Gmail add-on

```bash
npm install -g @google/clasp
cd gmail-addon
clasp login
clasp create --type standalone --title unpassword   # or copy .clasp.json.example and set scriptId
clasp push
```

1. In the Apps Script editor, open *Project Settings* and set the **Google Cloud Platform project** to the project number from step 2.
2. *Deploy* → *Test deployments* → *Install*. Open a message with a protected attachment in Gmail and choose *Open in unpassword*. The encrypted copy lands in the Drive folder "unpassword – Eingang", and the web app opens it.
3. *Deploy* → *New deployment* → type *Add-on*, with a description such as `v1`. This creates a **versioned** deployment; the Marketplace does not accept the HEAD deployment. Note the **deployment ID**.

The add-on's web app URL defaults to `https://unpassword.nullthrone.xyz/app/`. To use another host, set the script property `UNPASSWORD_WEB_URL` and update `openLinkUrlPrefixes` and `logoUrl` in `appsscript.json`.

## 7. OAuth verification (sensitive scope)

In *Google Auth Platform* → *Verification Center*, submit the app for verification. Google asks for a justification per sensitive scope and a demo video.

### Scope justifications

These texts can be pasted as they are.

**`gmail.addons.current.message.readonly`**

> unpassword's Gmail add-on shows, for the message the user has open, which attachments are password-protected PDF, Office or ZIP files. It reads only the attachments of that open message, and only to check their format and encryption flag locally in Apps Script. When the user clicks "Open in unpassword", the add-on copies the still-encrypted attachment into a Drive folder created by the app (drive.file) and opens the unpassword web app. Decryption happens exclusively in the user's browser with a password the user types. The add-on never receives passwords or decrypted content, and no message data is sent to the developer or any third party. A narrower scope is not available, because the add-on needs the attachment bytes to detect encryption.

**`drive.file`** (non-sensitive, for completeness)

> Used to open files the user explicitly picks or opens with unpassword, to save the unlocked copy the user requests, and to store encrypted Gmail attachments in a folder the app creates. unpassword has no access to any other Drive file.

**`gmail.addons.execute`**

> Required to run the Gmail add-on, which displays the list of protected attachments in the side panel of the open message.

**`drive.install`** (non-sensitive)

> Lets users who install unpassword from the Google Workspace Marketplace open a protected file directly from Google Drive with "Open with → unpassword". It grants no access to file contents.

`userinfo.email` and `userinfo.profile` are added by the Marketplace SDK; they need no justification.

### Demo video

Upload the video to YouTube as *Unlisted*, 2–4 minutes long, in English or with English captions. Storyboard:

1. **Consent:** start in Gmail and install or authorize the add-on. Show the OAuth consent screen with the app name **unpassword** and the URL bar containing the **client ID**. Read out the requested scopes.
2. **`gmail.addons.current.message.readonly`:** open a message with a password-protected PDF attachment. The side panel lists it as "password protected". Explain that only this open message is read.
3. **`drive.file`:** click *Open in unpassword*. Show the encrypted copy in the Drive folder "unpassword – Eingang", which the app created. Then show that unpassword cannot see other Drive files: the Picker shows them, but the app only receives what the user selects.
4. **Web app:** the app opens with the file. Enter the password and tick the entitlement checkbox. The file is unlocked in the browser. Save it to Drive and show the unlocked copy.
5. **Zero knowledge:** open the browser's network panel and show that requests go only to the site's origin and Google APIs. State that the password and the content never reach the developer.
6. **Guardrails:** enter a wrong password three times and show the cooldown. State that unpassword does not guess passwords.

### Expectations

- Submit only after the scope lists match (step 10, checklist). The Marketplace review is put on hold while verification is pending, and the listing is rejected if it is submitted before verification has passed.
- Keep the homepage, privacy policy and terms reachable, and keep them identical to the URLs on the consent screen.
- Google may ask follow-up questions by email to the developer contact. Answer from the security model (`/security/`).
- Verification of sensitive scopes takes from several days to a few weeks.

## 8. Marketplace SDK → App Configuration

| Setting | Value |
|---|---|
| App visibility | Public |
| Installation settings | Individual + Admin install |
| App integrations | **Drive app** and **Google Workspace add-on** |
| OAuth scopes | Exactly the six scopes from step 3 |
| Developer information | Nullthrone · Thomas Sprock, `github@nullthrone.xyz`, website `https://unpassword.nullthrone.xyz/` |

**Google Workspace add-on:** enter the deployment ID from step 6.

**Drive app:**

1. **Open URL:** `https://unpassword.nullthrone.xyz/app/`. Drive appends `?state={"ids":[…],"action":"open",…}`, which the app reads (`web/src/google/drive.ts` → `launchFileId`).
2. **Default MIME types:** `application/pdf`, `application/zip`.
   **Secondary MIME types:** `application/x-zip-compressed`, `application/octet-stream`, `application/x-ole-storage`, `application/vnd.ms-office`, `application/encrypted`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`, `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, `application/vnd.openxmlformats-officedocument.presentationml.presentation`.
   **File extensions:** `pdf`, `zip`, `docx`, `xlsx`, `pptx`, `docm`, `xlsm`, `pptm`.
3. Leave "Creating files" disabled. unpassword only opens existing files.
4. Icons: `brand/icon-32.png`, `brand/icon-128.png`.

## 9. Store listing

| Field | Value |
|---|---|
| Application name | unpassword |
| Short description | see below (≤ 200 characters) |
| Detailed description | see below |
| Category | Productivity / Utilities |
| Language | English |
| Application icons | `brand/icon-32.png`, `icon-48.png`, `icon-96.png`, `icon-128.png` (transparent background) |
| Card banner 220 × 140 | `brand/banner-220x140.png` |
| Screenshots 1280 × 800 | `brand/screenshot-1-pick.png`, `brand/screenshot-2-password.png`, `brand/screenshot-3-result.png` |
| Terms of service URL | `https://unpassword.nullthrone.xyz/terms/` |
| Privacy policy URL | `https://unpassword.nullthrone.xyz/privacy/` |
| Support URL | `https://unpassword.nullthrone.xyz/support/` |
| Setup / admin documentation | `https://unpassword.nullthrone.xyz/setup/` |
| Pricing | Free |

All graphics, with previews, are on [`/marketplace/`](https://unpassword.nullthrone.xyz/marketplace/). `scripts/render-brand-assets.mjs` generates them from `design/unpassword/`; rerun it after changing the mark or the app's look.

**Short description** (168 characters):

> Remove passwords you already know from PDF, Office and ZIP files to archive them your way. Decrypted in your browser – the developer never sees your files or passwords.

**Detailed description:**

> unpassword removes the password protection of PDF, Word, Excel, PowerPoint and ZIP files whose password you know – for example statements, payslips or reports sent to you with a password. Archive them under protection you control, such as your Google account, instead of a sender's file password.
>
> HOW IT WORKS
> • Open a protected file from Google Drive™ ("Open with → unpassword"), from a Gmail™ attachment, or from your device.
> • Enter the password you were given.
> • Download the unlocked file or save it next to the original in Drive.
>
> ZERO KNOWLEDGE
> • Decryption runs entirely in your browser. There is no unpassword server.
> • Files and passwords are never sent to the developer.
> • Drive access is limited to files you open with unpassword (drive.file).
> • The Gmail add-on reads only the open message and hands over the still-encrypted attachment.
>
> NOT A CRACKING TOOL
> • You need the current password. unpassword never guesses or bypasses passwords.
> • Failed attempts are rate-limited and locked after ten tries.
> • PDF permission restrictions stay in place unless you enter the owner password.
>
> SUPPORTED: PDF (RC4, AES-128, AES-256), DOCX/XLSX/PPTX (ECMA-376 encryption), ZIP (ZipCrypto, AES).
>
> Open source under the MIT license: https://github.com/nullthrone/unpassword
>
> Google Drive™, Gmail™ and Google Workspace™ are trademarks of Google LLC.

Name Google products only descriptively ("works with Google Drive™ and Gmail™") and attribute them: the ™ symbol at the first mention, and the trademark notice at the end of the detailed description ([branding guidelines](https://developers.google.com/workspace/marketplace/terms/branding#giving_proper_attribution)). Never use them in the app name, icon or banner.

## 10. Submit and review

Submit the listing only after OAuth verification (step 7) has **passed**. While it is pending, Google puts the Marketplace review on hold and rejects the submission.

1. **Scopes match in all three places:**
   - Apps Script editor → *Overview* → *Project OAuth Scopes*: the three *Add-on* scopes from step 3, nothing else.
   - Marketplace SDK → *App Configuration* → *OAuth Scopes*: all six scopes from step 3.
   - *Google Auth Platform* → *Data access*: the same six scopes.

   A scope the Apps Script project requests that is missing on the consent screen shows the "Google hasn't verified this app" screen to new users, and the review fails.
2. **Trademarks:** every Google product name in the listing carries ™, and the detailed description ends with the trademark notice (step 9).
3. **No premature Marketplace references:** the website must not link to the listing, and must not announce it ("coming soon", disabled buttons) before it is approved. Such references delay OAuth verification.
4. Check that every URL in the listing loads over HTTPS and that the screenshots match the current app.
5. *Store Listing* → **Publish**. The listing goes to Marketplace review. Google says this typically takes several days.
6. Common reasons for rejection, to check beforehand:
   - an app name or logo that differs between the consent screen and the listing;
   - unverified authorized domains;
   - broken links or test URLs;
   - non-transparent or low-quality icons;
   - incomplete functionality.
7. After approval, add the Marketplace link to the "Get it" section of the homepage (`site/index.html`).

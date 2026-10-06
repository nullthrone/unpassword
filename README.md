# unpassword

A Google Workspace app that removes the password protection of **Office (DOCX/XLSX/PPTX), PDF files and compressed archives (ZIP)** whose password you already know, for archiving purposes: you can archive them under your own protection (account security, encrypted storage, access policies) instead of a sender's file password.

**Zero-knowledge:** decryption and re-saving happen entirely in your browser. There is no backend. The provider of unpassword never receives your files, your passwords or the decrypted content.

**Not a cracking tool:** unpassword requires the current password. It never guesses, enumerates or bypasses passwords, and it keeps protections that need a password you did not supply. See [Guardrails](#guardrails).

## How it works

```
Browser (static web app)                          Google
┌──────────────────────────────────────┐         ┌───────────────────────────┐
│ UI ── Web Worker: qpdf (WASM),        │  HTTPS  │ Drive API (scope:          │
│       ECMA-376 Office crypto, zip.js  │◄──────►│ drive.file), Picker, OAuth │
│       – only place with password and  │         └───────────────────────────┘
│         plaintext                     │                       ▲
└──────────────────────────────────────┘                       │ encrypted file only
Gmail add-on (Apps Script) ── copies the still-encrypted ───────┘
                              attachment to Drive, opens the web app
```

- **Local mode:** pick or drop a file, enter the password, download the result. No Google sign-in, no Google scripts loaded.
- **Drive mode:** "Open with → unpassword" in Drive, or "Choose from Google Drive". The result is saved next to the original as `<name> (unlocked).<ext>` (German UI: `(entsperrt)`). Optionally, the encrypted original goes to the trash.
- **Gmail:** the add-on lists password-protected attachments. "Open in unpassword" stores the *encrypted* attachment in the Drive folder `unpassword – Eingang` and opens the web app on it.

| Format | Supported protection | Result |
|---|---|---|
| PDF | Standard security handler: RC4 40/128, AES-128, AES-256 (R2–R6) | open password removed; see PDF permissions below |
| DOCX/XLSX/PPTX (and macro variants) | ECMA-376 Agile and Standard encryption | unencrypted OOXML document |
| ZIP | ZipCrypto, WinZip AES-128/192/256 | unencrypted ZIP with the same entries |

Not supported: legacy binary Office (.doc/.xls/.ppt), 7z/RAR, certificate-based or DRM protection (Adobe LiveCycle, FileOpen, …), sheet/workbook protection, "read-only recommended".

### PDF permissions

PDFs have two passwords: the open (user) password and the permissions (owner) password.

| You enter | File | Result |
|---|---|---|
| open password | no permission restrictions | fully decrypted |
| open password | with restrictions (print, copy, …) | open password removed. The **restrictions are kept** (AES-256, empty open password, random owner password that is discarded) |
| owner password | any | fully decrypted |
| – | owner password only, no open password | refused: lifting restrictions requires the owner password |

## Guardrails

unpassword is built so that it is useless for attacking files you have no password for:

- Exactly one typed password per attempt. There are no password lists, imports, generators or "common password" features. The static test `web/tests/guardrails.test.ts` fails if such code appears, including zip.js' password-candidate API.
- Per-file rate limiting: two free failures, then 5 s, 10 s, 20 s … and a lock after ten failures for the session.
- No export of hashes, verifiers or salts in any form.
- Key-derivation parameters (e.g. Office spin counts) are used as stored in the file.
- Only real encryption is removed with the password that controls it. Permission restrictions, DRM and structure protection are never bypassed.

These limits run on your machine and are not a cryptographic boundary against a modified copy of the code. They make sure unpassword itself adds no attack capability: a determined attacker gains nothing from it they would not have without it. Details are in [docs/SECURITY.md](docs/SECURITY.md).

## Repository layout

```
web/            static web app (Vite + TypeScript, no UI framework)
  src/core/     format handlers, rate limiter – pure, DOM-free, unit tested
  src/google/   OAuth (GIS), Picker, Drive REST client
  tests/        Vitest unit tests + fixtures
  e2e/          Playwright tests (local mode, Drive mode with mocked APIs, network assertions)
gmail-addon/    Apps Script Gmail launcher (never decrypts)
scripts/        fixture generator
docs/           security model, privacy policy, deployment setup
```

## Development

```bash
cd web
npm ci
npm run dev          # local mode works without any Google configuration
npm test             # unit tests
npm run test:e2e     # Playwright (Chromium)
npm run lint && npm run typecheck
npm run build        # dist/ + dist/SHA256SUMS.txt
```

Drive integration needs `VITE_GOOGLE_CLIENT_ID`, `VITE_GOOGLE_API_KEY` and `VITE_GOOGLE_APP_ID` (see [docs/SETUP.md](docs/SETUP.md)). Without them the app runs in local mode only.

## Verifying a deployment

The Pages workflow builds from a tagged commit and publishes `SHA256SUMS.txt` next to the app. Build the same tag locally with the same public Google identifiers and compare the checksums.

## License

MIT, see [LICENSE](LICENSE). Third-party components: [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

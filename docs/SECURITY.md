# Security model

## Goals

1. **Confidentiality towards the provider (zero-knowledge).** Whoever builds and hosts unpassword never gets access to files, passwords or plaintext.
2. **Legitimate use only.** unpassword removes protection only with the password that controls it, and it is useless as a password-guessing tool.
3. **Integrity of results.** Output is verified before it is offered: re-encrypted PDFs are re-inspected, Office packages carry an HMAC check, ZIP entries are CRC/MAC-checked.

## Trust boundaries

| Component | Sees plaintext or password? | Notes |
|---|---|---|
| unpassword provider / hosting (GitHub Pages) | no | serves static files only; no backend, no logging endpoint, no analytics |
| Browser, web worker | yes | the only place where decryption happens |
| Google (Drive, GIS, Picker scripts) | Drive mode only: plaintext when **you** save to Drive | Google already stores your files; the password never goes to Google |
| Gmail add-on (Apps Script, runs on Google servers) | no | handles only the encrypted attachment |

### Enforcement

- **Content Security Policy** (`web/vite.config.ts`, injected into the built `index.html`): `connect-src` allows only this origin and Google's API hosts. Even a compromised dependency cannot send data anywhere else from the page or the worker. `object-src 'none'`, `base-uri 'none'` and `form-action 'none'` close other channels. The CSP is delivered via `<meta>` because GitHub Pages cannot set headers, so `frame-ancestors` is not available. Host it behind a server that sets headers if you need it.
- **Worker isolation.** Passwords and plaintext are processed in a dedicated worker (`web/src/worker.ts`). The main thread holds the password only between the input field and `postMessage`, and the field is cleared immediately.
- **No persistence.** ESLint forbids `localStorage`, `sessionStorage` and `indexedDB` in `src/`. Nothing is cached. Buffers are overwritten after use as far as JavaScript allows. Garbage-collected copies cannot be wiped reliably.
- **Local mode loads no third-party code.** Google scripts are loaded only when the user chooses Drive.
- **Minimal OAuth scope.** `drive.file` grants access only to files the user picks or that unpassword creates. Tokens stay in memory.
- **Static guardrail tests** (`web/tests/guardrails.test.ts`) fail the build if source code references non-Google endpoints, uses `fetch` outside the Drive client, or contains password-guessing features.
- **E2E network assertions** (`web/e2e/`) check that in local mode every request stays on the app origin, and in Drive mode only Google API hosts are contacted. They also check that the password never appears in any URL or request body.

### Residual risks

- Google's GIS and Picker scripts run with page privileges in Drive mode. This is inherent to any Drive web app. Use local mode if you do not want any third-party script on the page.
- A malicious browser extension or a compromised device can read anything the page can.
- Supply chain: dependencies are few, pinned via `package-lock.json`, and bundled at build time. No code is loaded from CDNs at runtime except Google's scripts in Drive mode.

## Anti-misuse design

| Measure | Where |
|---|---|
| One password per call, no candidate lists | `Unlocker` type in `src/core/types.ts`; zip.js is used through its core API with a single `password` |
| Rate limit: 2 free failures, then exponential delay from 5 s, lock after 10 | `src/core/guard.ts`, applied in `src/core/session.ts` inside the worker |
| Wrong ZipCrypto passwords that pass the 1-byte check are still rejected | CRC verification, test with 600 wrong passwords in `tests/zip.test.ts` |
| PDF restrictions preserved without the owner password | `src/core/pdf/policy.ts` (pure, table-tested), with verification after re-encryption |
| No owner-password recovery, no "remove restrictions only" mode | policy refuses `owner-password-required` |
| No hash or verifier export | guardrail test |
| Unsupported protection is refused rather than worked around | DRM / certificate handlers → `unsupported` |

The guard is client-side code. Someone can delete it from their own copy. That is accepted: the goal is that unpassword provides no attack capability, and the cryptographic work an attacker faces is identical with or without it.

### Password encodings

For PDF R2–R4 the password must be PDFDocEncoding bytes, for R5/R6 UTF-8. Producers are inconsistent, so the PDF handler passes the *same typed password* to qpdf in up to four byte encodings (UTF-8 NFC, PDFDocEncoding, UTF-8 NFKC, UTF-8 as typed). This is representation, not guessing. The set is fixed, derived only from the user's input, and counts as one attempt.

## Reporting vulnerabilities

Please open a private security advisory on GitHub rather than a public issue.

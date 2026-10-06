# Third-party notices

unpassword bundles the following components into the web app.

| Component | License | Use |
|---|---|---|
| [qpdf](https://github.com/qpdf/qpdf) via [@neslinesli93/qpdf-wasm](https://github.com/neslinesli93/qpdf-wasm) | Apache-2.0 (qpdf), ISC (WASM packaging) | PDF decryption and re-encryption |
| [@zip.js/zip.js](https://github.com/gildas-lormeau/zip.js) | BSD-3-Clause | ZIP reading and writing |
| [cfb](https://github.com/SheetJS/js-cfb) | Apache-2.0 | Compound File Binary parsing (encrypted Office containers) |
| [@noble/ciphers](https://github.com/paulmillr/noble-ciphers), [@noble/hashes](https://github.com/paulmillr/noble-hashes) | MIT | AES, SHA-1/SHA-2, HMAC for Office decryption |

The test suite additionally contains three sample documents from [msoffcrypto-tool](https://github.com/nolze/msoffcrypto-tool) (MIT): `web/tests/fixtures/office/standard.docx`, `office-agile.docx` and `office-agile.xlsx`.

The full license texts are in each package's `LICENSE` file in `web/node_modules` after `npm ci`, and at the linked repositories.

## Apache-2.0 notice (qpdf)

qpdf is Copyright (c) 2005–2024 Jay Berkenbilt and contributors, licensed under the Apache License, Version 2.0. You may obtain a copy of the License at <http://www.apache.org/licenses/LICENSE-2.0>. Distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND.

## Apache-2.0 notice (cfb)

cfb is Copyright (C) 2013-present SheetJS LLC, licensed under the Apache License, Version 2.0.

# Privacy policy – unpassword

_Last updated: 2026-10-06_

unpassword is designed so that its provider cannot access your data.

## What unpassword processes

- **Files and passwords** you select or enter are processed **only in your browser**, in a web worker. They are never sent to the provider of unpassword. There is no unpassword server.
- **Google Drive (optional):** if you choose Drive, your browser obtains an OAuth access token from Google with the scope `https://www.googleapis.com/auth/drive.file`. That scope only covers files you select in the Google Picker or open with unpassword, and files unpassword creates. Your browser downloads the selected (encrypted) file directly from Google and, on your request, uploads the decrypted copy directly to your Drive. The token is kept in memory and discarded when you close the page.
- **Gmail add-on (optional):** when you open a message, the add-on reads the attachments of **that message only** (`gmail.addons.current.message.readonly`) to detect password protection. If you click "Open in unpassword", it copies the **still-encrypted** attachment into a Drive folder named "unpassword – Eingang" (`drive.file`) and opens the web app. The add-on never receives passwords or decrypted content.

## What unpassword does not do

- No analytics, telemetry, error reporting, cookies or tracking.
- No storage of files, passwords or results in the browser (no localStorage/IndexedDB) or anywhere else.
- No sharing or sale of data. The provider has none.

## Google API Services User Data Policy

unpassword's use of information received from Google APIs adheres to the [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy), including the Limited Use requirements. Data from Google APIs is used only to provide the user-facing features described above and is never transferred to the provider or any third party.

## Hosting

The static web app is served by GitHub Pages. GitHub may log technical access data (IP address, time, requested file) as described in GitHub's privacy statement. These logs contain no file content or passwords.

## Revoking access

Remove unpassword's access at <https://myaccount.google.com/permissions>. Files unpassword created remain in your Drive until you delete them.

## Contact

Open an issue at <https://github.com/nullthrone/unpassword/issues>.

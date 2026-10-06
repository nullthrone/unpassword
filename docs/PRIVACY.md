# Privacy policy

_Last updated: 2026-10-06_

unpassword is designed so that its provider cannot access your data.

## Controller

Thomas Sprock, Am Kleikamp 26, 31319 Sehnde, Germany. Email: [github@nullthrone.xyz](mailto:github@nullthrone.xyz). See also the [imprint](IMPRINT.md).

## What unpassword processes

- **Files and passwords** you select or enter are processed **only in your browser**, in a web worker. They are never sent to the provider of unpassword. There is no unpassword server.
- **Google Drive (optional):** if you choose Drive, your browser obtains an OAuth access token from Google with the scope `https://www.googleapis.com/auth/drive.file`. That scope only covers files you select in the Google Picker or open with unpassword, and files unpassword creates. Your browser downloads the selected (encrypted) file directly from Google and, on your request, uploads the decrypted copy directly to your Drive. The token is kept in memory and discarded when you close the page.
- **Gmail add-on (optional):** when you open a message, the add-on reads the attachments of **that message only** (`gmail.addons.current.message.readonly`) to detect password protection. If you click "Open in unpassword", it copies the **still-encrypted** attachment into a Drive folder named "unpassword – Eingang" (`drive.file`) and opens the web app. The add-on never receives passwords or decrypted content.

## What unpassword does not do

- No analytics, telemetry, error reporting, cookies or tracking.
- No third-party fonts or content delivery networks. Fonts are served from this site.
- No storage of files, passwords or results in the browser (no localStorage/IndexedDB) or anywhere else.
- No sharing or sale of data. The provider has none.

## Google API Services User Data Policy

unpassword's use of information received from Google APIs adheres to the [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy), including the Limited Use requirements. Data from Google APIs is used only to provide the user-facing features described above and is never transferred to the provider or any third party.

## Hosting

This website and the web app are static files served by GitHub Pages, operated by GitHub, Inc., USA. To deliver the pages, GitHub processes technical access data: IP address, time, requested file and browser identification. GitHub may store this data in server logs. The logs contain no file content and no passwords. The legal basis is Art. 6(1)(f) GDPR, our legitimate interest in delivering the site securely. Details are in the [GitHub General Privacy Statement](https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement).

The documentation pages contain no scripts. The web app loads scripts only from this site, and from Google only when you choose to use Google Drive.

## Legal basis

- Processing in your browser is not processing by the provider, who receives no data.
- Google Drive and Gmail access happens at your request, to provide the function you asked for: Art. 6(1)(b) GDPR. The access is between your browser or Google account and Google.
- Hosting: Art. 6(1)(f) GDPR, see above.

## Your rights

Under the GDPR you have the right of access (Art. 15), rectification (Art. 16), erasure (Art. 17), restriction of processing (Art. 18), data portability (Art. 20) and objection (Art. 21). Because the provider stores no personal data about you, these rights will usually concern GitHub or Google directly. Contact us at the address above for any request.

You also have the right to lodge a complaint with a supervisory authority. For the provider, this is the [Landesbeauftragte für den Datenschutz Niedersachsen](https://www.lfd.niedersachsen.de).

## Revoking access

Remove unpassword's access at <https://myaccount.google.com/permissions>. Files unpassword created remain in your Drive until you delete them.

## Contact

Email [github@nullthrone.xyz](mailto:github@nullthrone.xyz), or open an issue at <https://github.com/nullthrone/unpassword/issues>.

# Support

unpassword is maintained as an open-source project. Support is provided on a best-effort basis; there is no guaranteed response time.

## Where to ask

| Topic | Channel |
|---|---|
| Bugs, questions, feature requests | [GitHub issues](https://github.com/nullthrone/unpassword/issues) |
| Security vulnerabilities | [Private security advisory](https://github.com/nullthrone/unpassword/security/advisories/new). Please do not open a public issue. |
| Privacy requests, everything else | [github@nullthrone.xyz](mailto:github@nullthrone.xyz) |

Never send us an encrypted file together with its password, and never send us a decrypted file. We do not need either to help you, and we will not ask for them. Describe the file instead: its format, the program that created it, and the exact error message.

## Common situations

**"The password is incorrect."**
unpassword checks the password exactly as typed. Check the keyboard layout and Caps Lock. For PDFs, both the open password and the owner password are accepted.

**"Too many failed attempts."**
After two failed attempts, unpassword waits before each further attempt. After ten failures the file is locked for the current session. Reload the page to start a new session. The limit exists so that unpassword cannot be used to guess passwords.

**"Owner password required."**
The PDF opens without a password and is only restricted, for example against printing or copying. Lifting these restrictions requires the owner password. unpassword does not bypass them.

**"Format or protection scheme not supported."**
The following are supported: PDF (standard security handler), encrypted DOCX/XLSX/PPTX, and ZIP (ZipCrypto, WinZip AES). The following are not: legacy .doc/.xls/.ppt, 7z/RAR, DRM and certificate-based protection.

**The integrity-check warning (Office).**
The password was correct and the content was decrypted. However, the file's integrity code does not match. Either the file was modified after encryption, or the program that wrote it is faulty. Compare the content with the original before deleting anything.

**"Saved to My Drive" instead of next to the original.**
unpassword only has access to files you open with it (`drive.file`). If it may not write into the original's folder, it saves to the root of My Drive.

**Revoking access.**
Open [Google Account → Third-party apps](https://myaccount.google.com/connections) and remove unpassword. Files unpassword created stay in your Drive.

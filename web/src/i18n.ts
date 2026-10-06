const de = {
  title: 'unpassword',
  byline: 'by Nullthrone',
  eyebrow: 'Open Source · Zero Knowledge',
  headline: 'Passwörter entfernen, die du schon kennst.',
  links: { privacy: 'Datenschutz', security: 'Sicherheit', terms: 'Nutzungsbedingungen', imprint: 'Impressum' },
  tagline:
    'PDF-, Office- und ZIP-Dateien entsperren und so archivieren, wie du es willst – vollständig in deinem Browser.',
  principleLocal: 'Entschlüsselung ausschließlich in deinem Browser. Kein Server, kein Tracking.',
  principleKnown: 'Du brauchst das bisherige Passwort. unpassword rät keine Passwörter und umgeht keinen Schutz.',
  principleArchive: 'Gedacht für die eigene Archivierung, geschützt auf deine Art statt mit fremden Passwörtern.',
  chooseLocal: 'Datei vom Gerät wählen',
  dropHint: 'oder hierher ziehen',
  chooseDrive: 'Aus Google Drive wählen',
  driveSignIn: 'Mit Google anmelden …',
  loadingDrive: 'Datei wird aus Google Drive geladen …',
  driveFileUnavailable:
    'unpassword hat keinen Zugriff auf diese Datei. Bitte wähle sie über „Aus Google Drive wählen“ aus, damit Google den Zugriff freigibt.',
  formats: 'PDF · DOCX/XLSX/PPTX · ZIP',
  file: 'Datei',
  type: { pdf: 'PDF', ooxml: 'Office-Dokument', zip: 'ZIP-Archiv' },
  unknownType: 'Unbekannter Dateityp. Unterstützt werden PDF, verschlüsselte DOCX/XLSX/PPTX und ZIP.',
  password: 'Bisheriges Passwort',
  passwordHint:
    'Für PDFs: Das Öffnen-Passwort entfernt den Öffnen-Schutz; Rechtebeschränkungen bleiben dann erhalten. Mit dem Rechte-Passwort (Owner-Passwort) wird alles entfernt.',
  attest: 'Ich bin berechtigt, diese Datei zu entsperren, und habe das Passwort rechtmäßig erhalten.',
  submit: 'Passwortschutz entfernen',
  working: 'Wird entschlüsselt …',
  another: 'Andere Datei',
  done: {
    decrypted: 'Fertig. Die Datei ist nicht mehr passwortgeschützt.',
    'open-password-removed':
      'Fertig. Der Öffnen-Schutz ist entfernt. Die Rechtebeschränkungen des Absenders (z. B. Drucken oder Kopieren) bleiben erhalten, weil dafür das Owner-Passwort nötig wäre.',
  },
  warning: {
    'integrity-check-failed':
      'Hinweis: Die Integritätsprüfung des Dokuments ist fehlgeschlagen. Das Passwort war korrekt, aber die Datei wurde nach der Verschlüsselung verändert oder von einem fehlerhaften Programm erzeugt. Prüfe den Inhalt.',
  },
  download: 'Herunterladen',
  saveDrive: 'In Google Drive speichern',
  trashOriginal: 'Verschlüsselte Originaldatei in den Papierkorb verschieben',
  saving: 'Wird gespeichert …',
  saved: 'Gespeichert:',
  savedRoot: 'Gespeichert in „Meine Ablage“ (kein Schreibzugriff auf den Ordner des Originals):',
  openInDrive: 'In Google Drive öffnen',
  unlockedSuffix: 'entsperrt',
  errors: {
    'wrong-password': 'Das Passwort ist falsch.',
    'empty-password': 'Bitte gib das Passwort ein.',
    'not-encrypted': 'Diese Datei ist nicht passwortgeschützt – es gibt nichts zu entfernen.',
    'owner-password-required':
      'Dieses PDF hat keinen Öffnen-Schutz, nur Rechtebeschränkungen. Diese lassen sich nur mit dem Rechte-Passwort (Owner-Passwort) entfernen.',
    unsupported: 'Dieses Format bzw. dieses Schutzverfahren wird nicht unterstützt.',
    'mixed-passwords': 'Die Einträge dieses Archivs nutzen unterschiedliche Passwörter. Das wird nicht unterstützt.',
    'too-large': 'Die Datei ist zu groß.',
    corrupt: 'Die Datei ist beschädigt oder konnte nicht gelesen werden.',
    cooldown: 'Zu viele Fehlversuche. Bitte warte kurz.',
    locked: 'Zu viele Fehlversuche. Diese Datei ist für die aktuelle Sitzung gesperrt.',
    network: 'Google Drive ist nicht erreichbar. Bitte versuche es erneut.',
  },
  remaining: (n: number) => `Noch ${n} ${n === 1 ? 'Versuch' : 'Versuche'}.`,
  retryIn: (s: number) => `Nächster Versuch in ${s} s.`,
  privacyTitle: 'Was passiert mit meinen Daten?',
  privacy: [
    'Datei und Passwort verlassen deinen Browser nicht. Die Entschlüsselung läuft in einem isolierten Web Worker.',
    'Mit Google Drive spricht dein Browser direkt mit Google – nur mit der Berechtigung für Dateien, die du selbst auswählst (drive.file).',
    'unpassword betreibt keinen Server, speichert nichts und erhebt keine Statistiken.',
    'Bei wiederholten Fehlversuchen verlangsamt unpassword weitere Versuche und sperrt die Datei nach zehn Fehlern.',
  ],
  source: 'Quellcode',
};

type Strings = typeof de;

const en: Strings = {
  title: 'unpassword',
  byline: 'by Nullthrone',
  eyebrow: 'Open Source · Zero Knowledge',
  headline: 'Remove passwords you already know.',
  links: { privacy: 'Privacy', security: 'Security', terms: 'Terms', imprint: 'Imprint' },
  tagline: 'Unlock PDF, Office and ZIP files and archive them your way – entirely in your browser.',
  principleLocal: 'Decryption happens only in your browser. No server, no tracking.',
  principleKnown: 'You need the current password. unpassword never guesses passwords or bypasses protection.',
  principleArchive: 'Made for personal archiving, secured your way instead of with someone else’s passwords.',
  chooseLocal: 'Choose a file from this device',
  dropHint: 'or drop it here',
  chooseDrive: 'Choose from Google Drive',
  driveSignIn: 'Signing in with Google …',
  loadingDrive: 'Loading file from Google Drive …',
  driveFileUnavailable:
    'unpassword cannot access this file. Please select it via “Choose from Google Drive” so Google grants access.',
  formats: 'PDF · DOCX/XLSX/PPTX · ZIP',
  file: 'File',
  type: { pdf: 'PDF', ooxml: 'Office document', zip: 'ZIP archive' },
  unknownType: 'Unknown file type. Supported: PDF, encrypted DOCX/XLSX/PPTX and ZIP.',
  password: 'Current password',
  passwordHint:
    'For PDFs: the open password removes the open protection and keeps permission restrictions. The owner password removes everything.',
  attest: 'I am entitled to unlock this file and obtained the password legitimately.',
  submit: 'Remove password protection',
  working: 'Decrypting …',
  another: 'Another file',
  done: {
    decrypted: 'Done. The file is no longer password protected.',
    'open-password-removed':
      'Done. The open password is removed. The sender’s permission restrictions (e.g. printing or copying) are kept, because lifting them requires the owner password.',
  },
  warning: {
    'integrity-check-failed':
      'Note: the document’s integrity check failed. The password was correct, but the file was modified after encryption or written by a faulty program. Please check its content.',
  },
  download: 'Download',
  saveDrive: 'Save to Google Drive',
  trashOriginal: 'Move the encrypted original to the trash',
  saving: 'Saving …',
  saved: 'Saved:',
  savedRoot: 'Saved to “My Drive” (no write access to the original’s folder):',
  openInDrive: 'Open in Google Drive',
  unlockedSuffix: 'unlocked',
  errors: {
    'wrong-password': 'The password is incorrect.',
    'empty-password': 'Please enter the password.',
    'not-encrypted': 'This file is not password protected – there is nothing to remove.',
    'owner-password-required':
      'This PDF has no open password, only permission restrictions. These can only be removed with the owner password.',
    unsupported: 'This format or protection scheme is not supported.',
    'mixed-passwords': 'The entries of this archive use different passwords, which is not supported.',
    'too-large': 'The file is too large.',
    corrupt: 'The file is damaged or could not be read.',
    cooldown: 'Too many failed attempts. Please wait a moment.',
    locked: 'Too many failed attempts. This file is locked for the current session.',
    network: 'Google Drive is not reachable. Please try again.',
  },
  remaining: (n: number) => `${n} ${n === 1 ? 'attempt' : 'attempts'} left.`,
  retryIn: (s: number) => `Next attempt in ${s} s.`,
  privacyTitle: 'What happens to my data?',
  privacy: [
    'File and password never leave your browser. Decryption runs in an isolated web worker.',
    'With Google Drive, your browser talks directly to Google – only with access to files you select yourself (drive.file).',
    'unpassword runs no server, stores nothing and collects no statistics.',
    'After repeated failed attempts unpassword slows down further attempts and locks the file after ten failures.',
  ],
  source: 'Source code',
};

export const t: Strings = (navigator.language || 'en').toLowerCase().startsWith('de') ? de : en;
export const lang = t === de ? 'de' : 'en';

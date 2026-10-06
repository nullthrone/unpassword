/**
 * unpassword – Gmail launcher.
 *
 * This add-on never decrypts anything and never sees a password. It lists the
 * attachments of the open message that look password-protected and, on
 * request, copies the still-encrypted attachment into the user's Drive
 * (folder "unpassword – Eingang") and opens the unpassword web app for it.
 * Decryption happens in the user's browser only.
 *
 * Scopes: gmail.addons.current.message.readonly (only the open message),
 * drive.file (only files this app creates), gmail.addons.execute.
 */

/** Base URL of the web app. Override with the script property UNPASSWORD_WEB_URL. */
function webAppUrl_() {
  var url = PropertiesService.getScriptProperties().getProperty('UNPASSWORD_WEB_URL');
  return (url || 'https://nullthrone.github.io/unpassword/app/').replace(/\/?$/, '/');
}

var INBOX_FOLDER = 'unpassword – Eingang';
var MAX_BYTES = 25 * 1024 * 1024; // Gmail attachment limit

function isGerman_(e) {
  var locale = (e && e.commonEventObject && e.commonEventObject.userLocale) || Session.getActiveUserLocale() || 'en';
  return String(locale).toLowerCase().indexOf('de') === 0;
}

function strings_(e) {
  return isGerman_(e)
    ? {
        header: 'Passwortgeschützte Anhänge',
        intro:
          'unpassword entfernt den Passwortschutz in deinem Browser – mit dem Passwort, das du kennst. ' +
          'Dieses Add-on legt nur die verschlüsselte Datei in Drive ab und öffnet unpassword.',
        none: 'In dieser Nachricht wurden keine passwortgeschützten PDF-, Office- oder ZIP-Anhänge gefunden.',
        open: 'In unpassword öffnen',
        protectedLabel: 'passwortgeschützt',
        failed: 'Der Anhang konnte nicht nach Google Drive kopiert werden.',
      }
    : {
        header: 'Password-protected attachments',
        intro:
          'unpassword removes the password protection in your browser – with the password you know. ' +
          'This add-on only stores the encrypted file in Drive and opens unpassword.',
        none: 'No password-protected PDF, Office or ZIP attachments found in this message.',
        open: 'Open in unpassword',
        protectedLabel: 'password protected',
        failed: 'The attachment could not be copied to Google Drive.',
      };
}

/**
 * Cheap, local detection on the encrypted bytes – no decryption involved.
 * Returns 'pdf' | 'ooxml' | 'zip' or null.
 */
function detectProtected_(bytes) {
  var n = bytes.length;
  function at(i) {
    return bytes[i] & 0xff;
  }
  function ascii(from, to) {
    var s = '';
    for (var i = from; i < Math.min(to, n); i++) s += String.fromCharCode(at(i));
    return s;
  }
  if (ascii(0, 1024).indexOf('%PDF-') !== -1) {
    // the /Encrypt entry lives in the trailer or the cross-reference stream
    return ascii(Math.max(0, n - 65536), n).indexOf('/Encrypt') !== -1 || ascii(0, 65536).indexOf('/Encrypt') !== -1
      ? 'pdf'
      : null;
  }
  var cfb = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
  if (
    n > 8 &&
    cfb.every(function (b, i) {
      return at(i) === b;
    })
  ) {
    // encrypted OOXML stores its streams under these UTF-16 names
    return ascii(0, Math.min(n, 1 << 20)).indexOf('E\u0000n\u0000c\u0000r\u0000y\u0000p\u0000t\u0000i\u0000o\u0000n\u0000I\u0000n\u0000f\u0000o') !== -1
      ? 'ooxml'
      : null;
  }
  if (n > 8 && at(0) === 0x50 && at(1) === 0x4b && at(2) === 0x03 && at(3) === 0x04) {
    // any local file header with general purpose flag bit 0 (= encrypted)
    for (var i = 0; i + 8 < n; i++) {
      if (at(i) === 0x50 && at(i + 1) === 0x4b && at(i + 2) === 0x03 && at(i + 3) === 0x04 && (at(i + 6) & 1) === 1) {
        return 'zip';
      }
    }
    return null;
  }
  return null;
}

function onGmailMessageOpen(e) {
  var s = strings_(e);
  GmailApp.setCurrentMessageAccessToken(e.gmail.accessToken);
  var message = GmailApp.getMessageById(e.gmail.messageId);
  var attachments = message.getAttachments({ includeInlineImages: false });

  var section = CardService.newCardSection().addWidget(CardService.newTextParagraph().setText(s.intro));
  var found = 0;
  attachments.forEach(function (att, index) {
    if (att.getSize() > MAX_BYTES) return;
    var kind = detectProtected_(att.getBytes());
    if (!kind) return;
    found++;
    section.addWidget(
      CardService.newDecoratedText()
        .setText(att.getName())
        .setBottomLabel(s.protectedLabel)
        .setWrapText(true)
        .setButton(
          CardService.newTextButton()
            .setText(s.open)
            .setOnClickAction(
              CardService.newAction()
                .setFunctionName('openInUnpassword')
                .setParameters({ messageId: e.gmail.messageId, index: String(index) }),
            ),
        ),
    );
  });
  if (!found) section.addWidget(CardService.newTextParagraph().setText(s.none));

  return CardService.newCardBuilder().setHeader(CardService.newCardHeader().setTitle(s.header)).addSection(section).build();
}

function inboxFolderId_() {
  var q =
    "mimeType = 'application/vnd.google-apps.folder' and name = '" +
    INBOX_FOLDER.replace(/'/g, "\\'") +
    "' and trashed = false";
  // With drive.file this only sees folders unpassword created itself.
  var res = Drive.Files.list({ q: q, fields: 'files(id)', pageSize: 1 });
  if (res.files && res.files.length) return res.files[0].id;
  return Drive.Files.create({ name: INBOX_FOLDER, mimeType: 'application/vnd.google-apps.folder' }, null, {
    fields: 'id',
  }).id;
}

function openInUnpassword(e) {
  var s = strings_(e);
  try {
    GmailApp.setCurrentMessageAccessToken(e.gmail.accessToken);
    var params = e.commonEventObject.parameters;
    var message = GmailApp.getMessageById(params.messageId);
    var att = message.getAttachments({ includeInlineImages: false })[Number(params.index)];
    // The blob is the encrypted attachment exactly as received.
    var file = Drive.Files.create(
      { name: att.getName(), parents: [inboxFolderId_()], appProperties: { unpassword: 'inbox' } },
      att.copyBlob(),
      { fields: 'id' },
    );
    var url = webAppUrl_() + '#/drive?fileId=' + encodeURIComponent(file.id);
    return CardService.newActionResponseBuilder()
      .setOpenLink(
        CardService.newOpenLink()
          .setUrl(url)
          .setOpenAs(CardService.OpenAs.FULL_SIZE)
          .setOnClose(CardService.OnClose.NOTHING),
      )
      .build();
  } catch (err) {
    console.error('openInUnpassword failed: ' + (err && err.message));
    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification().setText(s.failed))
      .build();
  }
}

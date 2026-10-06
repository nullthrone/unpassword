import { detectFormat } from '../core/detect';
import type { Format } from '../core/types';
import { formatSize, outputMimeType, outputName } from '../files';
import { getAccessToken } from '../google/auth';
import { driveEnabled } from '../google/config';
import { DriveError, download, getMetadata, launchFileId, trash, uploadNextTo } from '../google/drive';
import { pickDriveFile } from '../google/picker';
import { t } from '../i18n';
import type { UnlockOutcome } from '../protocol';
import { UnlockFailed, Unlocker } from '../unlocker';
import { clear, h } from './dom';

interface Source {
  name: string;
  data: Uint8Array;
  format: Format | null;
  drive?: { id: string; parents?: string[] };
}

export class App {
  private readonly unlocker = new Unlocker();
  private source: Source | null = null;
  private result: UnlockOutcome | null = null;
  private readonly main: HTMLElement;
  private cooldownTimer: number | undefined;

  constructor(root: HTMLElement) {
    this.main = h('main', { class: 'card' });
    root.append(this.header(), this.main, this.footer());
  }

  async start(): Promise<void> {
    const id = driveEnabled ? launchFileId() : null;
    if (id) {
      history.replaceState(null, '', location.pathname);
      await this.loadFromDrive(id);
    } else {
      this.renderPick();
    }
  }

  // ---------------------------------------------------------------- layout

  private header(): HTMLElement {
    return h(
      'header',
      { class: 'intro' },
      h('h1', {}, h('span', { class: 'logo', 'aria-hidden': 'true' }, '◇'), t.title),
      h('p', { class: 'tagline' }, t.tagline),
      h(
        'ul',
        { class: 'principles' },
        h('li', {}, t.principleLocal),
        h('li', {}, t.principleKnown),
        h('li', {}, t.principleArchive),
      ),
    );
  }

  private footer(): HTMLElement {
    return h(
      'footer',
      {},
      h('details', {}, h('summary', {}, t.privacyTitle), h('ul', {}, ...t.privacy.map((p) => h('li', {}, p)))),
      h(
        'p',
        { class: 'muted' },
        h('a', { href: 'https://github.com/nullthrone/unpassword', rel: 'noopener' }, t.source),
      ),
    );
  }

  // ---------------------------------------------------------------- step 1: pick

  private renderPick(message?: string): void {
    this.reset();
    const input = h('input', { type: 'file', id: 'file', class: 'visually-hidden' });
    input.addEventListener('change', () => {
      const f = input.files?.[0];
      if (f) void this.loadLocal(f);
    });
    const drop = h(
      'label',
      { class: 'dropzone', for: 'file' },
      h('strong', {}, t.chooseLocal),
      h('span', {}, t.dropHint),
      h('span', { class: 'muted' }, t.formats),
    );
    drop.addEventListener('dragover', (e) => {
      e.preventDefault();
      drop.classList.add('over');
    });
    drop.addEventListener('dragleave', () => drop.classList.remove('over'));
    drop.addEventListener('drop', (e) => {
      e.preventDefault();
      drop.classList.remove('over');
      const f = e.dataTransfer?.files[0];
      if (f) void this.loadLocal(f);
    });

    clear(this.main);
    if (message) this.main.append(h('p', { class: 'notice error', role: 'alert' }, message));
    this.main.append(input, drop);
    if (driveEnabled) {
      this.main.append(
        h('button', { type: 'button', class: 'secondary', onclick: () => void this.pickFromDrive() }, t.chooseDrive),
      );
    }
  }

  private async loadLocal(file: File): Promise<void> {
    const data = new Uint8Array(await file.arrayBuffer());
    this.setSource({ name: file.name, data, format: detectFormat(data) });
  }

  private async pickFromDrive(): Promise<void> {
    try {
      this.busy(t.driveSignIn);
      const id = await pickDriveFile();
      if (id) await this.loadFromDrive(id);
      else this.renderPick();
    } catch (e) {
      console.warn(e);
      this.renderPick(t.errors.network);
    }
  }

  private async loadFromDrive(id: string): Promise<void> {
    try {
      this.busy(t.loadingDrive);
      const token = await getAccessToken();
      const meta = await getMetadata(token, id);
      const data = await download(token, id);
      this.setSource({ name: meta.name, data, format: detectFormat(data), drive: { id, parents: meta.parents } });
    } catch (e) {
      console.warn(e);
      const noAccess = e instanceof DriveError && (e.status === 403 || e.status === 404);
      this.renderPick(noAccess ? t.driveFileUnavailable : t.errors.network);
    }
  }

  private setSource(source: Source): void {
    this.reset();
    this.source = source;
    if (!source.format) {
      this.renderPick(t.unknownType);
      return;
    }
    this.renderPassword();
  }

  // ---------------------------------------------------------------- step 2: password

  private fileSummary(): HTMLElement {
    const s = this.source!;
    return h(
      'div',
      { class: 'file' },
      h('span', { class: 'badge' }, s.format ? t.type[s.format] : '?'),
      h('span', { class: 'name', title: s.name }, s.name),
      h('span', { class: 'muted' }, formatSize(s.data.length)),
    );
  }

  private renderPassword(): void {
    const s = this.source!;
    const status = h('p', { class: 'status', role: 'status', 'aria-live': 'polite' });
    const pw = h('input', {
      type: 'password',
      id: 'password',
      name: 'unpassword-current-password',
      autocomplete: 'off',
      autocapitalize: 'off',
      spellcheck: 'false',
      required: true,
    });
    const attest = h('input', { type: 'checkbox', id: 'attest', required: true });
    const submit = h('button', { type: 'submit' }, t.submit);
    const form = h(
      'form',
      { class: 'unlock', novalidate: false },
      h('label', { for: 'password' }, t.password),
      pw,
      s.format === 'pdf' ? h('p', { class: 'hint muted' }, t.passwordHint) : null,
      h('label', { class: 'check' }, attest, h('span', {}, t.attest)),
      submit,
      status,
    );

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!pw.value) {
        status.textContent = t.errors['empty-password'];
        return;
      }
      const password = pw.value;
      pw.value = '';
      submit.disabled = true;
      status.className = 'status';
      status.textContent = t.working;
      try {
        this.result = await this.unlocker.unlock(s.data, password);
        this.renderResult();
      } catch (err) {
        status.className = 'status error';
        if (!(err instanceof UnlockFailed)) {
          console.warn(err);
          status.textContent = t.errors.corrupt;
          submit.disabled = false;
          return;
        }
        const f = err.failure;
        const parts = [t.errors[f.code]];
        if (f.code === 'wrong-password' && f.remainingAttempts !== undefined)
          parts.push(t.remaining(f.remainingAttempts));
        status.textContent = parts.join(' ');
        if (f.code === 'locked' || f.code === 'not-encrypted' || f.code === 'unsupported') {
          pw.disabled = true;
          return;
        }
        this.cooldown(f.retryAfterMs ?? 0, submit, status, parts.join(' '));
        pw.focus();
      }
    });

    clear(this.main);
    this.main.append(this.fileSummary(), form, this.anotherButton());
    pw.focus();
  }

  private cooldown(ms: number, button: HTMLButtonElement, status: HTMLElement, prefix: string): void {
    window.clearInterval(this.cooldownTimer);
    if (ms <= 0) {
      button.disabled = false;
      return;
    }
    const until = Date.now() + ms;
    const tick = () => {
      const left = Math.ceil((until - Date.now()) / 1000);
      if (left <= 0) {
        window.clearInterval(this.cooldownTimer);
        status.textContent = prefix;
        button.disabled = false;
      } else {
        status.textContent = `${prefix} ${t.retryIn(left)}`;
      }
    };
    tick();
    this.cooldownTimer = window.setInterval(tick, 1000);
  }

  // ---------------------------------------------------------------- step 3: result

  private renderResult(): void {
    const s = this.source!;
    const r = this.result!;
    const name = outputName(s.name, t.unlockedSuffix, r.format);
    const mime = outputMimeType(s.name, r.format);
    const status = h('p', { class: 'status', role: 'status', 'aria-live': 'polite' });
    const actions = h(
      'div',
      { class: 'actions' },
      h('button', { type: 'button', onclick: () => this.download(name, mime) }, t.download),
    );
    let trashRow: HTMLElement | null = null;

    if (s.drive && driveEnabled) {
      const drive = s.drive;
      const trashBox = h('input', { type: 'checkbox', id: 'trash' });
      trashRow = h('label', { class: 'check' }, trashBox, h('span', {}, t.trashOriginal));
      const save = h('button', { type: 'button', class: 'secondary' }, t.saveDrive);
      save.addEventListener('click', async () => {
        save.disabled = true;
        status.className = 'status';
        status.textContent = t.saving;
        try {
          const token = await getAccessToken();
          const { file, inParent } = await uploadNextTo(
            token,
            { name, mimeType: mime, parents: drive.parents },
            new Uint8Array(r.data),
          );
          if (trashBox.checked) await trash(token, drive.id);
          const link = `https://drive.google.com/file/d/${encodeURIComponent(file.id)}/view`;
          status.replaceChildren(
            `${inParent ? t.saved : t.savedRoot} ${file.name} – `,
            h('a', { href: link, target: '_blank', rel: 'noopener' }, t.openInDrive),
          );
        } catch (e) {
          console.warn(e);
          status.className = 'status error';
          status.textContent = t.errors.network;
          save.disabled = false;
        }
      });
      actions.append(save);
    }

    clear(this.main);
    this.main.append(
      this.fileSummary(),
      h('p', { class: 'notice success' }, t.done[r.mode]),
      ...r.warnings.map((w) => h('p', { class: 'notice warning' }, t.warning[w])),
      actions,
    );
    if (trashRow) this.main.append(trashRow);
    this.main.append(status, this.anotherButton());
  }

  private download(name: string, mime: string): void {
    const url = URL.createObjectURL(new Blob([this.result!.data], { type: mime }));
    const a = h('a', { href: url, download: name });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }

  // ---------------------------------------------------------------- helpers

  private anotherButton(): HTMLElement {
    return h('button', { type: 'button', class: 'link', onclick: () => this.renderPick() }, t.another);
  }

  private busy(text: string): void {
    clear(this.main);
    this.main.append(h('p', { class: 'status', role: 'status', 'aria-live': 'polite' }, text));
  }

  /** Drop references to file contents and wipe the decrypted copy. */
  private reset(): void {
    window.clearInterval(this.cooldownTimer);
    if (this.result) new Uint8Array(this.result.data).fill(0);
    this.result = null;
    this.source = null;
  }
}

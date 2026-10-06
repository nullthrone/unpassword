import createModule from '@neslinesli93/qpdf-wasm';
import { UnpasswordError } from '../types';
import { passwordEncodings } from './password';
import type { PdfCapabilities, PdfEncryptionInfo } from './policy';

let wasmLocation: string | null = null;

/**
 * Where Emscripten loads qpdf.wasm from: the bundled same-origin asset URL in
 * the browser, a file path under Node (tests).
 */
export function setQpdfWasmLocation(location: string): void {
  wasmLocation = location;
}

interface QpdfRun {
  code: number;
  stdout: string;
  stderr: string;
  output: Uint8Array | null;
}

interface EmscriptenModule {
  callMain(args: string[]): number;
  FS: {
    init(input: () => number | null, output: (c: number | null) => void, error: (c: number | null) => void): void;
    writeFile(path: string, data: Uint8Array): void;
    readFile(path: string): Uint8Array;
    unlink(path: string): void;
  };
}

const IN = '/in.pdf';
const OUT = '/out.pdf';

/**
 * Runs one qpdf command in a fresh module instance, so no state (and no
 * plaintext in the WASM heap) survives between operations.
 */
async function runQpdf(input: Uint8Array, args: (inPath: string, outPath: string) => string[]): Promise<QpdfRun> {
  const location = wasmLocation;
  if (!location) throw new Error('qpdf wasm location not configured');

  const out: number[] = [];
  const err: number[] = [];
  const factory = createModule as unknown as (opts: object) => Promise<EmscriptenModule>;
  const mod = await factory({
    locateFile: () => location,
    noInitialRun: true,
    preRun: [
      (m: EmscriptenModule) =>
        m.FS.init(
          () => null,
          (c) => {
            if (c !== null) out.push(c);
          },
          (c) => {
            if (c !== null) err.push(c);
          },
        ),
    ],
  });

  // Under Node (tests) Emscripten reports qpdf's exit status via process.exitCode.
  const proc = (globalThis as { process?: { exitCode?: number | string } }).process;
  const savedExitCode = proc?.exitCode;
  mod.FS.writeFile(IN, input);
  let code: number;
  try {
    code = mod.callMain(args(IN, OUT));
  } finally {
    if (proc) proc.exitCode = savedExitCode;
  }
  let output: Uint8Array | null;
  try {
    output = mod.FS.readFile(OUT).slice();
  } catch {
    output = null;
  }
  // Best effort: wipe the in-memory file system copies.
  for (const p of [IN, OUT]) {
    try {
      mod.FS.writeFile(p, new Uint8Array(0));
      mod.FS.unlink(p);
    } catch {
      /* not present */
    }
  }
  const decoder = new TextDecoder();
  return { code, stdout: decoder.decode(new Uint8Array(out)), stderr: decoder.decode(new Uint8Array(err)), output };
}

/** A password as raw bytes (hex), as qpdf's `--password-mode=hex-bytes` expects it. */
export type PasswordBytes = { hex: string };

function passwordArgs(pw: PasswordBytes): string[] {
  return ['--password-mode=hex-bytes', `--password=${pw.hex}`];
}

export const EMPTY_PASSWORD: PasswordBytes = { hex: '' };

/**
 * Inspects the encryption dictionary with the typed password. Returns `null`
 * when qpdf rejects it, otherwise the encryption info together with the byte
 * encoding of the password that qpdf accepted.
 */
export async function inspectEncryption(
  input: Uint8Array,
  password: string,
): Promise<(PdfEncryptionInfo & { password: PasswordBytes }) | null> {
  const encodings = password === '' ? [''] : passwordEncodings(password);
  for (const hex of encodings) {
    const pw = { hex };
    const info = await inspectWith(input, pw);
    if (info) return { ...info, password: pw };
  }
  return null;
}

async function inspectWith(input: Uint8Array, pw: PasswordBytes): Promise<PdfEncryptionInfo | null> {
  const run = await runQpdf(input, (inPath) => ['--json=2', '--json-key=encrypt', ...passwordArgs(pw), inPath]);
  if (run.code !== 0 && run.code !== 3) {
    if (/invalid password/i.test(run.stderr)) return null;
    throw classifyFailure(run.stderr);
  }
  let parsed: {
    encrypt?: {
      encrypted: boolean;
      userpasswordmatched: boolean;
      ownerpasswordmatched: boolean;
      capabilities: PdfCapabilities;
    };
  };
  try {
    parsed = JSON.parse(run.stdout);
  } catch (cause) {
    throw new UnpasswordError('corrupt', 'could not read PDF encryption information', { cause });
  }
  const e = parsed.encrypt;
  if (!e) throw new UnpasswordError('corrupt', 'could not read PDF encryption information');
  return {
    encrypted: e.encrypted,
    userPasswordMatched: e.userpasswordmatched,
    ownerPasswordMatched: e.ownerpasswordmatched,
    capabilities: { ...e.capabilities },
  };
}

function classifyFailure(stderr: string): UnpasswordError {
  const msg = stderr.trim().split('\n').pop() ?? '';
  if (/unsupported|unknown security handler|filter|PubSec|certificate/i.test(stderr)) {
    return new UnpasswordError('unsupported', msg || 'unsupported PDF security handler');
  }
  return new UnpasswordError('corrupt', msg || 'qpdf failed');
}

function finish(run: QpdfRun): Uint8Array {
  // exit code 3 = success with warnings
  if ((run.code !== 0 && run.code !== 3) || !run.output) throw classifyFailure(run.stderr);
  return run.output;
}

export async function decryptPdf(input: Uint8Array, password: PasswordBytes): Promise<Uint8Array> {
  return finish(await runQpdf(input, (i, o) => [...passwordArgs(password), '--decrypt', i, o]));
}

function yn(v: boolean): string {
  return v ? 'y' : 'n';
}

/** qpdf arguments that reproduce the given permissions with 256-bit AES. */
export function permissionArgs(c: PdfCapabilities): string[] {
  return [
    `--print=${c.printhigh ? 'full' : c.printlow ? 'low' : 'none'}`,
    `--extract=${yn(c.extract)}`,
    `--accessibility=${yn(c.accessibility)}`,
    `--assemble=${yn(c.modifyassembly)}`,
    `--annotate=${yn(c.modifyannotations)}`,
    `--form=${yn(c.modifyforms)}`,
    `--modify-other=${yn(c.modifyother)}`,
  ];
}

/**
 * Removes the open password but keeps the author's restrictions: re-encrypts
 * with AES-256, an empty user password and a random owner password that is
 * discarded immediately.
 */
export async function removeOpenPasswordKeepRestrictions(
  input: Uint8Array,
  password: PasswordBytes,
  capabilities: PdfCapabilities,
): Promise<Uint8Array> {
  const ownerBytes = crypto.getRandomValues(new Uint8Array(32));
  const owner = Array.from(ownerBytes, (b) => b.toString(16).padStart(2, '0')).join('');
  ownerBytes.fill(0);
  return finish(
    await runQpdf(input, (i, o) => [
      ...passwordArgs(password),
      i,
      '--encrypt',
      '--user-password=',
      `--owner-password=${owner}`,
      '--bits=256',
      ...permissionArgs(capabilities),
      '--',
      o,
    ]),
  );
}

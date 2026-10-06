export type Format = 'pdf' | 'ooxml' | 'zip';

/**
 * What happened to the file:
 * - `decrypted`: all encryption removed.
 * - `open-password-removed`: PDF only. The open password is gone, but the
 *   author's permission restrictions are kept (re-encrypted with an empty user
 *   password and a random, discarded owner password).
 */
export type UnlockMode = 'decrypted' | 'open-password-removed';

/**
 * Non-fatal findings the user should see.
 * - `integrity-check-failed`: Office data-integrity HMAC mismatch. The
 *   password was verified and the content decrypted, but the file was either
 *   modified after encryption or written by a non-conforming tool.
 */
export type UnlockWarning = 'integrity-check-failed';

export interface UnlockResult {
  format: Format;
  mode: UnlockMode;
  warnings: UnlockWarning[];
  data: Uint8Array;
}

export type ErrorCode =
  /** The supplied password does not open the file. Counts as a failed attempt. */
  | 'wrong-password'
  /** No password was supplied. */
  | 'empty-password'
  /** The file carries no password protection that unpassword would remove. */
  | 'not-encrypted'
  /** The file is protected, but only by restrictions that need the owner password. */
  | 'owner-password-required'
  /** Format or protection scheme is not supported (e.g. DRM, certificates, legacy Office). */
  | 'unsupported'
  /** ZIP entries use different passwords. */
  | 'mixed-passwords'
  /** Output would exceed the size limits. */
  | 'too-large'
  /** The file is damaged or failed an integrity check. */
  | 'corrupt'
  /** Too many failed attempts; wait `retryAfterMs`. */
  | 'cooldown'
  /** Too many failed attempts; the file is locked for this session. */
  | 'locked';

export class UnpasswordError extends Error {
  readonly code: ErrorCode;
  readonly retryAfterMs?: number;
  readonly remainingAttempts?: number;

  constructor(
    code: ErrorCode,
    message?: string,
    options?: { cause?: unknown; retryAfterMs?: number; remainingAttempts?: number },
  ) {
    super(message ?? code, options?.cause === undefined ? undefined : { cause: options.cause });
    this.name = 'UnpasswordError';
    this.code = code;
    this.retryAfterMs = options?.retryAfterMs;
    this.remainingAttempts = options?.remainingAttempts;
  }
}

/**
 * A format handler takes exactly one password. There is intentionally no
 * variant accepting several candidates: unpassword never guesses.
 */
export type Unlocker = (input: Uint8Array, password: string) => Promise<UnlockResult>;

export const MAX_INPUT_BYTES = 512 * 1024 * 1024;
export const MAX_OUTPUT_BYTES = 1024 * 1024 * 1024;

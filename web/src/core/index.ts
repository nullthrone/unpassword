import { detectFormat } from './detect';
import { UnpasswordError, MAX_INPUT_BYTES, type Format, type UnlockResult, type Unlocker } from './types';

export { detectFormat } from './detect';
export { AttemptGuard, DEFAULT_POLICY } from './guard';
export * from './types';

const loaders: Record<Format, () => Promise<Unlocker>> = {
  pdf: async () => (await import('./pdf/index')).unlockPdf,
  ooxml: async () => (await import('./office/index')).unlockOoxml,
  zip: async () => (await import('./zip/index')).unlockZip,
};

/**
 * Removes the password protection from `input` using exactly one password the
 * user knows. Never retries, never guesses.
 */
export async function unlock(input: Uint8Array, password: string): Promise<UnlockResult> {
  if (password.length === 0) throw new UnpasswordError('empty-password');
  if (input.length > MAX_INPUT_BYTES) throw new UnpasswordError('too-large', 'file is too large');
  const format = detectFormat(input);
  if (!format) throw new UnpasswordError('unsupported', 'unrecognised file type');
  const unlocker = await loaders[format]();
  return unlocker(input, password);
}

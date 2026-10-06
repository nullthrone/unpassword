import { AttemptGuard } from './guard';
import { unlock } from './index';
import { UnpasswordError, type UnlockResult } from './types';

async function fingerprint(data: Uint8Array): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', data as Uint8Array<ArrayBuffer>));
  return Array.from(digest, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * The only entry point the UI uses: one password per call, rate limited per
 * file (identified by the SHA-256 of its encrypted bytes).
 */
export class UnlockSession {
  constructor(private readonly guard: AttemptGuard = new AttemptGuard()) {}

  async attempt(input: Uint8Array, password: string): Promise<UnlockResult> {
    const key = await fingerprint(input);
    this.guard.assertAllowed(key);
    try {
      const result = await unlock(input, password);
      this.guard.recordSuccess(key);
      return result;
    } catch (e) {
      if (e instanceof UnpasswordError && e.code === 'wrong-password') {
        const st = this.guard.recordFailure(key);
        if (st.locked) throw new UnpasswordError('locked', 'too many failed attempts for this file', { cause: e });
        throw new UnpasswordError('wrong-password', e.message, {
          cause: e,
          retryAfterMs: st.retryAfterMs,
          remainingAttempts: st.remaining,
        });
      }
      throw e;
    }
  }
}

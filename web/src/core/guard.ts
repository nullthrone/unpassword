import { UnpasswordError } from './types';

export interface GuardPolicy {
  /** Failed attempts allowed without delay. */
  freeAttempts: number;
  /** Delay after the first failure beyond `freeAttempts`, doubling afterwards. */
  baseDelayMs: number;
  /** After this many failures the file is locked for the session. */
  maxFailures: number;
}

export const DEFAULT_POLICY: GuardPolicy = { freeAttempts: 2, baseDelayMs: 5_000, maxFailures: 10 };

interface State {
  failures: number;
  nextAllowedAt: number;
}

export interface GuardStatus {
  failures: number;
  remaining: number;
  retryAfterMs: number;
  locked: boolean;
}

/**
 * Rate limits password attempts per file. This is not a cryptographic
 * boundary – the code is open source and runs on the user's machine – but it
 * ensures that unpassword itself is useless as a guessing tool: it accepts one
 * typed password at a time and slows down quickly.
 */
export class AttemptGuard {
  private readonly states = new Map<string, State>();

  constructor(
    private readonly policy: GuardPolicy = DEFAULT_POLICY,
    private readonly now: () => number = () => Date.now(),
  ) {}

  status(key: string): GuardStatus {
    const s = this.states.get(key) ?? { failures: 0, nextAllowedAt: 0 };
    return {
      failures: s.failures,
      remaining: Math.max(0, this.policy.maxFailures - s.failures),
      retryAfterMs: Math.max(0, s.nextAllowedAt - this.now()),
      locked: s.failures >= this.policy.maxFailures,
    };
  }

  /** Throws `locked` or `cooldown` if an attempt is not allowed right now. */
  assertAllowed(key: string): void {
    const st = this.status(key);
    if (st.locked) throw new UnpasswordError('locked', 'too many failed attempts for this file');
    if (st.retryAfterMs > 0) {
      throw new UnpasswordError('cooldown', 'please wait before the next attempt', { retryAfterMs: st.retryAfterMs });
    }
  }

  recordFailure(key: string): GuardStatus {
    const s = this.states.get(key) ?? { failures: 0, nextAllowedAt: 0 };
    s.failures += 1;
    const over = s.failures - this.policy.freeAttempts;
    s.nextAllowedAt = over > 0 ? this.now() + this.policy.baseDelayMs * 2 ** (over - 1) : 0;
    this.states.set(key, s);
    return this.status(key);
  }

  recordSuccess(key: string): void {
    this.states.delete(key);
  }
}

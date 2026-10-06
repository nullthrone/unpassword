import { beforeAll, describe, expect, it } from 'vitest';
import { AttemptGuard } from '../src/core/guard';
import { UnlockSession } from '../src/core/session';
import { UnpasswordError } from '../src/core/types';
import { PW, fixture, useNodeQpdf } from './helpers';

beforeAll(useNodeQpdf);

async function error(p: Promise<unknown>): Promise<UnpasswordError> {
  try {
    await p;
  } catch (e) {
    if (e instanceof UnpasswordError) return e;
    throw e;
  }
  throw new Error('expected an error');
}

describe('UnlockSession', () => {
  it('unlocks with the right password', async () => {
    const s = new UnlockSession();
    expect((await s.attempt(fixture('zip/aes.zip'), PW.zip)).format).toBe('zip');
  });

  it('rejects an empty password without counting it', async () => {
    const s = new UnlockSession();
    expect((await error(s.attempt(fixture('zip/aes.zip'), ''))).code).toBe('empty-password');
  });

  it('rate limits wrong passwords per file and eventually locks', async () => {
    let now = 0;
    const s = new UnlockSession(new AttemptGuard(undefined, () => now));
    const data = fixture('zip/aes.zip');

    const e1 = await error(s.attempt(data, 'a'));
    expect(e1).toMatchObject({ code: 'wrong-password', remainingAttempts: 9, retryAfterMs: 0 });
    await error(s.attempt(data, 'b'));
    const e3 = await error(s.attempt(data, 'c'));
    expect(e3).toMatchObject({ code: 'wrong-password', retryAfterMs: 5_000 });

    // even the right password is refused during the cooldown
    expect((await error(s.attempt(data, PW.zip))).code).toBe('cooldown');

    for (let i = 0; i < 6; i++) {
      now += 10 ** 9;
      await error(s.attempt(data, `x${i}`));
    }
    now += 10 ** 9;
    expect((await error(s.attempt(data, 'last'))).code).toBe('locked');
    now += 10 ** 9;
    expect((await error(s.attempt(data, PW.zip))).code).toBe('locked');
  });
});

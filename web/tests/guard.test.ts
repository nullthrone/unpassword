import { describe, expect, it } from 'vitest';
import { AttemptGuard } from '../src/core/guard';
import { UnpasswordError } from '../src/core/types';

function setup() {
  let now = 0;
  const guard = new AttemptGuard(undefined, () => now);
  return { guard, advance: (ms: number) => (now += ms) };
}

function code(fn: () => void): string | null {
  try {
    fn();
    return null;
  } catch (e) {
    return (e as UnpasswordError).code;
  }
}

describe('AttemptGuard', () => {
  it('allows two failures without delay, then backs off exponentially', () => {
    const { guard, advance } = setup();
    guard.recordFailure('f');
    expect(code(() => guard.assertAllowed('f'))).toBeNull();
    guard.recordFailure('f');
    expect(code(() => guard.assertAllowed('f'))).toBeNull();

    expect(guard.recordFailure('f').retryAfterMs).toBe(5_000);
    expect(code(() => guard.assertAllowed('f'))).toBe('cooldown');
    advance(5_000);
    expect(code(() => guard.assertAllowed('f'))).toBeNull();

    expect(guard.recordFailure('f').retryAfterMs).toBe(10_000);
    advance(9_999);
    expect(code(() => guard.assertAllowed('f'))).toBe('cooldown');
    advance(1);
    expect(guard.recordFailure('f').retryAfterMs).toBe(20_000);
  });

  it('locks after ten failures for the rest of the session', () => {
    const { guard, advance } = setup();
    for (let i = 0; i < 10; i++) {
      guard.recordFailure('f');
      advance(10 ** 9);
    }
    expect(guard.status('f')).toMatchObject({ locked: true, remaining: 0 });
    expect(code(() => guard.assertAllowed('f'))).toBe('locked');
  });

  it('tracks files independently and resets on success', () => {
    const { guard } = setup();
    for (let i = 0; i < 3; i++) guard.recordFailure('a');
    expect(code(() => guard.assertAllowed('b'))).toBeNull();
    guard.recordSuccess('a');
    expect(guard.status('a').failures).toBe(0);
  });
});

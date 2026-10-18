import { describe, expect, it } from 'vitest';

import type { Clock } from './platform';

describe('core', () => {
  it('exposes platform interfaces that can be satisfied by plain objects', () => {
    const clock: Clock = { now: () => new Date('2026-01-01T00:00:00Z') };

    expect(clock.now().getUTCFullYear()).toBe(2026);
  });
});

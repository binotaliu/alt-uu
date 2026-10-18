import type { Clock } from '@altuu/core';

export const clock: Clock = { now: () => new Date() };

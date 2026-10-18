import { getRandomBytes } from 'expo-crypto';
import type { RandomBytes } from '@altuu/core';

export const random: RandomBytes = {
  getRandomBytes: (length) => getRandomBytes(length),
};

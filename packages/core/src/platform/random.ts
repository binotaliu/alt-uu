/** Cryptographically secure random source (expo-crypto on mobile). */
export interface RandomBytes {
  getRandomBytes(length: number): Uint8Array;
}

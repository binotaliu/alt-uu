import type { KeyValueStoreRepository } from '../../db/keyValueStore';
import type { RandomBytes } from '../../platform';

export const DIAGNOSTIC_SALT_KEY = 'diagnostics.salt';

const ALPHANUMERIC =
  'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

/**
 * Port of legacy DiagnosticSalt: the per-install salt used to pseudonymize
 * identifiers. Generated once and kept in the key-value store, so a handle
 * stays stable for the install and never matches another install's.
 */
export class DiagnosticSalt {
  private cached: string | null = null;

  constructor(
    private readonly keyValues: KeyValueStoreRepository,
    private readonly random: RandomBytes,
  ) {}

  async value(): Promise<string> {
    if (this.cached !== null) {
      return this.cached;
    }

    try {
      const stored = await this.keyValues.get(DIAGNOSTIC_SALT_KEY);

      if (stored !== null && stored !== '') {
        return (this.cached = stored);
      }

      const salt = this.generate();
      await this.keyValues.set(DIAGNOSTIC_SALT_KEY, salt);

      return (this.cached = salt);
    } catch {
      // No storage yet: a process-lifetime salt keeps one report readable.
      return (this.cached = this.generate());
    }
  }

  private generate(): string {
    const bytes = this.random.getRandomBytes(40);

    return Array.from(
      bytes,
      (byte) => ALPHANUMERIC[byte % ALPHANUMERIC.length],
    ).join('');
  }
}

import { eq } from 'drizzle-orm';
import type { Clock } from '../platform';
import { keyValueStore } from './schema';
import type { AltUUDatabase } from './types';

/** Port of the legacy `KeyValueStore` model (string values by string key). */
export class KeyValueStoreRepository {
  constructor(
    private readonly db: AltUUDatabase,
    private readonly clock: Clock,
  ) {}

  async get(key: string): Promise<string | null> {
    const rows = await this.db
      .select({ value: keyValueStore.value })
      .from(keyValueStore)
      .where(eq(keyValueStore.key, key))
      .limit(1);

    return rows[0]?.value ?? null;
  }

  async set(key: string, value: string): Promise<void> {
    const now = this.clock.now();

    await this.db
      .insert(keyValueStore)
      .values({ key, value, createdAt: now, updatedAt: now })
      .onConflictDoUpdate({
        target: keyValueStore.key,
        set: { value, updatedAt: now },
      });
  }

  async delete(key: string): Promise<void> {
    await this.db.delete(keyValueStore).where(eq(keyValueStore.key, key));
  }

  async has(key: string): Promise<boolean> {
    return (await this.get(key)) !== null;
  }
}

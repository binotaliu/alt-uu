import { eq, lte, and, isNotNull } from 'drizzle-orm';
import type { Clock } from '../platform';
import { cache } from './schema';
import type { AltUUDatabase } from './types';

/** Seconds from now, or an absolute expiry (Laravel `now()->addDays()`). */
export type CacheTtl = number | Date | null;

/**
 * Port of Laravel's database cache store. Values are JSON-encoded. As in
 * Laravel, a stored `null` reads as a miss, and a TTL of zero or less
 * removes the key instead of storing it.
 */
export class CacheRepository {
    constructor(
        private readonly db: AltUUDatabase,
        private readonly clock: Clock,
    ) {}

    async get<T = unknown>(key: string): Promise<T | null>;
    async get<T>(key: string, fallback: T): Promise<T>;
    async get<T>(key: string, fallback: T | null = null): Promise<T | null> {
        const rows = await this.db
            .select()
            .from(cache)
            .where(eq(cache.key, key))
            .limit(1);
        const row = rows[0];

        if (row === undefined) {
            return fallback;
        }

        if (row.expiresAt !== null && row.expiresAt <= this.nowMillis()) {
            await this.forget(key);

            return fallback;
        }

        const value = JSON.parse(row.value) as T | null;

        return value === null ? fallback : value;
    }

    async has(key: string): Promise<boolean> {
        return (await this.get(key)) !== null;
    }

    async put(key: string, value: unknown, ttl: CacheTtl): Promise<void> {
        const expiresAt = this.resolveExpiry(ttl);

        if (expiresAt !== null && expiresAt <= this.nowMillis()) {
            await this.forget(key);

            return;
        }

        const encoded = JSON.stringify(value ?? null);

        await this.db
            .insert(cache)
            .values({ key, value: encoded, expiresAt })
            .onConflictDoUpdate({
                target: cache.key,
                set: { value: encoded, expiresAt },
            });
    }

    async forever(key: string, value: unknown): Promise<void> {
        await this.put(key, value, null);
    }

    async forget(key: string): Promise<void> {
        await this.db.delete(cache).where(eq(cache.key, key));
    }

    async remember<T>(
        key: string,
        ttl: CacheTtl,
        callback: () => Promise<T> | T,
    ): Promise<T> {
        const cached = await this.get<T>(key);

        if (cached !== null) {
            return cached;
        }

        const value = await callback();
        await this.put(key, value, ttl);

        return value;
    }

    /** Deletes every expired row; returns nothing, safe to call at startup. */
    async pruneExpired(): Promise<void> {
        await this.db
            .delete(cache)
            .where(
                and(
                    isNotNull(cache.expiresAt),
                    lte(cache.expiresAt, this.nowMillis()),
                ),
            );
    }

    async flush(): Promise<void> {
        await this.db.delete(cache);
    }

    private nowMillis(): number {
        return this.clock.now().getTime();
    }

    private resolveExpiry(ttl: CacheTtl): number | null {
        if (ttl === null) {
            return null;
        }

        if (ttl instanceof Date) {
            return ttl.getTime();
        }

        return this.nowMillis() + ttl * 1000;
    }
}

import { describe, expect, it, vi } from 'vitest';
import { createTestContext } from './helpers';

describe('CacheRepository', () => {
    it('stores and reads JSON values, with fallback on miss', async () => {
        const { cache } = await createTestContext();

        await cache.put('k', { a: 1 }, 60);

        expect(await cache.get('k')).toEqual({ a: 1 });
        expect(await cache.get('missing')).toBeNull();
        expect(await cache.get('missing', [])).toEqual([]);
        expect(await cache.has('k')).toBe(true);
    });

    it('expires entries after the ttl', async () => {
        const { cache, clock } = await createTestContext();

        await cache.put('k', 'v', 10);
        clock.advanceSeconds(9);
        expect(await cache.get('k')).toBe('v');
        clock.advanceSeconds(1);
        expect(await cache.get('k')).toBeNull();
    });

    it('accepts an absolute Date expiry and never-expiring entries', async () => {
        const { cache, clock } = await createTestContext();

        await cache.put('date', 1, new Date(clock.now().getTime() + 5000));
        await cache.forever('forever', 2);
        clock.advanceSeconds(6);

        expect(await cache.get('date')).toBeNull();
        expect(await cache.get('forever')).toBe(2);
    });

    it('treats a non-positive ttl as a forget', async () => {
        const { cache } = await createTestContext();

        await cache.put('k', 'v', 60);
        await cache.put('k', 'v2', 0);

        expect(await cache.get('k')).toBeNull();
    });

    it('overwrites and forgets', async () => {
        const { cache } = await createTestContext();

        await cache.put('k', 1, 60);
        await cache.put('k', 2, 60);
        expect(await cache.get('k')).toBe(2);

        await cache.forget('k');
        expect(await cache.get('k')).toBeNull();
    });

    it('remember computes once until expiry (Cache::remember)', async () => {
        const { cache, clock } = await createTestContext();
        const compute = vi.fn(async () => ({ n: compute.mock.calls.length }));

        const first = await cache.remember('r', 30, compute);
        const second = await cache.remember('r', 30, compute);

        expect(first).toEqual({ n: 1 });
        expect(second).toEqual({ n: 1 });
        expect(compute).toHaveBeenCalledTimes(1);

        clock.advanceSeconds(31);
        expect(await cache.remember('r', 30, compute)).toEqual({ n: 2 });
    });

    it('does not cache a null result', async () => {
        const { cache } = await createTestContext();
        const compute = vi.fn(async () => null);

        await cache.remember('n', 30, compute);
        await cache.remember('n', 30, compute);

        expect(compute).toHaveBeenCalledTimes(2);
    });

    it('prunes expired rows and flushes', async () => {
        const { cache, clock, sqlite } = await createTestContext();

        await cache.put('a', 1, 5);
        await cache.put('b', 1, 500);
        clock.advanceSeconds(10);
        await cache.pruneExpired();

        expect(sqlite.prepare('select key from cache').all()).toEqual([
            { key: 'b' },
        ]);
        await cache.flush();
        expect(sqlite.prepare('select count(*) c from cache').get()).toEqual({
            c: 0,
        });
    });
});

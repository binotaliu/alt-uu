import { describe, expect, it } from 'vitest';
import {
    ACTIVE_PROFILE_KEY,
    fromLegacySession,
    toLegacySession,
} from '../../src/accounts';
import type { HunguSession } from '../../src/session/types';
import { createTestContext, type TestContext } from './helpers';

function hunguSession(suffix: string, username: string): HunguSession {
    return {
        baseUrl: `https://uu-${suffix}.nou.edu.tw`,
        userAgent: 'test-agent',
        cookies: { WM: `cookie-${suffix}` },
        ticket: `ticket-${suffix}`,
        profile: { username },
    };
}

async function seedAccount(
    ctx: TestContext,
    username: string,
    suffix: string,
): Promise<number> {
    const id = await ctx.credentials.upsert({
        username,
        password: 'test-password',
    });
    await ctx.hunguSessions.put(hunguSession(suffix, username), id);

    return id;
}

describe('KeyValueStore + active profile', () => {
    it('stores values and updates in place', async () => {
        const { keyValues } = await createTestContext();

        expect(await keyValues.get('k')).toBeNull();
        await keyValues.set('k', 'a');
        await keyValues.set('k', 'b');
        expect(await keyValues.get('k')).toBe('b');
        await keyValues.delete('k');
        expect(await keyValues.has('k')).toBe(false);
    });

    it('persists the active account under the legacy key', async () => {
        const ctx = await createTestContext();
        const id = await seedAccount(ctx, 's1111111', 'a');

        expect(await ctx.keyValues.get(ACTIVE_PROFILE_KEY)).toBe(String(id));
        expect(await ctx.activeProfile.currentAccountId()).toBe(id);

        await ctx.keyValues.set(ACTIVE_PROFILE_KEY, '');
        expect(await ctx.activeProfile.get()).toBeNull();
    });
});

describe('credentials and encryption at rest', () => {
    it('never stores plaintext secrets', async () => {
        const ctx = await createTestContext();
        const id = await seedAccount(ctx, 's2222222', 'a');
        await ctx.portalSessions.put(
            { baseUrl: 'https://p', userAgent: 'ua', cookies: { a: 'b' } },
            id,
        );

        const row = ctx.sqlite
            .prepare('select * from accounts where id = ?')
            .get(id) as Record<string, string>;
        const raw = JSON.stringify(row);

        expect(raw).not.toContain('test-password');
        expect(raw).not.toContain('cookie-a');
        expect(raw).not.toContain('https://p');
        expect(row.password).toMatch(/^v1:/);
        expect(await ctx.credentials.get(id)).toEqual({
            username: 's2222222',
            password: 'test-password',
        });
        expect(await ctx.portalSessions.get(id)).toMatchObject({
            cookies: { a: 'b' },
        });
    });

    it('trims usernames and reuses the row on re-put', async () => {
        const ctx = await createTestContext();
        const first = await ctx.credentials.upsert({
            username: '  s3333333 ',
            password: 'one',
        });
        const second = await ctx.credentials.upsert({
            username: 's3333333',
            password: 'two',
        });

        expect(second).toBe(first);
        expect((await ctx.credentials.get(first))?.password).toBe('two');
        expect((await ctx.credentials.all()).map((a) => a.username)).toEqual([
            's3333333',
        ]);
    });

    it('enforces unique usernames at the database level', async () => {
        const ctx = await createTestContext();
        await seedAccount(ctx, 's4444444', 'a');

        expect(() =>
            ctx.sqlite
                .prepare("insert into accounts (username) values ('s4444444')")
                .run(),
        ).toThrow(/UNIQUE/);
    });

    it('put with an account id changes only that password', async () => {
        const ctx = await createTestContext();
        const a = await seedAccount(ctx, 's4000001', 'a');
        const b = await seedAccount(ctx, 's4000002', 'b');

        await ctx.credentials.put({ username: 's4000001', password: 'new' }, a);

        expect((await ctx.credentials.get(a))?.password).toBe('new');
        expect((await ctx.credentials.get(b))?.password).toBe('test-password');
        expect(await ctx.activeProfile.get()).toBe(b);
    });

    it('stores and clears nicknames', async () => {
        const ctx = await createTestContext();
        const id = await seedAccount(ctx, 's6001001', 'a');

        await ctx.credentials.setNickname(id, '  我的主帳號 ');
        expect((await ctx.credentials.all())[0].nickname).toBe('我的主帳號');

        await ctx.credentials.setNickname(id, '   ');
        expect((await ctx.credentials.all())[0].nickname).toBeNull();

        await expect(
            ctx.credentials.setNickname(id, 'x'.repeat(31)),
        ).rejects.toThrow(RangeError);
    });
});

describe('sessions', () => {
    it('reads and writes the active account session by default', async () => {
        const ctx = await createTestContext();
        const first = await seedAccount(ctx, 's5555555', 'a');
        const second = await seedAccount(ctx, 's6666666', 'b');

        expect((await ctx.hunguSessions.get())?.ticket).toBe('ticket-b');
        expect((await ctx.hunguSessions.get(first))?.ticket).toBe('ticket-a');

        await ctx.hunguSessions.clear();
        expect(await ctx.hunguSessions.get(second)).toBeNull();
        expect(await ctx.hunguSessions.get(first)).not.toBeNull();
    });

    it('ignores writes when there is no account', async () => {
        const ctx = await createTestContext();

        await ctx.hunguSessions.put(hunguSession('a', 'x'));
        expect(await ctx.hunguSessions.get()).toBeNull();
        expect(await ctx.hunguSessions.get(99)).toBeNull();
    });

    it('maps legacy snake_case session arrays', () => {
        const legacy = {
            base_url: 'https://uu.nou.edu.tw',
            ua: 'UA',
            cookies: { WM: '1' },
            ticket: 't',
            session_idx: 'i',
            profile: { username: 'u' },
        };
        const mapped = fromLegacySession(legacy);

        expect(mapped).toEqual({
            baseUrl: 'https://uu.nou.edu.tw',
            userAgent: 'UA',
            cookies: { WM: '1' },
            ticket: 't',
            session_idx: 'i',
            profile: { username: 'u' },
        });
        expect(toLegacySession(mapped)).toEqual(legacy);
        expect(fromLegacySession({})).toEqual({
            baseUrl: '',
            userAgent: '',
            cookies: {},
        });
    });
});

describe('AccountManager (AccountSwitchingTest port)', () => {
    it('lists and counts accounts', async () => {
        const ctx = await createTestContext();
        await seedAccount(ctx, 's1000001', 'a');
        await seedAccount(ctx, 's1000002', 'b');

        expect(await ctx.manager.count()).toBe(2);
        expect((await ctx.manager.all()).map((a) => a.username)).toEqual([
            's1000001',
            's1000002',
        ]);
    });

    it('switches the active account', async () => {
        const ctx = await createTestContext();
        const first = await seedAccount(ctx, 's5555555', 'a');
        const second = await seedAccount(ctx, 's6666666', 'b');
        await ctx.activeProfile.set(first);

        expect(await ctx.manager.activate(second)).toBe(true);
        expect(await ctx.manager.activeId()).toBe(second);
        expect((await ctx.hunguSessions.get())?.profile).toEqual({
            username: 's6666666',
        });
    });

    it('leaves the active profile untouched when removing another account', async () => {
        const ctx = await createTestContext();
        const first = await seedAccount(ctx, 's7777777', 'a');
        const second = await seedAccount(ctx, 's8888888', 'b');
        await ctx.activeProfile.set(first);

        await ctx.manager.forget(second);

        expect(await ctx.manager.activeId()).toBe(first);
        expect((await ctx.manager.all()).map((a) => a.id)).toEqual([first]);
    });

    it('clears the active profile when the active account is removed', async () => {
        const ctx = await createTestContext();
        const first = await seedAccount(ctx, 's9999993', 'a');

        await ctx.manager.forget(first);

        expect(await ctx.manager.activeId()).toBeNull();
        expect(await ctx.hunguSessions.get()).toBeNull();
    });

    it('soft-deletes and wipes sensitive columns', async () => {
        const ctx = await createTestContext();
        const id = await seedAccount(ctx, 's1122334', 'a');
        await ctx.portalSessions.put(
            { baseUrl: 'b', userAgent: 'u', cookies: {} },
            id,
        );

        await ctx.manager.forget(id);

        const row = ctx.sqlite
            .prepare('select * from accounts where id = ?')
            .get(id) as Record<string, unknown>;
        expect(row.deleted_at).not.toBeNull();
        expect(row.password).toBeNull();
        expect(row.hungu_session).toBeNull();
        expect(row.school_portal_session).toBeNull();
        expect(await ctx.credentials.get(id)).toBeNull();
        expect(await ctx.manager.count()).toBe(0);
    });

    it('restores a soft-deleted account and keeps playback progress linked', async () => {
        const ctx = await createTestContext();
        const id = await seedAccount(ctx, 's5544332', 'a');
        ctx.sqlite
            .prepare(
                "insert into playback_progress (account_id, cid, activity_id) values (?, '1001', 'N-1')",
            )
            .run(id);

        await ctx.manager.forget(id);
        const restored = await ctx.credentials.upsert({
            username: 's5544332',
            password: 'new-secret',
        });

        expect(restored).toBe(id);
        expect(await ctx.manager.count()).toBe(1);
        expect(await ctx.activeProfile.get()).toBe(id);
        expect(
            ctx.sqlite
                .prepare(
                    'select count(*) c from playback_progress where account_id = ?',
                )
                .get(id),
        ).toEqual({ c: 1 });
    });

    it('falls back to a remembered login hook when no session exists', async () => {
        const ctx = await createTestContext();
        const id = await ctx.credentials.upsert({
            username: 's2000001',
            password: 'pw',
        });
        let calls = 0;
        ctx.manager.setHooks({
            attemptRememberedLogin: async () => {
                calls += 1;
                await ctx.hunguSessions.put(hunguSession('r', 's2000001'), id);

                return true;
            },
        });

        expect(await ctx.manager.activate(id)).toBe(true);
        expect(calls).toBe(1);
        expect(await ctx.manager.activate(id)).toBe(true);
        expect(calls).toBe(1);
    });

    it('reports failure when no session and no hook can log in', async () => {
        const ctx = await createTestContext();
        const id = await ctx.credentials.upsert({
            username: 's2000002',
            password: 'pw',
        });

        expect(await ctx.manager.activate(id)).toBe(false);
        await expect(ctx.manager.attemptLogin('a', 'b')).rejects.toThrow();
    });
});

describe('schema constraints', () => {
    it('keeps playback progress unique per account/cid/activity', async () => {
        const ctx = await createTestContext();
        const id = await seedAccount(ctx, 's3000001', 'a');
        const insert = ctx.sqlite.prepare(
            "insert into playback_progress (account_id, cid, activity_id) values (?, '1', 'N')",
        );

        insert.run(id);
        expect(() => insert.run(id)).toThrow(/UNIQUE/);
    });

    it('keeps daily activity unique per account/date and cascades', async () => {
        const ctx = await createTestContext();
        const id = await seedAccount(ctx, 's3000002', 'a');
        const insert = ctx.sqlite.prepare(
            "insert into account_daily_activities (account_id, activity_date) values (?, '2026-10-01')",
        );

        insert.run(id);
        expect(() => insert.run(id)).toThrow(/UNIQUE/);

        ctx.sqlite.prepare('delete from accounts where id = ?').run(id);
        expect(
            ctx.sqlite
                .prepare('select count(*) c from account_daily_activities')
                .get(),
        ).toEqual({ c: 0 });
    });

    it('keeps blocked contents and users unique', async () => {
        const ctx = await createTestContext();

        const content = ctx.sqlite.prepare(
            "insert into blocked_contents (board_hash, node_hash, reason, blocked_at) values ('b', 'n', 'x', 1)",
        );
        content.run();
        expect(() => content.run()).toThrow(/UNIQUE/);

        const user = ctx.sqlite.prepare(
            "insert into blocked_users (poster, realname) values ('p', 'r')",
        );
        user.run();
        expect(() => user.run()).toThrow(/UNIQUE/);
    });

    it('applies attachment download and diagnostic defaults', async () => {
        const ctx = await createTestContext();

        ctx.sqlite
            .prepare(
                "insert into attachment_downloads (cid, source_url, status) values ('1', 'u', 'queued')",
            )
            .run();
        ctx.sqlite
            .prepare(
                "insert into diagnostic_events (occurred_at, type, summary) values (1, 't', 's')",
            )
            .run();

        expect(
            ctx.sqlite.prepare('select source from attachment_downloads').get(),
        ).toEqual({ source: 'hungu' });
        expect(
            ctx.sqlite
                .prepare('select level, source from diagnostic_events')
                .get(),
        ).toEqual({ level: 'info', source: 'server' });
    });
});

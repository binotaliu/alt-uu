import { describe, expect, it, vi } from 'vitest';
import { createAccountServices, ValidationError } from './index';
import {
    createHarness,
    invalidAccount,
    loginSuccess,
    profileOk,
    warmUpRoutes,
    type Harness,
} from './testing';
import { playbackProgress, accounts } from '../../db/schema';
import { eq } from 'drizzle-orm';

function services(harness: Harness, forgetDiagnosticLog = async () => {}) {
    return createAccountServices({
        db: harness.db,
        credentials: harness.credentials,
        activeProfile: harness.activeProfile,
        hunguSessions: harness.hunguSessions,
        authenticator: harness.authenticator,
        forgetDiagnosticLog,
    });
}

describe('account services', () => {
    // Ported from tests/Feature/Account/AccountSwitchingTest.php
    it('rejects adding a 6th account', async () => {
        const harness = await createHarness();
        await harness.seedAccount('s1000001', 'a');

        for (let index = 2; index <= 4; index += 1) {
            await harness.credentials.upsert({
                username: `s100000${index}`,
                password: 'secret',
            });
        }

        await harness.seedAccount('s1000005', 'e');

        const result = await services(harness).add({
            username: 's1000006',
            password: 'secret',
        });

        expect(result.ok).toBe(false);
        expect(await harness.credentials.all()).toHaveLength(5);
        expect(harness.requests).toHaveLength(0);
    });

    it('adds a second account without a subscription and returns the list', async () => {
        const harness = await createHarness([
            ...warmUpRoutes,
            [
                'https://uu.nou.edu.tw/xmlapi/index.php?action=login*',
                { body: loginSuccess('ticket-2') },
            ],
            [
                'https://uu.nou.edu.tw/xmlapi/index.php?action=my-profile*',
                { body: profileOk('s2222222', '副') },
            ],
        ]);
        await harness.seedAccount('s1111111', 'a');

        const result = await services(harness).add({
            username: ' s2222222 ',
            password: 'secret',
        });

        expect(result.ok).toBe(true);
        expect(result.accounts?.map((account) => account.username)).toEqual([
            's1111111',
            's2222222',
        ]);
        expect(
            result.accounts?.find((account) => account.username === 's2222222'),
        ).toMatchObject({
            displayName: '副',
            isActive: true,
        });
    });

    it('validates the add input', async () => {
        const harness = await createHarness();

        await expect(
            services(harness).add({ username: ' ', password: '' }),
        ).rejects.toBeInstanceOf(ValidationError);
    });

    it('switches the active account and keeps the session profile', async () => {
        const harness = await createHarness();
        const first = await harness.seedAccount('s5555555', 'a', true);
        const second = await harness.seedAccount('s6666666', 'b');
        await harness.activeProfile.set(first);

        const result = await services(harness).switchTo(second);

        expect(result.ok).toBe(true);
        expect(await harness.activeProfile.get()).toBe(second);
        expect(
            result.accounts?.find((account) => account.isActive)?.username,
        ).toBe('s6666666');
        expect(
            (
                (await harness.hunguSessions.get())?.profile as {
                    username: string;
                }
            ).username,
        ).toBe('s6666666');
    });

    it('leaves the active profile untouched when removing a non-active account', async () => {
        const forgetDiagnosticLog = vi.fn(async () => {});
        const harness = await createHarness();
        const first = await harness.seedAccount('s7777777', 'a');
        const second = await harness.seedAccount('s8888888', 'b');
        await harness.activeProfile.set(first);

        await services(harness, forgetDiagnosticLog).remove(second);

        expect(await harness.activeProfile.get()).toBe(first);
        expect(
            (await harness.credentials.all()).map((account) => account.id),
        ).toEqual([first]);
        expect(forgetDiagnosticLog).toHaveBeenCalledOnce();
    });

    it('auto-activates another saved account when the active account is removed', async () => {
        const harness = await createHarness();
        const first = await harness.seedAccount('s9999991', 'a');
        const second = await harness.seedAccount('s9999992', 'b');
        await harness.activeProfile.set(first);

        const list = await services(harness).remove(first);

        expect(await harness.activeProfile.get()).toBe(second);
        expect(list).toHaveLength(1);
        expect(
            (
                (await harness.hunguSessions.get())?.profile as {
                    username: string;
                }
            ).username,
        ).toBe('s9999992');
    });

    it('clears the active profile and session when the last account is removed', async () => {
        const harness = await createHarness();
        const first = await harness.seedAccount('s9999993', 'a', true);

        await services(harness).remove(first);

        expect(await harness.activeProfile.get()).toBeNull();
        expect(await harness.hunguSessions.get()).toBeNull();
    });

    it('soft-deletes a removed account and clears its sensitive columns', async () => {
        const harness = await createHarness();
        const id = await harness.seedAccount('s1122334', 'a');

        await services(harness).remove(id);

        const [row] = await harness.db
            .select()
            .from(accounts)
            .where(eq(accounts.id, id));
        expect(row.deletedAt).not.toBeNull();
        expect(row.password).toBeNull();
        expect(row.hunguSession).toBeNull();
        expect(row.schoolPortalSession).toBeNull();
    });

    it('restores a soft-deleted account and keeps playback progress linked when the username is re-added', async () => {
        const harness = await createHarness();
        const id = await harness.seedAccount('s5544332', 'a');
        await harness.db.insert(playbackProgress).values({
            accountId: id,
            cid: '1001',
            activityId: 'N-1',
            durationSeconds: 120,
            positionSeconds: 42.5,
            hunguUploadSuccess: true,
        });

        await services(harness).remove(id);
        await harness.credentials.upsert({
            username: 's5544332',
            password: 'new-secret',
        });

        expect((await harness.credentials.all())[0].id).toBe(id);
        expect(
            await harness.db
                .select()
                .from(playbackProgress)
                .where(eq(playbackProgress.accountId, id)),
        ).toHaveLength(1);
    });

    it('sets, trims, clears and limits nicknames', async () => {
        const harness = await createHarness();
        const id = await harness.seedAccount('s6001001', 'a');
        const accountServices = services(harness);

        const renamed = await accountServices.rename(id, ' 我的主帳號 ');
        expect(renamed[0].nickname).toBe('我的主帳號');

        expect(
            (await accountServices.rename(id, '   '))[0].nickname,
        ).toBeNull();

        await accountServices.rename(id, '舊名稱');
        await expect(
            accountServices.rename(id, '字'.repeat(31)),
        ).rejects.toBeInstanceOf(ValidationError);
        expect((await accountServices.list())[0].nickname).toBe('舊名稱');
    });
});

// Ported from tests/Feature/Account/AccountReauthenticationTest.php
describe('account reauthentication', () => {
    it('can still switch to a different account after the active one dies', async () => {
        const harness = await createHarness([
            [
                'https://uu.nou.edu.tw/xmlapi/index.php?action=login*',
                { body: invalidAccount },
            ],
            ['https://uu.nou.edu.tw/', { body: '<html/>' }],
            ['https://uu.nou.edu.tw/learn/index.php', { body: '<html/>' }],
        ]);
        const first = await harness.credentials.upsert({
            username: 's1111111',
            password: 'wrong-secret',
        });
        const second = await harness.seedAccount('s2222222', 'b');
        await harness.activeProfile.set(first);

        expect(await harness.authenticator.attemptRememberedLogin()).toBe(
            false,
        );
        expect(await harness.activeProfile.get()).toBe(first);

        const result = await services(harness).switchTo(second);

        expect(result.ok).toBe(true);
        expect(await harness.activeProfile.get()).toBe(second);
    });

    it('reports a dead account on switch when its remembered login fails', async () => {
        const harness = await createHarness([
            [
                'https://uu.nou.edu.tw/xmlapi/index.php?action=login*',
                { body: invalidAccount },
            ],
            ['https://uu.nou.edu.tw/', { body: '<html/>' }],
            ['https://uu.nou.edu.tw/learn/index.php', { body: '<html/>' }],
        ]);
        await harness.seedAccount('s1', 'a', true);
        const stale = await harness.credentials.upsert({
            username: 's2',
            password: 'x',
        });
        await harness.activeProfile.set(1);

        const result = await services(harness).switchTo(stale);

        expect(result).toMatchObject({
            ok: false,
            message: '此帳號的登入已失效，請重新輸入密碼。',
        });
    });

    it('reauthenticates a soft-deleted account by password and restores it as active', async () => {
        const harness = await createHarness([
            ...warmUpRoutes,
            [
                'https://uu.nou.edu.tw/xmlapi/index.php?action=login*',
                [
                    { body: invalidAccount },
                    { body: loginSuccess('ticket-relogin') },
                ],
            ],
            [
                'https://uu.nou.edu.tw/xmlapi/index.php?action=my-profile*',
                { body: profileOk('s1234567') },
            ],
        ]);
        const id = await harness.credentials.upsert({
            username: 's1234567',
            password: 'old-secret',
        });

        expect(await harness.authenticator.attemptRememberedLogin()).toBe(
            false,
        );
        expect(await harness.credentials.all()).toHaveLength(0);
        expect(await harness.activeProfile.get()).toBe(id);

        const result = await services(harness).reauthenticate(id, 'new-secret');

        expect(result.ok).toBe(true);
        expect((await harness.credentials.all())[0].id).toBe(id);
        expect(await harness.activeProfile.get()).toBe(id);
        expect(
            (
                (await harness.hunguSessions.get())?.profile as {
                    username: string;
                }
            ).username,
        ).toBe('s1234567');
    });

    it('rejects reauthentication with the wrong password and leaves the account untouched', async () => {
        const harness = await createHarness([
            [
                'https://uu.nou.edu.tw/xmlapi/index.php?action=login*',
                { body: invalidAccount },
            ],
            ...warmUpRoutes,
        ]);
        const id = await harness.credentials.upsert({
            username: 's7654321',
            password: 'p',
        });
        await harness.activeProfile.clear();

        const result = await services(harness).reauthenticate(
            id,
            'wrong-secret',
        );

        expect(result.ok).toBe(false);
        expect(await harness.activeProfile.get()).not.toBe(id);
    });

    it('scopes reauthentication to the requested account', async () => {
        const harness = await createHarness([
            ...warmUpRoutes,
            [
                'https://uu.nou.edu.tw/xmlapi/index.php?action=login*',
                { body: loginSuccess('ticket-a', '測試學生 A') },
            ],
            [
                'https://uu.nou.edu.tw/xmlapi/index.php?action=my-profile*',
                { body: profileOk('s1111111', '測試學生 A') },
            ],
        ]);
        const first = await harness.credentials.upsert({
            username: 's1111111',
            password: 'secret-a',
        });
        await harness.credentials.upsert({
            username: 's2222222',
            password: 'secret-b',
        });

        const result = await services(harness).reauthenticate(
            first,
            'fresh-secret',
        );

        expect(result.ok).toBe(true);
        expect(await harness.activeProfile.get()).toBe(first);
        expect(
            (await harness.credentials.all()).map(
                (account) => account.username,
            ),
        ).toEqual(['s1111111', 's2222222']);
    });

    it('throws a validation error without a password', async () => {
        const harness = await createHarness();
        const id = await harness.seedAccount('s1', 'a');

        await expect(
            services(harness).reauthenticate(id, ''),
        ).rejects.toBeInstanceOf(ValidationError);
    });
});

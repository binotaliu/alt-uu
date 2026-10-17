import { and, asc, eq, isNull } from 'drizzle-orm';
import type { CredentialCipher } from '../db/cipher';
import { accounts } from '../db/schema';
import type { AltUUDatabase } from '../db/types';
import type { Clock } from '../platform';
import type {
    AccountCredentials,
    AccountId,
    CredentialsStore,
} from '../session/types';
import { resolveAccountRow } from './accountRecords';
import type { AccountActiveProfile } from './activeProfile';

export interface AccountSummary {
    id: AccountId;
    username: string;
    nickname: string | null;
    createdAt: Date | null;
    updatedAt: Date | null;
}

const PASSWORD_PURPOSE = 'accounts.password';

/** Port of legacy AccountCredentialsStore (encrypted password column). */
export class AccountCredentialsStore implements CredentialsStore {
    constructor(
        private readonly deps: {
            db: AltUUDatabase;
            cipher: CredentialCipher;
            activeProfile: AccountActiveProfile;
            clock: Clock;
        },
    ) {}

    async get(accountId?: AccountId): Promise<AccountCredentials | null> {
        const row = await resolveAccountRow(
            this.deps.db,
            this.deps.activeProfile,
            accountId,
        );

        if (row === null || row.password === null) {
            return null;
        }

        return {
            username: row.username,
            password: await this.deps.cipher.decrypt(
                row.password,
                PASSWORD_PURPOSE,
            ),
        };
    }

    /**
     * With an `accountId`, updates that account's password. Without one,
     * upserts by trimmed username (restoring a soft-deleted account) and
     * makes it the active profile, exactly like the legacy `put`.
     */
    async put(
        credentials: AccountCredentials,
        accountId?: AccountId,
    ): Promise<void> {
        if (accountId === undefined) {
            await this.upsert(credentials);

            return;
        }

        await this.deps.db
            .update(accounts)
            .set({
                password: await this.encryptPassword(credentials.password),
                updatedAt: this.deps.clock.now(),
            })
            .where(and(eq(accounts.id, accountId), isNull(accounts.deletedAt)));
    }

    /** Legacy `put(username, password)`; returns the account id. */
    async upsert(credentials: AccountCredentials): Promise<AccountId> {
        const username = credentials.username.trim();
        const password = await this.encryptPassword(credentials.password);
        const now = this.deps.clock.now();

        const existing = await this.deps.db
            .select({ id: accounts.id })
            .from(accounts)
            .where(eq(accounts.username, username))
            .limit(1);

        let accountId: AccountId;

        if (existing[0] === undefined) {
            const inserted = await this.deps.db
                .insert(accounts)
                .values({
                    username,
                    password,
                    createdAt: now,
                    updatedAt: now,
                })
                .returning({ id: accounts.id });
            accountId = inserted[0].id;
        } else {
            accountId = existing[0].id;
            await this.deps.db
                .update(accounts)
                .set({ password, deletedAt: null, updatedAt: now })
                .where(eq(accounts.id, accountId));
        }

        await this.deps.activeProfile.set(accountId);

        return accountId;
    }

    /**
     * Soft-deletes the account and wipes its secrets. Clears the active
     * profile when the removed account was the active one.
     */
    async forget(
        accountId?: AccountId,
        clearActiveProfile = true,
    ): Promise<void> {
        const row = await resolveAccountRow(
            this.deps.db,
            this.deps.activeProfile,
            accountId,
        );

        if (row === null) {
            return;
        }

        const wasActive = (await this.deps.activeProfile.get()) === row.id;
        const now = this.deps.clock.now();

        await this.deps.db
            .update(accounts)
            .set({
                password: null,
                hunguSession: null,
                schoolPortalSession: null,
                deletedAt: now,
                updatedAt: now,
            })
            .where(eq(accounts.id, row.id));

        if (wasActive && clearActiveProfile) {
            await this.deps.activeProfile.clear();
        }
    }

    async has(accountId?: AccountId): Promise<boolean> {
        return (await this.get(accountId)) !== null;
    }

    /** Non-deleted accounts, oldest first (legacy `Account::all()`). */
    async all(): Promise<AccountSummary[]> {
        const rows = await this.deps.db
            .select({
                id: accounts.id,
                username: accounts.username,
                nickname: accounts.nickname,
                createdAt: accounts.createdAt,
                updatedAt: accounts.updatedAt,
            })
            .from(accounts)
            .where(isNull(accounts.deletedAt))
            .orderBy(asc(accounts.id));

        return rows;
    }

    /** Trims; an empty value clears the nickname. Max 30 characters. */
    async setNickname(accountId: AccountId, nickname: string): Promise<void> {
        const trimmed = nickname.trim();

        if ([...trimmed].length > 30) {
            throw new RangeError('Nickname must be at most 30 characters.');
        }

        await this.deps.db
            .update(accounts)
            .set({
                nickname: trimmed === '' ? null : trimmed,
                updatedAt: this.deps.clock.now(),
            })
            .where(and(eq(accounts.id, accountId), isNull(accounts.deletedAt)));
    }

    private encryptPassword(password: string): Promise<string> {
        return this.deps.cipher.encrypt(password, PASSWORD_PURPOSE);
    }
}

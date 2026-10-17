import { eq } from 'drizzle-orm';
import type { CredentialCipher } from '../db/cipher';
import { accounts } from '../db/schema';
import type { AltUUDatabase } from '../db/types';
import type { Clock } from '../platform';
import type { AccountId, SessionStore } from '../session/types';
import { resolveAccountRow } from './accountRecords';
import type { AccountActiveProfile } from './activeProfile';

type SessionColumn = 'hunguSession' | 'schoolPortalSession';

export interface EncryptedSessionStoreDeps {
    db: AltUUDatabase;
    cipher: CredentialCipher;
    activeProfile: AccountActiveProfile;
    clock: Clock;
}

const COLUMN_PURPOSE: Record<SessionColumn, string> = {
    hunguSession: 'accounts.hungu_session',
    schoolPortalSession: 'accounts.school_portal_session',
};

/** AES-GCM encrypted JSON session stored on an `accounts` column. */
class EncryptedSessionStore<
    TSession extends object,
> implements SessionStore<TSession> {
    constructor(
        private readonly deps: EncryptedSessionStoreDeps,
        private readonly column: SessionColumn,
    ) {}

    async get(accountId?: AccountId): Promise<TSession | null> {
        const row = await this.resolve(accountId);
        const payload = row?.[this.column] ?? null;

        if (payload === null) {
            return null;
        }

        return this.deps.cipher.decryptJson<TSession>(
            payload,
            COLUMN_PURPOSE[this.column],
        );
    }

    async put(session: TSession, accountId?: AccountId): Promise<void> {
        const row = await this.resolve(accountId);

        if (row === null) {
            return;
        }

        await this.write(
            row.id,
            await this.deps.cipher.encryptJson(
                session,
                COLUMN_PURPOSE[this.column],
            ),
        );
    }

    async clear(accountId?: AccountId): Promise<void> {
        const row = await this.resolve(accountId);

        if (row !== null) {
            await this.write(row.id, null);
        }
    }

    async has(accountId?: AccountId): Promise<boolean> {
        return (await this.resolve(accountId))?.[this.column] != null;
    }

    private resolve(accountId?: AccountId) {
        return resolveAccountRow(
            this.deps.db,
            this.deps.activeProfile,
            accountId,
        );
    }

    private async write(
        accountId: AccountId,
        payload: string | null,
    ): Promise<void> {
        await this.deps.db
            .update(accounts)
            .set({
                [this.column]: payload,
                updatedAt: this.deps.clock.now(),
            })
            .where(eq(accounts.id, accountId));
    }
}

export { EncryptedSessionStore };

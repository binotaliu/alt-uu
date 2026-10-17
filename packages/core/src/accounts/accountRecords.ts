import { and, eq, isNull } from 'drizzle-orm';
import { accounts } from '../db/schema';
import type { AltUUDatabase } from '../db/types';
import type { AccountId } from '../session/types';
import type { AccountActiveProfile } from './activeProfile';

export type AccountRow = typeof accounts.$inferSelect;

/**
 * Looks up a non-soft-deleted account by id, defaulting to the active one
 * (legacy `resolveAccount`, where `Account::find` skips trashed rows).
 */
export async function resolveAccountRow(
    db: AltUUDatabase,
    activeProfile: AccountActiveProfile,
    accountId?: AccountId,
): Promise<AccountRow | null> {
    const resolvedId = accountId ?? (await activeProfile.get());

    if (resolvedId === null) {
        return null;
    }

    const rows = await db
        .select()
        .from(accounts)
        .where(and(eq(accounts.id, resolvedId), isNull(accounts.deletedAt)))
        .limit(1);

    return rows[0] ?? null;
}

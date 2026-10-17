import type { KeyValueStoreRepository } from '../db/keyValueStore';
import type { AccountId, ActiveAccountProvider } from '../session/types';

/** Mirrors `config/account.php` `active_profile_key`. */
export const ACTIVE_PROFILE_KEY = 'account.active_profile';

/** Port of legacy AccountActiveProfile + AccountContext. */
export class AccountActiveProfile implements ActiveAccountProvider {
    constructor(private readonly keyValues: KeyValueStoreRepository) {}

    async get(): Promise<AccountId | null> {
        const value = await this.keyValues.get(ACTIVE_PROFILE_KEY);

        if (value === null || value === '') {
            return null;
        }

        const accountId = Number.parseInt(value, 10);

        return Number.isNaN(accountId) ? null : accountId;
    }

    async set(accountId: AccountId): Promise<void> {
        await this.keyValues.set(ACTIVE_PROFILE_KEY, String(accountId));
    }

    async clear(): Promise<void> {
        await this.keyValues.delete(ACTIVE_PROFILE_KEY);
    }

    currentAccountId(): Promise<AccountId | null> {
        return this.get();
    }
}

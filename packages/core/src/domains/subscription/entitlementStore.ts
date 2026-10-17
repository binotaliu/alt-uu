import type { KeyValueStoreRepository } from '../../db/keyValueStore';
import type { Clock } from '../../platform';
import type { CachedEntitlement } from './types';

export const ENTITLEMENT_KEY = 'subscription:entitlement';

/** Port of legacy SubscriptionEntitlementStore. */
export class SubscriptionEntitlementStore {
    constructor(
        private readonly keyValues: KeyValueStoreRepository,
        private readonly clock: Clock,
    ) {}

    async get(): Promise<CachedEntitlement | null> {
        const raw = await this.keyValues.get(ENTITLEMENT_KEY);

        if (raw === null) {
            return null;
        }

        let decoded: Record<string, unknown>;

        try {
            const parsed: unknown = JSON.parse(raw);

            if (typeof parsed !== 'object' || parsed === null) {
                return null;
            }

            decoded = parsed as Record<string, unknown>;
        } catch {
            return null;
        }

        const reference = decoded.reference;

        return {
            active: Boolean(decoded.active),
            productId: asString(decoded.productId),
            expiresAt: asString(decoded.expiresAt),
            platform: asString(decoded.platform),
            reference:
                typeof reference === 'object' &&
                reference !== null &&
                !Array.isArray(reference)
                    ? (reference as Record<string, unknown>)
                    : null,
        };
    }

    async put(entitlement: CachedEntitlement): Promise<void> {
        await this.keyValues.set(
            ENTITLEMENT_KEY,
            JSON.stringify({
                ...entitlement,
                checkedAt: this.clock.now().toISOString(),
            }),
        );
    }
}

export function asString(value: unknown): string | null {
    return typeof value === 'string' ? value : null;
}

import type { AltUUPlusClient } from './altUUPlusClient';
import {
    asString,
    type SubscriptionEntitlementStore,
} from './entitlementStore';
import type { EntitlementViewModel, IapServerResponse } from './types';

export interface EntitlementVerifierDeps {
    client: AltUUPlusClient;
    store: SubscriptionEntitlementStore;
    /**
     * Accent colors are an Alt UU+ perk: once the backend explicitly reports
     * the subscription inactive, the accent falls back to the default (the
     * callback only changes it when it is not already the default).
     */
    resetPaidPreferences: () => Promise<void>;
}

/** Port of legacy EntitlementVerifier. */
export class EntitlementVerifier {
    constructor(private readonly deps: EntitlementVerifierDeps) {}

    async verify(
        platform: string,
        reference: Record<string, unknown>,
    ): Promise<EntitlementViewModel> {
        const response = await this.deps.client.verify(platform, reference);

        return response === null
            ? this.inactive()
            : this.cacheAndPresent(response, platform, reference);
    }

    /**
     * Best-effort refresh keyed off the purchase reference cached by the last
     * successful verify/restore. Null (not "inactive") when there is no
     * cached reference or the backend cannot be reached, so callers fall back
     * to the last cached entitlement.
     */
    async refreshFromBackend(): Promise<EntitlementViewModel | null> {
        const cached = await this.deps.store.get();

        if (
            cached === null ||
            cached.reference === null ||
            cached.platform === null
        ) {
            return null;
        }

        const response = await this.deps.client.entitlement(
            cached.platform,
            cached.reference,
        );

        return response === null
            ? null
            : this.cacheAndPresent(response, cached.platform, cached.reference);
    }

    inactive(): EntitlementViewModel {
        return {
            active: false,
            productId: null,
            expiresAt: null,
            platform: null,
        };
    }

    private async cacheAndPresent(
        response: IapServerResponse,
        platform: string,
        reference: Record<string, unknown>,
    ): Promise<EntitlementViewModel> {
        const active = Boolean(response.active);
        const productId = asString(response.product_id);
        const expiresAt = asString(response.expires_at);
        const responsePlatform = asString(response.platform) ?? platform;

        await this.deps.store.put({
            active,
            productId,
            expiresAt,
            platform: responsePlatform,
            reference,
        });

        if (!active) {
            await this.deps.resetPaidPreferences();
        }

        return { active, productId, expiresAt, platform: responsePlatform };
    }
}

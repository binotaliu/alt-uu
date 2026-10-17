import type { KeyValueStoreRepository } from '../../db/keyValueStore';
import { UserFacingHttpError } from '../../errors/errors';
import type { UpstreamCallListener } from '../../http/transport';
import type { Clock, Fetch } from '../../platform';
import { AltUUPlusClient } from './altUUPlusClient';
import { defaultSubscriptionConfig, type SubscriptionConfig } from './config';
import { SubscriptionEntitlementStore } from './entitlementStore';
import { EntitlementVerifier } from './entitlementVerifier';
import type {
    EntitlementViewModel,
    ProductViewModel,
    PurchaseReference,
    StoreBilling,
    StoreEntitlement,
} from './types';

export interface SubscriptionServicesDeps {
    billing: StoreBilling;
    fetch: Fetch;
    keyValues: KeyValueStoreRepository;
    clock: Clock;
    /** Reset the accent color to the default when it is not already. */
    resetPaidPreferences: () => Promise<void>;
    config?: Partial<SubscriptionConfig>;
    onUpstreamCall?: UpstreamCallListener;
}

const MAX_PRODUCT_ID_LENGTH = 191;

/** Wires the Subscription domain (legacy src/Domains/Subscription/Actions). */
export function createSubscriptionServices(deps: SubscriptionServicesDeps) {
    const config: SubscriptionConfig = {
        ...defaultSubscriptionConfig,
        ...deps.config,
    };
    const store = new SubscriptionEntitlementStore(deps.keyValues, deps.clock);
    const verifier = new EntitlementVerifier({
        client: new AltUUPlusClient(config, {
            fetch: deps.fetch,
            onUpstreamCall: deps.onUpstreamCall,
        }),
        store,
        resetPaidPreferences: deps.resetPaidPreferences,
    });

    /**
     * Local-only lookup: never touches the network, so the app can assume the
     * last known state immediately and let the backend refresh correct it.
     */
    const getCachedEntitlement = async (): Promise<EntitlementViewModel> => {
        const cached = await store.get();

        if (cached === null) {
            return verifier.inactive();
        }

        return {
            active: cached.active && !hasExpired(cached.expiresAt, deps.clock),
            productId: cached.productId,
            expiresAt: cached.expiresAt,
            platform: cached.platform,
        };
    };

    return {
        verifier,
        store,

        /** Legacy FetchAvailableProducts (iOS list when there is no store). */
        async fetchAvailableProducts(): Promise<ProductViewModel[]> {
            const platform = deps.billing.platform ?? 'ios';
            const products = await deps.billing.fetchProducts(
                config.productIds[platform],
            );

            return products.map((product) => ({
                id: product.id,
                displayName: product.displayName,
                description: product.description,
                displayPrice: product.displayPrice,
                price: Number(product.price),
            }));
        },

        getCachedEntitlement,

        /** Legacy GetEntitlementStatus: backend first, cache as fallback. */
        async getEntitlementStatus(): Promise<EntitlementViewModel> {
            return (
                (await verifier.refreshFromBackend()) ??
                (await getCachedEntitlement())
            );
        },

        /** Legacy PurchaseSubscription. */
        async purchaseSubscription(
            productId: string,
        ): Promise<EntitlementViewModel> {
            if (
                typeof productId !== 'string' ||
                productId === '' ||
                productId.length > MAX_PRODUCT_ID_LENGTH
            ) {
                throw new UserFacingHttpError(422, '請選擇訂閱方案');
            }

            const result = await deps.billing.purchase(productId);
            const platform = deps.billing.platform;

            if (result.status !== 'purchased' || platform === null) {
                return verifier.inactive();
            }

            const reference: PurchaseReference =
                platform === 'ios'
                    ? {
                          transaction_id:
                              result.originalTransactionId ??
                              result.transactionId ??
                              null,
                          product_id: result.productId || productId,
                      }
                    : {
                          purchase_token: result.purchaseToken ?? null,
                          product_id: result.productId || productId,
                      };

            return verifier.verify(platform, reference);
        },

        /** Legacy RestorePurchases: verifies the first owned subscription. */
        async restorePurchases(): Promise<EntitlementViewModel> {
            const entitlements = await deps.billing.restore();
            const platform = deps.billing.platform;

            if (platform === null || entitlements.length === 0) {
                return verifier.inactive();
            }

            return verifier.verify(
                platform,
                restoreReference(platform, entitlements[0]),
            );
        },
    };
}

export type SubscriptionServices = ReturnType<
    typeof createSubscriptionServices
>;

function restoreReference(
    platform: 'ios' | 'android',
    latest: StoreEntitlement,
): PurchaseReference {
    return platform === 'ios'
        ? {
              transaction_id:
                  latest.originalTransactionId ?? latest.transactionId ?? null,
              product_id: latest.productId ?? null,
          }
        : {
              purchase_token: latest.purchaseToken ?? null,
              product_id: latest.productId ?? latest.productIds?.[0] ?? null,
          };
}

/**
 * An offline device never hears that the subscription ended, so a cached
 * "active" must not outlive the expiry date it was cached with.
 */
function hasExpired(expiresAt: string | null, clock: Clock): boolean {
    if (expiresAt === null) {
        return false;
    }

    const expiry = Date.parse(expiresAt);

    return !Number.isNaN(expiry) && expiry < clock.now().getTime();
}

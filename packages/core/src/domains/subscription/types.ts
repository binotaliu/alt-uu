export type StorePlatform = 'ios' | 'android';

/** Field names match legacy resources/js/types/generated.d.ts. */
export interface EntitlementViewModel {
    active: boolean;
    productId: string | null;
    expiresAt: string | null;
    platform: string | null;
}

export interface ProductViewModel {
    id: string;
    displayName: string;
    description: string;
    displayPrice: string;
    price: number;
}

/** A subscription product as the store reports it. */
export type StoreProduct = ProductViewModel;

/**
 * Outcome of the store purchase sheet. Mirrors the legacy plugin's
 * `AltUUPlus.Purchase` payload, where only `purchased` carries proof.
 */
export type StorePurchaseResult =
    | {
          status: 'purchased';
          platform: StorePlatform;
          productId: string;
          /** iOS: StoreKit `originalID`; the server verifies this. */
          originalTransactionId?: string;
          transactionId?: string;
          /** iOS: the signed transaction (JWS). */
          jws?: string;
          /** Android: Play purchase token (already acknowledged). */
          purchaseToken?: string;
          orderId?: string;
      }
    | { status: 'cancelled' | 'pending' | 'unknown' };

/** One owned subscription (legacy `RestorePurchases`/`CurrentEntitlements`). */
export interface StoreEntitlement {
    platform: StorePlatform;
    productId: string | null;
    productIds?: string[];
    originalTransactionId?: string;
    transactionId?: string;
    jws?: string;
    purchaseToken?: string;
    orderId?: string;
}

/**
 * The native store bridge (StoreKit 2 / Play Billing). Core stays pure TS:
 * apps/mobile implements it on top of expo-iap, dev builds can use
 * {@link LocalStoreBilling}.
 */
export interface StoreBilling {
    /** The store this build talks to, or null when there is none (dev). */
    readonly platform: StorePlatform | null;
    fetchProducts(productIds: string[]): Promise<StoreProduct[]>;
    /**
     * Runs the purchase flow and resolves with the outcome. Android
     * implementations must acknowledge the purchase before resolving.
     */
    purchase(productId: string): Promise<StorePurchaseResult>;
    /** Re-syncs with the store, then returns what the user owns. */
    restore(): Promise<StoreEntitlement[]>;
    currentEntitlements(): Promise<StoreEntitlement[]>;
}

/** What the alt-uu server needs to identify a purchase. */
export type PurchaseReference =
    | { transaction_id: string | null; product_id: string | null }
    | { purchase_token: string | null; product_id: string | null };

/** The cached entitlement (legacy SubscriptionEntitlementStore). */
export interface CachedEntitlement {
    active: boolean;
    productId: string | null;
    expiresAt: string | null;
    platform: string | null;
    reference: Record<string, unknown> | null;
}

/** JSON the server answers `verify` / `entitlement` with. */
export interface IapServerResponse {
    active?: unknown;
    product_id?: unknown;
    expires_at?: unknown;
    platform?: unknown;
}

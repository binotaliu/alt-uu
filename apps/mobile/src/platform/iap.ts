import type {
    StoreBilling,
    StoreEntitlement,
    StorePlatform,
    StoreProduct,
    StorePurchaseResult,
} from '@altuu/core';
import {
    ErrorCode,
    finishTransaction,
    getAvailablePurchases,
    initConnection,
    fetchProducts as iapFetchProducts,
    purchaseErrorListener,
    purchaseUpdatedListener,
    requestPurchase,
    restorePurchases,
    type ProductSubscription,
    type Purchase,
    type PurchaseAndroid,
    type PurchaseIOS,
} from 'expo-iap';
import { Platform } from 'react-native';

/** Face ID / Ask to Buy / PIN can take a while (legacy: 120 s). */
const PURCHASE_TIMEOUT_MS = 120_000;

/**
 * {@link StoreBilling} on top of expo-iap (StoreKit 2 / Play Billing), shaped
 * like the legacy plugin-alt-uu-plus bridge:
 *
 * - iOS yields `originalTransactionId` (what the alt-uu server verifies) and
 *   the signed transaction as `jws`; the transaction is finished right after
 *   the purchase, as the legacy plugin did.
 * - Android yields the Play `purchaseToken`; the purchase is acknowledged
 *   (`finishTransaction`, non-consumable) before resolving.
 */
export class ExpoIapBilling implements StoreBilling {
    readonly platform: StorePlatform | null =
        Platform.OS === 'ios'
            ? 'ios'
            : Platform.OS === 'android'
              ? 'android'
              : null;

    private connection: Promise<unknown> | null = null;

    async fetchProducts(productIds: string[]): Promise<StoreProduct[]> {
        const products = await this.loadSubscriptions(productIds);

        return products.map(toStoreProduct);
    }

    async purchase(productId: string): Promise<StorePurchaseResult> {
        const platform = this.requirePlatform();
        const [product] = await this.loadSubscriptions([productId]);

        if (product === undefined) {
            throw new Error('Product not found in store configuration');
        }

        const offerToken =
            platform === 'android'
                ? ((product.subscriptionOffers ?? []).find(
                      (offer) => offer.offerTokenAndroid != null,
                  )?.offerTokenAndroid ?? null)
                : null;

        if (platform === 'android' && offerToken === null) {
            throw new Error('No subscription offer available for this product');
        }

        const outcome = this.waitForOutcome(productId);

        try {
            await requestPurchase({
                type: 'subs',
                request: {
                    apple: { sku: productId },
                    google: {
                        skus: [productId],
                        subscriptionOffers:
                            offerToken === null
                                ? undefined
                                : [{ sku: productId, offerToken }],
                    },
                },
            });
        } catch (error) {
            outcome.cancel();

            if (isCancellation(error)) {
                return { status: 'cancelled' };
            }

            throw error;
        }

        const settled = await outcome.promise;

        if (settled.kind !== 'purchase') {
            return { status: settled.kind };
        }

        const { purchase } = settled;

        if (purchase.purchaseState === 'pending') {
            return { status: 'pending' };
        }

        await finishTransaction({ purchase, isConsumable: false });

        return { status: 'purchased', ...toReference(platform, purchase) };
    }

    async restore(): Promise<StoreEntitlement[]> {
        await this.connect();
        await restorePurchases();

        return this.currentEntitlements();
    }

    async currentEntitlements(): Promise<StoreEntitlement[]> {
        const platform = this.requirePlatform();

        await this.connect();

        const purchases = await getAvailablePurchases({
            onlyIncludeActiveItemsIOS: true,
        });

        return purchases
            .filter(
                (purchase) =>
                    purchase.purchaseState === 'purchased' &&
                    (purchase as PurchaseAndroid).isSuspendedAndroid !== true,
            )
            .map((purchase) => toEntitlement(platform, purchase));
    }

    private connect(): Promise<unknown> {
        this.connection ??= initConnection().catch((error: unknown) => {
            this.connection = null;

            throw error;
        });

        return this.connection;
    }

    private async loadSubscriptions(
        productIds: string[],
    ): Promise<ProductSubscription[]> {
        await this.connect();

        const products = await iapFetchProducts({
            skus: productIds,
            type: 'subs',
        });

        return (products ?? []) as ProductSubscription[];
    }

    private requirePlatform(): StorePlatform {
        if (this.platform === null) {
            throw new Error(
                'In-app purchases are not available on this device',
            );
        }

        return this.platform;
    }

    /**
     * expo-iap reports purchases through listeners rather than the return
     * value, so subscribe before `requestPurchase` and settle on the first
     * matching event.
     */
    private waitForOutcome(productId: string): {
        promise: Promise<PurchaseOutcome>;
        cancel: () => void;
    } {
        let release = (): void => undefined;
        const promise = new Promise<PurchaseOutcome>((resolve, reject) => {
            const updated = purchaseUpdatedListener((purchase) => {
                if (
                    purchase.productId === productId ||
                    purchase.ids?.includes(productId) === true
                ) {
                    resolve({ kind: 'purchase', purchase });
                }
            });
            const failed = purchaseErrorListener((error) => {
                if (error.code === ErrorCode.UserCancelled) {
                    resolve({ kind: 'cancelled' });
                } else if (
                    error.code === ErrorCode.Pending ||
                    error.code === ErrorCode.DeferredPayment
                ) {
                    resolve({ kind: 'pending' });
                } else {
                    reject(new Error(error.message));
                }
            });
            const timer = setTimeout(
                () => resolve({ kind: 'unknown' }),
                PURCHASE_TIMEOUT_MS,
            );

            release = () => {
                clearTimeout(timer);
                updated.remove();
                failed.remove();
            };
        });
        const settled = promise.finally(() => release());

        // A rejection nobody awaits (cancel() after requestPurchase threw)
        // must not surface as an unhandled promise rejection.
        settled.catch(() => undefined);

        return { promise: settled, cancel: () => release() };
    }
}

type PurchaseOutcome =
    | { kind: 'purchase'; purchase: Purchase }
    | { kind: 'cancelled' | 'pending' | 'unknown' };

function toStoreProduct(product: ProductSubscription): StoreProduct {
    return {
        id: product.id,
        displayName:
            product.platform === 'android'
                ? product.nameAndroid
                : (product.displayName ?? product.title),
        description: product.description,
        displayPrice: product.displayPrice,
        price: product.price ?? 0,
    };
}

function toReference(
    platform: StorePlatform,
    purchase: Purchase,
): Omit<Extract<StorePurchaseResult, { status: 'purchased' }>, 'status'> {
    if (platform === 'ios') {
        const ios = purchase as PurchaseIOS;

        return {
            platform,
            productId: ios.productId,
            transactionId: ios.transactionId,
            originalTransactionId:
                ios.originalTransactionIdentifierIOS ?? ios.transactionId,
            // The unified `purchaseToken` of an iOS purchase is its JWS.
            jws: ios.purchaseToken ?? undefined,
        };
    }

    const android = purchase as PurchaseAndroid;

    return {
        platform,
        productId: android.productId,
        purchaseToken: android.purchaseToken ?? undefined,
        orderId: android.transactionId ?? undefined,
    };
}

function toEntitlement(
    platform: StorePlatform,
    purchase: Purchase,
): StoreEntitlement {
    const {
        platform: _platform,
        productId,
        ...rest
    } = toReference(platform, purchase);

    return {
        platform,
        productId,
        productIds: purchase.ids ?? undefined,
        ...rest,
    };
}

function isCancellation(error: unknown): boolean {
    return (
        typeof error === 'object' &&
        error !== null &&
        (error as { code?: unknown }).code === ErrorCode.UserCancelled
    );
}

export const storeBilling: StoreBilling = new ExpoIapBilling();

import { ref } from 'vue';
import { apiFetch } from '@/composables/useApi';
import type { SubscriptionEntitlement, SubscriptionProduct } from '@/types';

/**
 * Composable for fetching subscription products and managing purchase/restore
 * against the on-device /api/subscription/* endpoints. Entitlement status
 * lives in the `subscription` Pinia store since it's needed app-wide.
 *
 * These went through bare fetch() with no response.ok check at all, so an
 * error page was parsed as a product list and a failed purchase looked like a
 * successful one. Routing them through apiFetch gets them the same error
 * handling, correlation id and diagnostic recording as everything else.
 */
export function useSubscription() {
    const products = ref<SubscriptionProduct[]>([]);
    const isLoadingProducts = ref(false);
    const isPurchasing = ref(false);
    const isRestoring = ref(false);

    async function fetchProducts(): Promise<void> {
        isLoadingProducts.value = true;

        try {
            products.value = await apiFetch<SubscriptionProduct[]>(
                '/api/subscription/products',
            );
        } finally {
            isLoadingProducts.value = false;
        }
    }

    async function purchase(
        productId: string,
    ): Promise<SubscriptionEntitlement> {
        isPurchasing.value = true;

        try {
            return await apiFetch<SubscriptionEntitlement>(
                '/api/subscription/purchase',
                {
                    method: 'POST',
                    body: JSON.stringify({ productId }),
                },
            );
        } finally {
            isPurchasing.value = false;
        }
    }

    async function restore(): Promise<SubscriptionEntitlement> {
        isRestoring.value = true;

        try {
            return await apiFetch<SubscriptionEntitlement>(
                '/api/subscription/restore',
                { method: 'POST' },
            );
        } finally {
            isRestoring.value = false;
        }
    }

    return {
        products,
        isLoadingProducts,
        isPurchasing,
        isRestoring,
        fetchProducts,
        purchase,
        restore,
    };
}

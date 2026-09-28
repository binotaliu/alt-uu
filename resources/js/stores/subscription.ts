import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { apiFetch } from '@/composables/useApi';
import { DEFAULT_ACCENT } from '@/lib/accents';
import { useAppConfigStore } from '@/stores/appConfig';
import type { SubscriptionEntitlement } from '@/types';

export const useSubscriptionStore = defineStore('subscription', () => {
    const active = ref<boolean>(false);
    const productId = ref<string | null>(null);
    const expiresAt = ref<string | null>(null);
    const platform = ref<string | null>(null);
    const isLoaded = ref<boolean>(false);

    let inflight: Promise<void> | null = null;

    function applyEntitlement(entitlement: SubscriptionEntitlement): void {
        active.value = entitlement.active;
        productId.value = entitlement.productId;
        expiresAt.value = entitlement.expiresAt;
        platform.value = entitlement.platform;
        isLoaded.value = true;

        // Accent colors are an Alt UU+ perk. The backend already reset the
        // stored accent when it saw the subscription lapse; follow it here
        // instead of waiting for the next config reload.
        if (!entitlement.active) {
            useAppConfigStore().accentColor = DEFAULT_ACCENT;
        }
    }

    async function refreshFromBackend(): Promise<void> {
        try {
            applyEntitlement(
                await apiFetch<SubscriptionEntitlement>(
                    '/api/subscription/status',
                ),
            );
        } catch {
            // Couldn't reach the on-device API: keep whatever we already
            // know instead of downgrading.
        }
    }

    /**
     * Assume the last locally known entitlement right away (no network), then
     * let the backend check correct it. Only `force` waits for that check.
     */
    async function loadStatus(force = false): Promise<void> {
        if (!force && isLoaded.value) {
            return;
        }

        if (!force && inflight) {
            return inflight;
        }

        inflight = (async () => {
            try {
                if (!isLoaded.value) {
                    try {
                        applyEntitlement(
                            await apiFetch<SubscriptionEntitlement>(
                                '/api/subscription/status/cached',
                            ),
                        );
                    } catch {
                        // fall through to the backend check
                    }
                }

                if (force || !isLoaded.value) {
                    await refreshFromBackend();
                } else {
                    void refreshFromBackend();
                }
            } finally {
                inflight = null;
            }
        })();

        return inflight;
    }

    function reset(): void {
        active.value = false;
        productId.value = null;
        expiresAt.value = null;
        platform.value = null;
        isLoaded.value = false;
        inflight = null;
    }

    return {
        active,
        productId,
        expiresAt,
        platform,
        isLoaded,
        isPremium: computed(() => active.value),
        loadStatus,
        applyEntitlement,
        reset,
    };
});

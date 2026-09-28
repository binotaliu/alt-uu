<script setup lang="ts">
import { LockClosedIcon } from '@heroicons/vue/24/outline';
import { CheckIcon } from '@heroicons/vue/24/solid';
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import PremiumBadge from '@/components/PremiumBadge.vue';
import { ACCENTS, DEFAULT_ACCENT } from '@/lib/accents';
import type { AccentId } from '@/lib/accents';
import { ApiError } from '@/lib/apiError';
import { useAppConfigStore } from '@/stores/appConfig';
import { useSubscriptionStore } from '@/stores/subscription';

type Appearance = 'system' | 'light' | 'dark';

const configStore = useAppConfigStore();
const subscriptionStore = useSubscriptionStore();
const router = useRouter();

const appearance = ref<Appearance>('system');
const isSavingAppearance = ref(false);
const isSavingAccent = ref(false);

// Settings is reachable before login, and the subscription endpoints sit
// behind the Hungu session (a 401 there hard-redirects to /login).
const hasAccounts =
    (window as typeof window & { hasAccounts?: boolean }).hasAccounts === true;

const appearanceOptions = [
    { value: 'system', label: '自動' },
    { value: 'light', label: '淺色' },
    { value: 'dark', label: '深色' },
] as const;

function applyAppearanceToDocument(value: Appearance) {
    if (value === 'dark') {
        document.documentElement.classList.add('dark');
    } else if (value === 'light') {
        document.documentElement.classList.remove('dark');
    } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }

    // Keep global preference in sync for focus/visibility handlers.
    window.appearance = value;
}

function reportSaveFailure() {
    window.showFlashMessage?.('儲存設定失敗，請稍後再試。', 'error');
}

onMounted(async () => {
    appearance.value = configStore.appearance;

    if (hasAccounts) {
        void subscriptionStore.loadStatus();
    }

    await configStore.loadPreferences();

    appearance.value = configStore.appearance;
    applyAppearanceToDocument(appearance.value);
});

async function setAppearance(value: Appearance) {
    const previous = appearance.value;

    appearance.value = value;
    isSavingAppearance.value = true;

    try {
        await configStore.updatePreferences({ appearance: value });

        // Apply immediately without reload.
        applyAppearanceToDocument(value);
    } catch {
        appearance.value = previous;
        reportSaveFailure();
    } finally {
        isSavingAppearance.value = false;
    }
}

function goToSubscription() {
    void router.push({ name: 'courses.account.subscription' });
}

async function setAccent(value: AccentId) {
    if (value === configStore.accentColor) {
        return;
    }

    if (value !== DEFAULT_ACCENT) {
        if (!hasAccounts) {
            window.showFlashMessage?.(
                '登入並訂閱 Alt UU+ 後即可更換主題色。',
                'error',
            );

            return;
        }

        await subscriptionStore.loadStatus();

        if (!subscriptionStore.active) {
            goToSubscription();

            return;
        }
    }

    const previous = configStore.accentColor;

    // The store watches accentColor and writes it to <html data-accent>, so the
    // palette switches instantly; the PATCH persists it.
    configStore.accentColor = value;
    isSavingAccent.value = true;

    try {
        await configStore.updatePreferences({ accentColor: value });
    } catch (error) {
        configStore.accentColor = previous;

        if (error instanceof ApiError && error.status === 402) {
            // The backend disagrees with what we assumed; resync before sending
            // the user to the subscription page.
            void subscriptionStore.loadStatus(true);
            goToSubscription();
        } else {
            reportSaveFailure();
        }
    } finally {
        isSavingAccent.value = false;
    }
}
</script>

<template>
    <section
        class="rounded-xl border border-theme-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
    >
        <h3 class="text-sm font-semibold text-theme-900 dark:text-zinc-100">
            外觀
        </h3>
        <p class="mt-1 text-xs text-theme-700 dark:text-zinc-400">
            選擇深色或淺色模式，或依照系統設定自動切換。
        </p>
        <div
            class="mt-3 flex rounded-xl border border-theme-200 bg-theme-50 p-1 dark:border-zinc-700 dark:bg-zinc-800"
        >
            <button
                v-for="option in appearanceOptions"
                :key="option.value"
                type="button"
                class="flex-1 rounded-lg px-3 py-2 text-sm font-medium transition"
                :class="
                    appearance === option.value
                        ? 'bg-white text-theme-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-100'
                        : 'text-theme-700 hover:text-theme-900 dark:text-zinc-400 dark:hover:text-zinc-200'
                "
                :disabled="isSavingAppearance"
                :data-testid="`appearance-${option.value}`"
                @click="setAppearance(option.value)"
            >
                {{ option.label }}
            </button>
        </div>

        <p
            v-if="!configStore.altUuPlusDisabled"
            class="mt-4 flex items-center gap-2 text-xs font-medium text-theme-700 dark:text-zinc-400"
        >
            主題色
            <PremiumBadge v-if="!subscriptionStore.active" />
        </p>
        <div
            v-if="!configStore.altUuPlusDisabled"
            class="mt-2 flex flex-wrap items-center justify-between gap-2"
        >
            <button
                v-for="option in ACCENTS"
                :key="option.id"
                type="button"
                :aria-pressed="configStore.accentColor === option.id"
                :aria-label="option.label"
                :disabled="isSavingAccent"
                class="flex size-9 shrink-0 items-center justify-center rounded-xl ring-2 ring-offset-2 ring-offset-white transition dark:ring-offset-zinc-900"
                :class="
                    configStore.accentColor === option.id
                        ? 'ring-theme-500'
                        : 'ring-transparent hover:ring-theme-200 dark:hover:ring-zinc-700'
                "
                :style="{ backgroundColor: option.swatch }"
                :data-testid="`accent-${option.id}`"
                @click="setAccent(option.id)"
            >
                <CheckIcon
                    v-if="configStore.accentColor === option.id"
                    class="size-5 text-white"
                />
                <LockClosedIcon
                    v-else-if="
                        !subscriptionStore.active &&
                        option.id !== DEFAULT_ACCENT
                    "
                    class="size-4 text-white/90"
                />
            </button>
        </div>
    </section>
</template>

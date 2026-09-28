<!-- eslint-disable prettier/prettier -->
<script setup lang="ts">
import { UserCircleIcon } from '@heroicons/vue/24/outline';
import { computed, ref } from 'vue';
import AccountListItem from '@/components/AccountListItem.vue';
import { useAccountSwitcher } from '@/composables/useAccountSwitcher';
import router from '@/router';
import { useAccountsStore } from '@/stores/accounts';
import { useAppConfigStore } from '@/stores/appConfig';
import type { AccountProfile } from '@/types';

const configStore = useAppConfigStore();
const accountsStore = useAccountsStore();
const { switchAccount } = useAccountSwitcher();

accountsStore.loadAccounts();

const LONG_PRESS_MS = 500;
const MOVE_CANCEL_PX = 10;

let pressTimer: ReturnType<typeof setTimeout> | null = null;
let longPressTriggered = false;
let pressStart: { x: number; y: number } | null = null;

const menuOpen = ref(false);
const switchingAccountId = ref<number | null>(null);

const canQuickSwitch = computed(() => accountsStore.accounts.length > 1);

function clearPressTimer(): void {
    if (pressTimer) {
        clearTimeout(pressTimer);
        pressTimer = null;
    }
}

function onPointerDown(event: PointerEvent): void {
    if (event.pointerType === 'mouse' && event.button !== 0) {
        return;
    }

    longPressTriggered = false;
    pressStart = { x: event.clientX, y: event.clientY };

    clearPressTimer();
    pressTimer = setTimeout(() => {
        if (canQuickSwitch.value) {
            longPressTriggered = true;
            menuOpen.value = true;
        }
    }, LONG_PRESS_MS);
}

function onPointerMove(event: PointerEvent): void {
    if (!pressStart) {
        return;
    }

    const dx = event.clientX - pressStart.x;
    const dy = event.clientY - pressStart.y;

    if (Math.hypot(dx, dy) > MOVE_CANCEL_PX) {
        clearPressTimer();
    }
}

function onPointerUp(): void {
    clearPressTimer();
    pressStart = null;
}

function onClick(): void {
    if (longPressTriggered) {
        longPressTriggered = false;

        return;
    }

    router.push({ name: 'courses.account' });
}

function closeMenu(): void {
    menuOpen.value = false;
}

async function onSelectAccount(account: AccountProfile): Promise<void> {
    if (account.isActive || switchingAccountId.value !== null) {
        closeMenu();

        return;
    }

    switchingAccountId.value = account.id;

    try {
        await switchAccount(account.id);
        closeMenu();
        window.showFlashMessage('已切換帳號', 'success');
    } catch (error) {
        alert(
            error instanceof Error
                ? error.message
                : '切換帳號失敗，請稍後再試。',
        );
    } finally {
        switchingAccountId.value = null;
    }
}
</script>

<template>
    <button
        type="button"
        class="inline-flex max-w-40 items-center gap-2 rounded-full border border-theme-300 bg-white py-1 pr-3 pl-1 text-sm font-medium text-theme-700 transition hover:border-theme-500 hover:bg-theme-50 md:max-w-48 md:py-1.5 md:pr-4 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:border-zinc-400 dark:hover:bg-zinc-700"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointercancel="onPointerUp"
        @contextmenu.prevent
        @click="onClick"
    >
        <template v-if="!configStore.isProfileLoaded">
            <span
                class="size-6 shrink-0 animate-pulse rounded-full bg-theme-200 md:size-7 dark:bg-zinc-700"
            ></span>
            <span
                class="h-4 w-12 animate-pulse rounded bg-theme-200 dark:bg-zinc-700"
            ></span>
        </template>
        <template v-else>
            <img
                v-if="configStore.picture"
                :src="configStore.picture"
                alt=""
                draggable="false"
                class="size-6 shrink-0 rounded-full object-cover select-none [-webkit-touch-callout:none] md:size-7"
            />
            <UserCircleIcon
                v-else
                class="size-6 shrink-0 text-theme-700 md:size-7 dark:text-zinc-500"
            />
            <span class="truncate">{{
                configStore.nickname ??
                configStore.username ??
                configStore.displayName ??
                '帳號'
            }}</span>
        </template>
    </button>

    <Teleport to="body">
        <div
            v-if="menuOpen"
            class="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 pb-[max(var(--inset-bottom,0px),1rem)] backdrop-blur-xs md:items-center"
            @click.self="closeMenu"
        >
            <div
                class="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-xl dark:bg-zinc-900"
            >
                <div class="px-5 py-4">
                    <h3
                        class="text-lg font-semibold text-theme-900 dark:text-zinc-100"
                    >
                        切換帳號
                    </h3>
                </div>

                <ul
                    class="max-h-80 overflow-y-auto border-t border-theme-200 dark:border-zinc-700"
                >
                    <li
                        v-for="account in accountsStore.accounts"
                        :key="account.id"
                    >
                        <AccountListItem
                            :account="account"
                            :disabled="switchingAccountId === account.id"
                            @select="onSelectAccount(account)"
                        >
                            <template #trailing>
                                <span
                                    v-if="account.isActive"
                                    class="shrink-0 rounded-full bg-amber-700 px-2 py-0.5 text-xs font-semibold text-white"
                                >
                                    目前帳號
                                </span>
                                <span
                                    v-else-if="
                                        switchingAccountId === account.id
                                    "
                                    class="shrink-0 text-xs text-theme-700 dark:text-zinc-400"
                                >
                                    切換中…
                                </span>
                            </template>
                        </AccountListItem>
                    </li>
                </ul>

                <div
                    class="border-t border-theme-200 px-5 py-3 dark:border-zinc-700"
                >
                    <router-link
                        :to="{ name: 'courses.account' }"
                        class="block text-center text-sm font-medium text-theme-700 dark:text-zinc-300"
                        @click="closeMenu"
                    >
                        管理帳號
                    </router-link>
                </div>
            </div>
        </div>
    </Teleport>
</template>

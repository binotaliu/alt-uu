<script setup lang="ts">
import { computed, onActivated, onMounted, ref } from 'vue';
import LiveSessionsTab from '@/components/LiveSessionsTab.vue';
import { useNouToolsLiveSessions } from '@/composables/useNouTools';
import { useAccountsStore } from '@/stores/accounts';
import { useAppConfigStore } from '@/stores/appConfig';

const configStore = useAppConfigStore();
const accountsStore = useAccountsStore();
const {
    items: liveSessions,
    isLoading,
    error,
    errorDetail,
    fetchLiveSessions,
} = useNouToolsLiveSessions();

const showAllAccounts = ref(false);
const hasMultipleAccounts = computed(() => accountsStore.accounts.length > 1);

// Background refetches (onActivated, revisiting under <KeepAlive>) shouldn't
// blank out the already-visible list — only show the full skeleton when
// there's nothing cached yet to display.
const isInitialLoading = computed(
    () => isLoading.value && liveSessions.value.length === 0,
);

async function onUpdateShowAllAccounts(value: boolean): Promise<void> {
    showAllAccounts.value = value;
    await fetchLiveSessions(value);
}

let hasMounted = false;

onMounted(async () => {
    hasMounted = true;
    await Promise.all([configStore.loadConfig(), accountsStore.loadAccounts()]);
    fetchLiveSessions(showAllAccounts.value);
});

// Revisiting this tab under <KeepAlive> skips onMounted, so refresh the
// (uncached) live-sessions list here instead.
onActivated(() => {
    if (!hasMounted) {
        return;
    }

    fetchLiveSessions(showAllAccounts.value);
});
</script>

<template>
    <div
        class="px-4 pt-3 pb-[calc(var(--bottom-nav-height,7rem)+1rem)] md:px-6 md:pt-4 md:pb-6"
    >
        <LiveSessionsTab
            :live-sessions="liveSessions"
            :is-loading="isInitialLoading"
            :error="error"
            :error-detail="errorDetail"
            :has-multiple-accounts="hasMultipleAccounts"
            :show-all-accounts="showAllAccounts"
            @update:show-all-accounts="onUpdateShowAllAccounts"
            @retry="fetchLiveSessions(showAllAccounts)"
        />
    </div>
</template>

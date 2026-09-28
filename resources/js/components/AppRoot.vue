<script setup lang="ts">
import { onMounted } from 'vue';
import { RouterView } from 'vue-router';
import ConnectivityIssueModal from '@/components/ConnectivityIssueModal.vue';
import SessionExpiredPicker from '@/components/SessionExpiredPicker.vue';
import WhatsNewSheet from '@/components/WhatsNewSheet.vue';
import { useAccountsStore } from '@/stores/accounts';
import { useAppConfigStore } from '@/stores/appConfig';
import { useSubscriptionStore } from '@/stores/subscription';

const accountsStore = useAccountsStore();
const configStore = useAppConfigStore();
const subscriptionStore = useSubscriptionStore();

onMounted(() => {
    const hasAccounts =
        (window as typeof window & { hasAccounts?: boolean }).hasAccounts ===
        true;

    if (!hasAccounts) {
        return;
    }

    // A local, unguarded read (no Hungu round-trip) — loaded eagerly so
    // useSessionExpiry has an up-to-date "who was active" snapshot to fall
    // back on if a later 401 can't report which account just failed (the
    // failing account may already have been soft-deleted by the time a
    // concurrent request's own middleware check runs).
    void accountsStore.loadAccounts();

    // Checked once the profile call has finished the app-boot session
    // validation (firing it concurrently races that validation). Lets a lapsed
    // subscription reset the accent color as soon as the app opens.
    void configStore.loadProfile().then(() => {
        if (configStore.isLoggedIn) {
            void subscriptionStore.loadStatus();
        }
    });
});
</script>

<template>
    <SessionExpiredPicker />
    <ConnectivityIssueModal />
    <WhatsNewSheet />
    <RouterView v-slot="{ Component, route }">
        <KeepAlive :max="1">
            <component
                :is="Component"
                :key="
                    (route.meta.keepAliveKey as string | undefined) ??
                    route.name
                "
                v-if="route.meta.keepAlive"
            />
        </KeepAlive>
        <component
            :is="Component"
            :key="route.path"
            v-if="!route.meta.keepAlive"
        />
    </RouterView>
</template>

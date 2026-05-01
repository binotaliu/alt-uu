<script setup lang="ts">
import { VideoCameraIcon } from '@heroicons/vue/24/outline';
import { computed, onMounted } from 'vue';
import AppLayout from '@/components/AppLayout.vue';
import CoursesBottomNav from '@/components/CoursesBottomNav.vue';
import CoursesTopNav from '@/components/CoursesTopNav.vue';
import LiveSessionsTab from '@/components/LiveSessionsTab.vue';
import TransparentPageHeader from '@/components/TransparentPageHeader.vue';
import { useNouToolsLiveSessions } from '@/composables/useNouTools';
import { useTitle } from '@/composables/useTitle';
import { useAppConfigStore } from '@/stores/appConfig';

useTitle('視訊面授');
const configStore = useAppConfigStore();
const nouToolsEnabled = computed(() =>
    Boolean(configStore.nouToolsIntegrationEnabled),
);
const {
    items: liveSessions,
    isLoading,
    error,
    fetchLiveSessions,
} = useNouToolsLiveSessions();

onMounted(async () => {
    await configStore.loadConfig();
    fetchLiveSessions();
});
</script>

<template>
    <AppLayout>
        <TransparentPageHeader title="視訊面授">
            <template #nav>
                <CoursesTopNav active-tab="live-sessions" />
            </template>
            <template #icon>
                <VideoCameraIcon class="size-5 md:size-6" />
            </template>
        </TransparentPageHeader>

        <div
            class="px-4 pt-3 pb-[calc(var(--inset-bottom,0px)+7rem)] md:px-6 md:pt-4 md:pb-6"
        >
            <LiveSessionsTab
                :live-sessions="liveSessions"
                :is-loading="isLoading"
                :error="error"
            />
        </div>

        <CoursesBottomNav
            active-tab="live-sessions"
            :nou-tools-enabled="nouToolsEnabled"
        />
    </AppLayout>
</template>

<script setup lang="ts">
import { CalendarDaysIcon } from '@heroicons/vue/24/outline';
import { computed, onMounted } from 'vue';
import AppLayout from '@/components/AppLayout.vue';
import CoursesBottomNav from '@/components/CoursesBottomNav.vue';
import CoursesTopNav from '@/components/CoursesTopNav.vue';
import SchoolCalendarTab from '@/components/SchoolCalendarTab.vue';
import TransparentPageHeader from '@/components/TransparentPageHeader.vue';
import { useNouToolsSchoolCalendar } from '@/composables/useNouTools';
import { useTitle } from '@/composables/useTitle';
import { useAppConfigStore } from '@/stores/appConfig';

useTitle('學校行事曆');
const configStore = useAppConfigStore();
const nouToolsEnabled = computed(() =>
    Boolean(configStore.nouToolsIntegrationEnabled),
);
const {
    items: schoolCalendar,
    isLoading,
    error,
    fetchSchoolCalendar,
} = useNouToolsSchoolCalendar();

onMounted(async () => {
    await configStore.loadConfig();
    fetchSchoolCalendar();
});
</script>

<template>
    <AppLayout>
        <TransparentPageHeader title="學校行事曆">
            <template #nav>
                <CoursesTopNav active-tab="school-calendar" />
            </template>
            <template #icon>
                <CalendarDaysIcon class="size-5 md:size-6" />
            </template>
        </TransparentPageHeader>

        <div
            class="px-4 pt-3 pb-[calc(var(--inset-bottom,0px)+7rem)] md:px-6 md:pt-4 md:pb-6"
        >
            <SchoolCalendarTab
                :school-calendar="schoolCalendar"
                :is-loading="isLoading"
                :error="error"
            />
        </div>

        <CoursesBottomNav
            active-tab="school-calendar"
            :nou-tools-enabled="nouToolsEnabled"
        />
    </AppLayout>
</template>

<script setup lang="ts">
import { computed, onActivated, onMounted } from 'vue';
import SchoolCalendarTab from '@/components/SchoolCalendarTab.vue';
import { useNouToolsSchoolCalendar } from '@/composables/useNouTools';
import { useAppConfigStore } from '@/stores/appConfig';

const configStore = useAppConfigStore();
const {
    items: schoolCalendar,
    isLoading,
    error,
    errorDetail,
    fetchSchoolCalendar,
} = useNouToolsSchoolCalendar();

// Background refetches (onActivated, revisiting under <KeepAlive>) shouldn't
// blank out the already-visible list — only show the full skeleton when
// there's nothing cached yet to display.
const isInitialLoading = computed(
    () => isLoading.value && schoolCalendar.value.length === 0,
);

let hasMounted = false;

onMounted(async () => {
    hasMounted = true;
    await configStore.loadConfig();
    fetchSchoolCalendar();
});

// Revisiting this tab under <KeepAlive> skips onMounted, so refresh the
// (uncached) calendar here instead.
onActivated(() => {
    if (!hasMounted) {
        return;
    }

    fetchSchoolCalendar();
});
</script>

<template>
    <div
        class="px-4 pt-3 pb-[calc(var(--bottom-nav-height,7rem)+1rem)] md:px-6 md:pt-4 md:pb-6"
    >
        <SchoolCalendarTab
            :school-calendar="schoolCalendar"
            :is-loading="isInitialLoading"
            :error="error"
            :error-detail="errorDetail"
            @retry="fetchSchoolCalendar"
        />
    </div>
</template>

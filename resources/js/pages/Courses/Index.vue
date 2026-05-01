<script setup lang="ts">
import { BriefcaseIcon } from '@heroicons/vue/24/outline';
import { onMounted, computed, ref } from 'vue';
import AppLayout from '@/components/AppLayout.vue';
import CourseListTab from '@/components/CourseListTab.vue';
import CoursesBottomNav from '@/components/CoursesBottomNav.vue';
import CoursesTopNav from '@/components/CoursesTopNav.vue';
import TransparentPageHeader from '@/components/TransparentPageHeader.vue';
import { apiFetch } from '@/composables/useApi';
import { useCourses } from '@/composables/useCourses';
import { useTitle } from '@/composables/useTitle';
import { restoreActiveMediaRoute } from '@/lib/restoreActiveMediaRoute';
import { useAppConfigStore } from '@/stores/appConfig';
import type { CourseTasksCount } from '@/types';

useTitle('我的課程');

const { courses, isLoading, hasFetched, error, fetchCourses } = useCourses();
const configStore = useAppConfigStore();
const nouToolsEnabled = computed(() =>
    Boolean(configStore.nouToolsIntegrationEnabled),
);
const tasksCount = ref<Record<string, CourseTasksCount>>({});
const tasksLoading = ref(false);
const tasksError = ref<string | null>(null);

async function fetchTasksCount(): Promise<void> {
    tasksLoading.value = true;
    tasksError.value = null;

    try {
        const data = await apiFetch<CourseTasksCount[]>(
            '/api/courses/tasks-count',
        );

        tasksCount.value = data.reduce(
            (map, item) => {
                map[item.courseId] = item;

                return map;
            },
            {} as Record<string, CourseTasksCount>,
        );
    } catch (e) {
        tasksError.value =
            e instanceof Error ? e.message : '載入課程任務統計失敗';
    } finally {
        tasksLoading.value = false;
    }
}

onMounted(async () => {
    await configStore.loadConfig();

    if (await restoreActiveMediaRoute()) {
        return;
    }

    fetchCourses();
    fetchTasksCount();
});
</script>

<template>
    <AppLayout>
        <TransparentPageHeader title="我的課程">
            <template #nav v-if="nouToolsEnabled">
                <CoursesTopNav active-tab="courses" v-if="nouToolsEnabled" />
            </template>
            <template #icon>
                <BriefcaseIcon class="size-5 md:size-6" />
            </template>
        </TransparentPageHeader>

        <div
            class="px-4 pt-3 pb-[calc(var(--inset-bottom,0px)+7rem)] md:px-6 md:pt-4 md:pb-6"
        >
            <CourseListTab
                :courses="courses"
                :tasks-count="tasksCount"
                :tasks-loading="tasksLoading"
                :tasks-error="tasksError"
                :is-loading="isLoading"
                :has-fetched="hasFetched"
                :error="error"
            />
        </div>

        <CoursesBottomNav
            active-tab="courses"
            :nou-tools-enabled="nouToolsEnabled"
        />
    </AppLayout>
</template>

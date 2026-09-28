<script setup lang="ts">
import { computed, onActivated, onMounted, ref } from 'vue';
import CourseListTab from '@/components/CourseListTab.vue';
import { apiFetch } from '@/composables/useApi';
import { useCourses } from '@/composables/useCourses';
import { useScrollLock } from '@/composables/useScrollLock';
import { restoreActiveMediaRoute } from '@/lib/restoreActiveMediaRoute';
import type { CourseTasksCount } from '@/types';

const { courses, isLoading, hasFetched, error, errorDetail, fetchCourses } =
    useCourses();

// Mirrors the condition CourseListTab uses to render its loading placeholder.
useScrollLock(computed(() => isLoading.value || !hasFetched.value));
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

let hasMounted = false;

onMounted(async () => {
    hasMounted = true;

    if (await restoreActiveMediaRoute()) {
        return;
    }

    fetchCourses();
    fetchTasksCount();
});

// Revisiting this tab under <KeepAlive> skips onMounted, so refresh the
// task counts (uncached) here instead. fetchCourses() is cheap to call
// again too — the course store no-ops when it already has data.
onActivated(() => {
    if (!hasMounted) {
        return;
    }

    fetchCourses();
    fetchTasksCount();
});
</script>

<template>
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
            :error-detail="errorDetail"
            @retry="fetchCourses"
        />
    </div>
</template>

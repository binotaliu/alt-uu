import { defineStore } from 'pinia';
import { ref } from 'vue';
import { apiFetch } from '@/composables/useApi';
import type { CourseItem } from '@/types';

export const useCourseStore = defineStore('courses', () => {
    const courses = ref<CourseItem[]>([]);
    const isLoading = ref(false);
    const hasFetched = ref(false);
    const error = ref<string | null>(null);
    let inflight: Promise<void> | null = null;

    async function loadCourses(force = false): Promise<void> {
        if (!force && courses.value.length > 0) {
            return;
        }

        if (!force && inflight) {
            return inflight;
        }

        isLoading.value = true;
        error.value = null;

        inflight = (async () => {
            try {
                const fetched = await apiFetch<CourseItem[]>('/api/courses');
                courses.value = fetched;
            } catch (e) {
                error.value = e instanceof Error ? e.message : '載入課程失敗';

                throw e;
            } finally {
                isLoading.value = false;
                hasFetched.value = true;
                inflight = null;
            }
        })();

        return inflight;
    }

    function clearCourses(): void {
        courses.value = [];
        error.value = null;
    }

    function reset(): void {
        courses.value = [];
        error.value = null;
        isLoading.value = false;
        hasFetched.value = false;
        inflight = null;
    }

    return {
        courses,
        isLoading,
        hasFetched,
        error,
        loadCourses,
        clearCourses,
        reset,
    };
});

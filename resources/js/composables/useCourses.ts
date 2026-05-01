import { computed } from 'vue';
import { useCourseStore } from '@/stores/courses';

export function useCourses() {
    const store = useCourseStore();

    async function fetchCourses(force = false): Promise<void> {
        await store.loadCourses(force);
    }

    return {
        courses: computed(() => store.courses),
        isLoading: computed(() => store.isLoading),
        hasFetched: computed(() => store.hasFetched),
        error: computed(() => store.error),
        fetchCourses,
        clearCourses: store.clearCourses,
    };
}

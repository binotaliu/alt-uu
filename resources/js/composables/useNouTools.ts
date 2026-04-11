import { ref } from 'vue';
import type {
    NouToolsCourseInfo,
    NouToolsLiveSessionItem,
    NouToolsSchoolCalendarEvent,
} from '@/types';
import { apiFetch } from './useApi';

export function useNouToolsLiveSessions() {
    const items = ref<NouToolsLiveSessionItem[]>([]);
    const isLoading = ref(false);
    const error = ref<string | null>(null);

    async function fetchLiveSessions(): Promise<void> {
        isLoading.value = true;
        error.value = null;

        try {
            items.value = await apiFetch<NouToolsLiveSessionItem[]>(
                '/api/nou-tools/live-sessions',
            );
        } catch (e) {
            error.value = e instanceof Error ? e.message : '載入視訊面授失敗';
            items.value = [];
        } finally {
            isLoading.value = false;
        }
    }

    return { items, isLoading, error, fetchLiveSessions };
}

export function useNouToolsSchoolCalendar() {
    const items = ref<NouToolsSchoolCalendarEvent[]>([]);
    const isLoading = ref(false);
    const error = ref<string | null>(null);

    async function fetchSchoolCalendar(): Promise<void> {
        isLoading.value = true;
        error.value = null;

        try {
            items.value = await apiFetch<NouToolsSchoolCalendarEvent[]>(
                '/api/nou-tools/school-calendar',
            );
        } catch (e) {
            error.value = e instanceof Error ? e.message : '載入學校行事曆失敗';
            items.value = [];
        } finally {
            isLoading.value = false;
        }
    }

    return { items, isLoading, error, fetchSchoolCalendar };
}

export function useNouToolsCourseInfo(cid: string) {
    const course = ref<NouToolsCourseInfo | null>(null);
    const isLoading = ref(false);
    const error = ref<string | null>(null);

    async function fetchCourseInfo(): Promise<void> {
        isLoading.value = true;
        error.value = null;

        try {
            const data = await apiFetch<{ course: NouToolsCourseInfo | null }>(
                `/api/courses/${encodeURIComponent(cid)}/nou-tools-info`,
            );
            course.value = data.course;
        } catch (e) {
            error.value = e instanceof Error ? e.message : '載入課程資訊失敗';
            course.value = null;
        } finally {
            isLoading.value = false;
        }
    }

    return { course, isLoading, error, fetchCourseInfo };
}

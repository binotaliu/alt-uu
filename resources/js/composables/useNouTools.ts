import { ref } from 'vue';
import { asApiError } from '@/lib/apiError';
import type { ApiError } from '@/lib/apiError';
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
    const errorDetail = ref<ApiError | null>(null);

    async function fetchLiveSessions(allAccounts = false): Promise<void> {
        isLoading.value = true;
        error.value = null;
        errorDetail.value = null;

        try {
            items.value = await apiFetch<NouToolsLiveSessionItem[]>(
                `/api/nou-tools/live-sessions${allAccounts ? '?allAccounts=1' : ''}`,
            );
        } catch (e) {
            error.value = e instanceof Error ? e.message : '載入視訊面授失敗';
            errorDetail.value = asApiError(e);
            items.value = [];
        } finally {
            isLoading.value = false;
        }
    }

    return { items, isLoading, error, errorDetail, fetchLiveSessions };
}

export function useNouToolsSchoolCalendar() {
    const items = ref<NouToolsSchoolCalendarEvent[]>([]);
    const isLoading = ref(false);
    const error = ref<string | null>(null);
    const errorDetail = ref<ApiError | null>(null);

    async function fetchSchoolCalendar(): Promise<void> {
        isLoading.value = true;
        error.value = null;
        errorDetail.value = null;

        try {
            items.value = await apiFetch<NouToolsSchoolCalendarEvent[]>(
                '/api/nou-tools/school-calendar',
            );
        } catch (e) {
            error.value = e instanceof Error ? e.message : '載入學校行事曆失敗';
            errorDetail.value = asApiError(e);
            items.value = [];
        } finally {
            isLoading.value = false;
        }
    }

    return { items, isLoading, error, errorDetail, fetchSchoolCalendar };
}

export function useNouToolsCourseInfo(cid: string) {
    const course = ref<NouToolsCourseInfo | null>(null);
    const isLoading = ref(false);
    const error = ref<string | null>(null);
    const errorDetail = ref<ApiError | null>(null);

    async function fetchCourseInfo(): Promise<void> {
        isLoading.value = true;
        error.value = null;
        errorDetail.value = null;

        try {
            const data = await apiFetch<{ course: NouToolsCourseInfo | null }>(
                `/api/courses/${encodeURIComponent(cid)}/nou-tools-info`,
            );
            course.value = data.course;
        } catch (e) {
            error.value = e instanceof Error ? e.message : '載入課程資訊失敗';
            errorDetail.value = asApiError(e);
            course.value = null;
        } finally {
            isLoading.value = false;
        }
    }

    return { course, isLoading, error, errorDetail, fetchCourseInfo };
}

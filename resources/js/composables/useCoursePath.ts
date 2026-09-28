import { ref } from 'vue';
import { asApiError } from '@/lib/apiError';
import type { ApiError } from '@/lib/apiError';
import type {
    CourseHomeworkItem,
    CourseHomeworkList,
    CourseLearningTimeItem,
    CoursePathData,
    CourseSchoolPortalInfo,
    CourseSelfExamItem,
    MaterialNode,
    MaterialResource,
    ParsedContent,
    SchoolPortalExamAgendaItem,
    SchoolPortalGrade,
    SchoolPortalHomeworkNotice,
} from '@/types';
import { apiFetch } from './useApi';

export function useCoursePath(cid: string) {
    const materialNodes = ref<MaterialNode[]>([]);
    const isLoading = ref(false);
    const error = ref<string | null>(null);
    const errorDetail = ref<ApiError | null>(null);

    async function fetchPath(): Promise<void> {
        isLoading.value = true;
        error.value = null;
        errorDetail.value = null;

        try {
            const data = await apiFetch<CoursePathData>(
                `/api/courses/${encodeURIComponent(cid)}/path`,
            );
            materialNodes.value = data.materialNodes;
        } catch (e) {
            error.value = e instanceof Error ? e.message : '載入教材目錄失敗';
            errorDetail.value = asApiError(e);
        } finally {
            isLoading.value = false;
        }
    }

    return { materialNodes, isLoading, error, errorDetail, fetchPath };
}

export function useLastSeenMaterial(cid: string) {
    const activityId = ref<string | null>(null);
    const positionSeconds = ref<number | null>(null);
    const mediaDurationSeconds = ref<number | null>(null);

    async function fetchLastSeenMaterial(): Promise<void> {
        try {
            const data = await apiFetch<{
                activityId: string | null;
                positionSeconds: number | null;
                mediaDurationSeconds: number | null;
            }>(`/api/courses/${encodeURIComponent(cid)}/last-seen-material`);
            activityId.value = data.activityId;
            positionSeconds.value = data.positionSeconds;
            mediaDurationSeconds.value = data.mediaDurationSeconds;
        } catch {
            activityId.value = null;
            positionSeconds.value = null;
            mediaDurationSeconds.value = null;
        }
    }

    return {
        activityId,
        positionSeconds,
        mediaDurationSeconds,
        fetchLastSeenMaterial,
    };
}

export function useNodeResources() {
    const resources = ref<MaterialResource[]>([]);
    const isLoading = ref(false);
    const error = ref<string | null>(null);
    const errorDetail = ref<ApiError | null>(null);

    async function fetchResources(cid: string, scoid: string): Promise<void> {
        isLoading.value = true;
        error.value = null;
        errorDetail.value = null;

        try {
            resources.value = await apiFetch<MaterialResource[]>(
                `/api/courses/${encodeURIComponent(cid)}/nodes/${encodeURIComponent(scoid)}/resources`,
            );
        } catch (e) {
            error.value = e instanceof Error ? e.message : '載入教材資源失敗';
            errorDetail.value = asApiError(e);
            resources.value = [];
        } finally {
            isLoading.value = false;
        }
    }

    return { resources, isLoading, error, errorDetail, fetchResources };
}

export function useCourseLearningTimes(cid: string) {
    const items = ref<CourseLearningTimeItem[]>([]);
    const isLoading = ref(false);
    const error = ref<string | null>(null);
    const errorDetail = ref<ApiError | null>(null);

    async function fetchLearningTimes(): Promise<void> {
        isLoading.value = true;
        error.value = null;
        errorDetail.value = null;

        try {
            items.value = await apiFetch<CourseLearningTimeItem[]>(
                `/api/courses/${encodeURIComponent(cid)}/learning-times`,
            );
        } catch (e) {
            error.value = e instanceof Error ? e.message : '載入學習時數失敗';
            errorDetail.value = asApiError(e);
        } finally {
            isLoading.value = false;
        }
    }

    return { items, isLoading, error, errorDetail, fetchLearningTimes };
}

export function useCourseHomeworks(cid: string) {
    const items = ref<CourseHomeworkItem[]>([]);
    const schoolPortalNotices = ref<SchoolPortalHomeworkNotice[]>([]);
    const isLoading = ref(false);
    const error = ref<string | null>(null);
    const errorDetail = ref<ApiError | null>(null);

    async function fetchHomeworks(): Promise<void> {
        isLoading.value = true;
        error.value = null;
        errorDetail.value = null;

        try {
            const data = await apiFetch<CourseHomeworkList>(
                `/api/courses/${encodeURIComponent(cid)}/homeworks`,
            );
            items.value = data.homeworkItems;
            schoolPortalNotices.value = data.schoolPortalNotices;
        } catch (e) {
            error.value = e instanceof Error ? e.message : '載入作業失敗';
            errorDetail.value = asApiError(e);
        } finally {
            isLoading.value = false;
        }
    }

    return {
        items,
        schoolPortalNotices,
        isLoading,
        error,
        errorDetail,
        fetchHomeworks,
    };
}

export function useCourseSelfExams(cid: string) {
    const items = ref<CourseSelfExamItem[]>([]);
    const isLoading = ref(false);
    const error = ref<string | null>(null);
    const errorDetail = ref<ApiError | null>(null);

    async function fetchSelfExams(): Promise<void> {
        isLoading.value = true;
        error.value = null;
        errorDetail.value = null;

        try {
            items.value = await apiFetch<CourseSelfExamItem[]>(
                `/api/courses/${encodeURIComponent(cid)}/self-exams`,
            );
        } catch (e) {
            error.value = e instanceof Error ? e.message : '載入自我練習失敗';
            errorDetail.value = asApiError(e);
        } finally {
            isLoading.value = false;
        }
    }

    return { items, isLoading, error, errorDetail, fetchSelfExams };
}

export function useCourseGrade(cid: string) {
    const grade = ref<SchoolPortalGrade | null>(null);
    const isLoading = ref(false);
    const error = ref<string | null>(null);
    const errorDetail = ref<ApiError | null>(null);

    async function fetchGrade(): Promise<void> {
        isLoading.value = true;
        error.value = null;
        errorDetail.value = null;

        try {
            const data = await apiFetch<{ grade: SchoolPortalGrade | null }>(
                `/api/courses/${encodeURIComponent(cid)}/grades`,
            );
            grade.value = data.grade;
        } catch (e) {
            error.value = e instanceof Error ? e.message : '載入成績失敗';
            errorDetail.value = asApiError(e);
            grade.value = null;
        } finally {
            isLoading.value = false;
        }
    }

    return { grade, isLoading, error, errorDetail, fetchGrade };
}

export function useCourseSchoolPortalInfo(cid: string) {
    const classSessionInfo =
        ref<CourseSchoolPortalInfo['classSessionInfo']>(null);
    const examInfo = ref<CourseSchoolPortalInfo['examInfo']>(null);
    const isLoading = ref(false);
    const error = ref<string | null>(null);
    const errorDetail = ref<ApiError | null>(null);

    async function fetchSchoolPortalInfo(): Promise<void> {
        isLoading.value = true;
        error.value = null;
        errorDetail.value = null;

        try {
            const data = await apiFetch<CourseSchoolPortalInfo>(
                `/api/courses/${encodeURIComponent(cid)}/school-portal-info`,
            );
            classSessionInfo.value = data.classSessionInfo;
            examInfo.value = data.examInfo;
        } catch (e) {
            error.value =
                e instanceof Error ? e.message : '載入教務系統課程資訊失敗';
            errorDetail.value = asApiError(e);
            classSessionInfo.value = null;
            examInfo.value = null;
        } finally {
            isLoading.value = false;
        }
    }

    return {
        classSessionInfo,
        examInfo,
        isLoading,
        error,
        errorDetail,
        fetchSchoolPortalInfo,
    };
}

export function useAllCourseGrades() {
    const grades = ref<SchoolPortalGrade[]>([]);
    const isLoading = ref(false);
    const error = ref<string | null>(null);
    const errorDetail = ref<ApiError | null>(null);

    async function fetchGrades(): Promise<void> {
        isLoading.value = true;
        error.value = null;
        errorDetail.value = null;

        try {
            const data = await apiFetch<{ grades: SchoolPortalGrade[] }>(
                '/api/grades',
            );
            grades.value = data.grades;
        } catch (e) {
            error.value = e instanceof Error ? e.message : '載入成績失敗';
            errorDetail.value = asApiError(e);
            grades.value = [];
        } finally {
            isLoading.value = false;
        }
    }

    return { grades, isLoading, error, errorDetail, fetchGrades };
}

export function useExamAgenda() {
    const items = ref<SchoolPortalExamAgendaItem[]>([]);
    const isLoading = ref(false);
    const error = ref<string | null>(null);
    const errorDetail = ref<ApiError | null>(null);

    async function fetchAgenda(): Promise<void> {
        isLoading.value = true;
        error.value = null;
        errorDetail.value = null;

        try {
            const data = await apiFetch<{
                items: SchoolPortalExamAgendaItem[];
            }>('/api/exam-agenda');
            items.value = data.items;
        } catch (e) {
            error.value = e instanceof Error ? e.message : '載入考試資訊失敗';
            errorDetail.value = asApiError(e);
            items.value = [];
        } finally {
            isLoading.value = false;
        }
    }

    return { items, isLoading, error, errorDetail, fetchAgenda };
}

export function useParsedContent() {
    const content = ref<ParsedContent | null>(null);
    const isLoading = ref(false);
    const error = ref<string | null>(null);
    const errorDetail = ref<ApiError | null>(null);

    async function fetchContent(cid: string, scoid: string): Promise<void> {
        isLoading.value = true;
        error.value = null;
        errorDetail.value = null;

        try {
            content.value = await apiFetch<ParsedContent>(
                `/api/courses/${encodeURIComponent(cid)}/nodes/${encodeURIComponent(scoid)}/content`,
            );
        } catch (e) {
            error.value = e instanceof Error ? e.message : '載入教材內容失敗';
            errorDetail.value = asApiError(e);
            content.value = null;
        } finally {
            isLoading.value = false;
        }
    }

    /**
     * Refetch the node content without toggling loading/error state or
     * clearing the current content, so a mounted viewer survives failures.
     */
    async function refreshContent(
        cid: string,
        scoid: string,
    ): Promise<boolean> {
        try {
            content.value = await apiFetch<ParsedContent>(
                `/api/courses/${encodeURIComponent(cid)}/nodes/${encodeURIComponent(scoid)}/content`,
            );

            return true;
        } catch {
            return false;
        }
    }

    async function fetchParsedContent(url: string): Promise<void> {
        isLoading.value = true;
        error.value = null;
        errorDetail.value = null;

        try {
            content.value = await apiFetch<ParsedContent>(
                `/materials/content/parsed?url=${encodeURIComponent(url)}`,
            );
        } catch (e) {
            error.value = e instanceof Error ? e.message : '載入教材內容失敗';
            errorDetail.value = asApiError(e);
            content.value = null;
        } finally {
            isLoading.value = false;
        }
    }

    return {
        content,
        isLoading,
        error,
        errorDetail,
        fetchContent,
        refreshContent,
        fetchParsedContent,
    };
}

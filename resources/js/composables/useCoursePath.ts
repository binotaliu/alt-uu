import { ref } from 'vue';
import type {
    CourseHomeworkItem,
    CourseLearningTimeItem,
    CoursePathData,
    CourseSelfExamItem,
    MaterialNode,
    MaterialResource,
    ParsedContent,
} from '@/types';
import { apiFetch } from './useApi';

export function useCoursePath(cid: string) {
    const materialNodes = ref<MaterialNode[]>([]);
    const isLoading = ref(false);
    const error = ref<string | null>(null);

    async function fetchPath(): Promise<void> {
        isLoading.value = true;
        error.value = null;

        try {
            const data = await apiFetch<CoursePathData>(
                `/api/courses/${encodeURIComponent(cid)}/path`,
            );
            materialNodes.value = data.materialNodes;
        } catch (e) {
            error.value = e instanceof Error ? e.message : '載入教材目錄失敗';
        } finally {
            isLoading.value = false;
        }
    }

    return { materialNodes, isLoading, error, fetchPath };
}

export function useNodeResources() {
    const resources = ref<MaterialResource[]>([]);
    const isLoading = ref(false);

    async function fetchResources(cid: string, scoid: string): Promise<void> {
        isLoading.value = true;

        try {
            resources.value = await apiFetch<MaterialResource[]>(
                `/api/courses/${encodeURIComponent(cid)}/nodes/${encodeURIComponent(scoid)}/resources`,
            );
        } catch {
            resources.value = [];
        } finally {
            isLoading.value = false;
        }
    }

    return { resources, isLoading, fetchResources };
}

export function useCourseLearningTimes(cid: string) {
    const items = ref<CourseLearningTimeItem[]>([]);
    const isLoading = ref(false);
    const error = ref<string | null>(null);

    async function fetchLearningTimes(): Promise<void> {
        isLoading.value = true;
        error.value = null;

        try {
            items.value = await apiFetch<CourseLearningTimeItem[]>(
                `/api/courses/${encodeURIComponent(cid)}/learning-times`,
            );
        } catch (e) {
            error.value = e instanceof Error ? e.message : '載入學習時數失敗';
        } finally {
            isLoading.value = false;
        }
    }

    return { items, isLoading, error, fetchLearningTimes };
}

export function useCourseHomeworks(cid: string) {
    const items = ref<CourseHomeworkItem[]>([]);
    const isLoading = ref(false);
    const error = ref<string | null>(null);

    async function fetchHomeworks(): Promise<void> {
        isLoading.value = true;
        error.value = null;

        try {
            items.value = await apiFetch<CourseHomeworkItem[]>(
                `/api/courses/${encodeURIComponent(cid)}/homeworks`,
            );
        } catch (e) {
            error.value = e instanceof Error ? e.message : '載入作業失敗';
        } finally {
            isLoading.value = false;
        }
    }

    return { items, isLoading, error, fetchHomeworks };
}

export function useCourseSelfExams(cid: string) {
    const items = ref<CourseSelfExamItem[]>([]);
    const isLoading = ref(false);
    const error = ref<string | null>(null);

    async function fetchSelfExams(): Promise<void> {
        isLoading.value = true;
        error.value = null;

        try {
            items.value = await apiFetch<CourseSelfExamItem[]>(
                `/api/courses/${encodeURIComponent(cid)}/self-exams`,
            );
        } catch (e) {
            error.value = e instanceof Error ? e.message : '載入自我練習失敗';
        } finally {
            isLoading.value = false;
        }
    }

    return { items, isLoading, error, fetchSelfExams };
}

export function useParsedContent() {
    const content = ref<ParsedContent | null>(null);
    const isLoading = ref(false);

    async function fetchContent(cid: string, scoid: string): Promise<void> {
        isLoading.value = true;

        try {
            content.value = await apiFetch<ParsedContent>(
                `/api/courses/${encodeURIComponent(cid)}/nodes/${encodeURIComponent(scoid)}/content`,
            );
        } catch {
            content.value = null;
        } finally {
            isLoading.value = false;
        }
    }

    async function fetchParsedContent(url: string): Promise<void> {
        isLoading.value = true;

        try {
            content.value = await apiFetch<ParsedContent>(
                `/materials/content/parsed?url=${encodeURIComponent(url)}`,
            );
        } catch {
            content.value = null;
        } finally {
            isLoading.value = false;
        }
    }

    return { content, isLoading, fetchContent, fetchParsedContent };
}

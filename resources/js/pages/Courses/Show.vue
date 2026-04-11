<script setup lang="ts">
import {
    FolderIcon,
    ChatBubbleLeftRightIcon,
    ClipboardDocumentListIcon,
} from '@heroicons/vue/24/outline';
import { onBeforeUnmount, onMounted, ref, computed, watch } from 'vue';
import AndroidBottomControlBackground from '@/components/AndroidBottomControlBackground.vue';
import AppLayout from '@/components/AppLayout.vue';
import BackButton from '@/components/BackButton.vue';
import CourseDiscussTab from '@/components/CourseDiscussTab.vue';
import CourseHomeworkTab from '@/components/CourseHomeworkTab.vue';
import CourseInfoTab from '@/components/CourseInfoTab.vue';
import CourseMaterialsTab from '@/components/CourseMaterialsTab.vue';
import CourseSelfExamTab from '@/components/CourseSelfExamTab.vue';
import PageHeader from '@/components/PageHeader.vue';
import { apiFetch } from '@/composables/useApi';
import { useCourseSelfExams } from '@/composables/useCoursePath';
import {
    useCourseHomeworks,
    useCourseLearningTimes,
} from '@/composables/useCoursePath';
import { useCourses } from '@/composables/useCourses';
import { useDiscuss } from '@/composables/useDiscuss';
import { useNouToolsCourseInfo } from '@/composables/useNouTools';
import { useTitle } from '@/composables/useTitle';
import { useAppConfigStore } from '@/stores/appConfig';
import type {
    CourseItem,
    CourseTasksCount,
    DiscussBoardSection,
} from '@/types';

const props = defineProps<{
    cid: string;
    tab?: 'materials' | 'discuss' | 'homework' | 'study-time' | 'course-info';
}>();
const configStore = useAppConfigStore();
const nouToolsEnabled = computed(() =>
    Boolean(configStore.nouToolsIntegrationEnabled),
);
const {
    course: nouToolsCourse,
    isLoading: isNouToolsCourseLoading,
    error: nouToolsCourseError,
    fetchCourseInfo: fetchNouToolsCourseInfo,
} = useNouToolsCourseInfo(props.cid);

const { courses, isLoading: isCoursesLoading, fetchCourses } = useCourses();
const {
    items: learningTimeItems,
    isLoading: isLearningTimesLoading,
    error: learningTimesError,
    fetchLearningTimes,
} = useCourseLearningTimes(props.cid);
const {
    items: homeworkItems,
    isLoading: isHomeworkLoading,
    error: homeworkError,
    fetchHomeworks,
} = useCourseHomeworks(props.cid);
const {
    items: selfExamItems,
    isLoading: isSelfExamLoading,
    error: selfExamError,
    fetchSelfExams,
} = useCourseSelfExams(props.cid);

const tasksCount = ref<Record<string, CourseTasksCount>>({});
const tasksLoading = ref(false);
const tasksError = ref<string | null>(null);

function getCourseTaskCount(courseId: string): CourseTasksCount {
    return (
        tasksCount.value[courseId] ?? {
            courseId,
            pendingHomeworks: 0,
            unreadArticles: 0,
        }
    );
}

const courseTasks = computed<CourseTasksCount>(() => {
    const primary = getCourseTaskCount(props.cid);
    const commonCourseId = selectedCourse.value?.commonCourseId;

    const common = commonCourseId
        ? getCourseTaskCount(commonCourseId)
        : {
              courseId: props.cid,
              pendingHomeworks: 0,
              unreadArticles: 0,
          };

    return {
        courseId: props.cid,
        pendingHomeworks: primary.pendingHomeworks + common.pendingHomeworks,
        unreadArticles: primary.unreadArticles + common.unreadArticles,
    };
});

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

const {
    data: currentDiscussData,
    isLoading: isCurrentBoardsLoading,
    error: currentDiscussError,
    fetchDiscuss: fetchCurrentDiscuss,
} = useDiscuss();
const {
    data: commonDiscussData,
    isLoading: isCommonBoardsLoading,
    error: commonDiscussError,
    fetchDiscuss: fetchCommonDiscuss,
} = useDiscuss();

function resolveTab(
    hash: string | undefined,
    tab: string | undefined,
): 'materials' | 'discuss' | 'homework' | 'self-exam' | 'course-info' {
    const normalizedHash = (hash || '').replace(/^#/, '');

    if (
        normalizedHash === 'materials' ||
        normalizedHash === 'discuss' ||
        normalizedHash === 'homework' ||
        normalizedHash === 'self-exam' ||
        normalizedHash === 'course-info'
    ) {
        return normalizedHash;
    }

    if (
        tab === 'discuss' ||
        tab === 'homework' ||
        tab === 'self-exam' ||
        tab === 'course-info'
    ) {
        return tab;
    }

    return 'materials';
}

const activeTab = ref<
    'materials' | 'discuss' | 'homework' | 'self-exam' | 'course-info'
>(
    resolveTab(
        typeof window !== 'undefined' ? window.location.hash : undefined,
        props.tab,
    ),
);
const hasLargeMaterialDirectory = ref(false);
const shouldRefreshHomeworksOnReturn = ref(false);
const shouldRefreshSelfExamsOnReturn = ref(false);

const selectedCourse = computed<CourseItem | null>(
    () => courses.value.find((c) => c.courseId === props.cid) ?? null,
);

const courseTitle = computed(
    () => selectedCourse.value?.name || `課程 ${props.cid}`,
);

const currentBoardTitle = computed(
    () => selectedCourse.value?.className?.trim() || `課程 ${props.cid}`,
);

const boardSections = computed<DiscussBoardSection[]>(() => {
    const sections: DiscussBoardSection[] = [];

    sections.push({
        courseId: props.cid,
        title: currentBoardTitle.value,
        boards: currentDiscussData.value?.boards ?? [],
    });

    if (selectedCourse.value?.commonCourseId) {
        sections.push({
            courseId: selectedCourse.value.commonCourseId,
            title: '共用版',
            boards: commonDiscussData.value?.boards ?? [],
        });
    }

    return sections;
});

const boardLoadError = computed(
    () => currentDiscussError.value ?? commonDiscussError.value,
);
const isBoardsLoading = computed(
    () => isCurrentBoardsLoading.value || isCommonBoardsLoading.value,
);

const pageTitle = computed(() => {
    if (activeTab.value === 'discuss') {
        return '討論板';
    }

    if (activeTab.value === 'homework') {
        return '作業';
    }

    if (activeTab.value === 'self-exam') {
        return '自我練習';
    }

    if (activeTab.value === 'course-info') {
        return '課程資訊';
    }

    return '教材目錄';
});

useTitle(pageTitle);

async function loadBoardSections(): Promise<void> {
    await fetchCurrentDiscuss(props.cid, undefined, undefined, {
        includeCourses: false,
    });

    if (selectedCourse.value?.commonCourseId) {
        await fetchCommonDiscuss(
            selectedCourse.value.commonCourseId,
            undefined,
            undefined,
            { includeCourses: false },
        );
    }
}

async function loadHomeworks(): Promise<void> {
    await fetchHomeworks();
}

async function loadSelfExams(): Promise<void> {
    await fetchSelfExams();
}

async function refreshHomeworksIfNeeded(): Promise<void> {
    if (
        !shouldRefreshHomeworksOnReturn.value ||
        activeTab.value !== 'homework'
    ) {
        return;
    }

    shouldRefreshHomeworksOnReturn.value = false;
    await loadHomeworks();
}

function handleHomeworkBrowserOpened(): void {
    shouldRefreshHomeworksOnReturn.value = true;
}

async function refreshSelfExamsIfNeeded(): Promise<void> {
    if (
        !shouldRefreshSelfExamsOnReturn.value ||
        activeTab.value !== 'self-exam'
    ) {
        return;
    }

    shouldRefreshSelfExamsOnReturn.value = false;
    await loadSelfExams();
}

function handleWindowFocus(): void {
    void refreshHomeworksIfNeeded();
    void refreshSelfExamsIfNeeded();
}

function handleVisibilityChange(): void {
    if (document.visibilityState === 'visible') {
        void refreshHomeworksIfNeeded();
        void refreshSelfExamsIfNeeded();
    }
}

function handleHashChange(): void {
    const hash = window.location.hash.replace(/^#/, '');

    if (
        hash === 'materials' ||
        hash === 'discuss' ||
        hash === 'homework' ||
        hash === 'self-exam' ||
        hash === 'course-info'
    ) {
        activeTab.value = hash;
    }
}

onMounted(async () => {
    await configStore.loadConfig();
    await Promise.all([
        fetchCourses(),
        fetchLearningTimes(),
        fetchTasksCount(),
    ]);

    window.addEventListener('focus', handleWindowFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('hashchange', handleHashChange);

    handleHashChange();
});

onBeforeUnmount(() => {
    window.removeEventListener('focus', handleWindowFocus);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    window.removeEventListener('hashchange', handleHashChange);
});

watch(
    selectedCourse,
    async (course) => {
        if (!course) {
            return;
        }

        await loadBoardSections();
    },
    { immediate: true },
);

watch(
    activeTab,
    async (tab) => {
        if (tab !== 'homework') {
            return;
        }

        shouldRefreshHomeworksOnReturn.value = false;
        await loadHomeworks();
    },
    { immediate: true },
);

watch(
    activeTab,
    async (tab) => {
        if (tab !== 'course-info' || !nouToolsEnabled.value) {
            return;
        }

        await fetchNouToolsCourseInfo();
    },
    { immediate: true },
);

watch(
    activeTab,
    async (tab) => {
        if (tab !== 'self-exam') {
            return;
        }

        shouldRefreshSelfExamsOnReturn.value = false;
        await loadSelfExams();
    },
    { immediate: true },
);
</script>

<template>
    <AppLayout>
        <PageHeader
            :title="courseTitle"
            :isLoading="isCoursesLoading || !selectedCourse"
        >
            <template #left>
                <BackButton
                    href="/courses"
                    :view-transition="
                        !(
                            activeTab === 'materials' &&
                            hasLargeMaterialDirectory
                        )
                    "
                />
            </template>

            <template #below>
                <div
                    class="flex flex-wrap items-center text-sm text-warm-600"
                    v-if="selectedCourse"
                >
                    <span
                        v-if="selectedCourse.semester"
                        class="mr-2 rounded-full py-0.5 pr-2 font-medium text-warm-700 dark:text-zinc-300"
                    >
                        {{ selectedCourse.semester }}
                    </span>
                    <span
                        v-if="selectedCourse.courseType"
                        class="rounded-full bg-warm-100 px-2 py-0.5 font-medium text-warm-700 dark:bg-warm-900 dark:text-zinc-300"
                        :class="{
                            'rounded-r-none pr-1': selectedCourse.className,
                        }"
                    >
                        {{ selectedCourse.courseType }}
                    </span>
                    <span
                        v-if="selectedCourse.className"
                        class="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-600 dark:bg-zinc-700 dark:text-zinc-300"
                        :class="{
                            'rounded-l-none pl-1': selectedCourse.courseType,
                        }"
                    >
                        {{ selectedCourse.className }}
                    </span>
                    <span
                        v-if="
                            !selectedCourse.semester &&
                            !selectedCourse.className &&
                            !selectedCourse.courseType
                        "
                        class="h-5"
                    />
                </div>
            </template>
        </PageHeader>

        <section class="px-3 py-4 pb-24 sm:px-4">
            <div class="mb-4 md:hidden">
                <!-- -mx-3 推到螢幕邊界，-my-2 讓 shadow 可見 -->
                <div
                    class="scrollbar-hidden -mx-3 -my-2 overflow-x-auto px-3 py-2 text-center whitespace-nowrap"
                >
                    <div
                        class="inline-flex min-w-max rounded-2xl border border-warm-200 bg-white/90 p-1 shadow-sm [view-transition-name:mobile-nav] dark:border-zinc-700 dark:bg-zinc-900/90"
                    >
                        <button
                            type="button"
                            class="inline-flex min-w-24 shrink-0 justify-center rounded-xl px-4 py-2 text-sm font-medium transition"
                            :class="
                                activeTab === 'materials'
                                    ? 'bg-warm-800 text-white shadow-sm dark:bg-zinc-600'
                                    : 'text-warm-700 hover:bg-warm-50 dark:text-zinc-300 dark:hover:bg-zinc-800'
                            "
                            @click="activeTab = 'materials'"
                        >
                            教材
                        </button>
                        <button
                            type="button"
                            class="inline-flex min-w-24 shrink-0 justify-center rounded-xl px-4 py-2 text-sm font-medium transition"
                            :class="
                                activeTab === 'discuss'
                                    ? 'bg-warm-800 text-white shadow-sm dark:bg-zinc-600'
                                    : 'text-warm-700 hover:bg-warm-50 dark:text-zinc-300 dark:hover:bg-zinc-800'
                            "
                            @click="activeTab = 'discuss'"
                        >
                            討論
                            <span
                                v-if="courseTasks.unreadArticles > 0"
                                class="ml-2 inline-flex w-8 items-center justify-center rounded-full px-2 py-0.5 text-xs font-semibold"
                                :class="
                                    activeTab === 'discuss'
                                        ? 'bg-white text-warm-800 dark:bg-zinc-900 dark:text-white'
                                        : 'bg-warm-800 text-white dark:bg-zinc-600'
                                "
                            >
                                {{
                                    courseTasks.unreadArticles > 99
                                        ? '99+'
                                        : courseTasks.unreadArticles
                                }}
                            </span>
                        </button>
                        <button
                            type="button"
                            class="inline-flex min-w-24 shrink-0 justify-center rounded-xl px-4 py-2 text-sm font-medium transition"
                            :class="
                                activeTab === 'homework'
                                    ? 'bg-warm-800 text-white shadow-sm dark:bg-zinc-600'
                                    : 'text-warm-700 hover:bg-warm-50 dark:text-zinc-300 dark:hover:bg-zinc-800'
                            "
                            @click="activeTab = 'homework'"
                        >
                            作業
                            <span
                                v-if="courseTasks.pendingHomeworks > 0"
                                class="ml-2 inline-flex w-8 items-center justify-center rounded-full px-2 py-0.5 text-xs font-semibold"
                                :class="
                                    activeTab === 'homework'
                                        ? 'bg-white text-warm-800 dark:bg-zinc-900 dark:text-white'
                                        : 'bg-warm-800 text-white dark:bg-zinc-600'
                                "
                            >
                                {{
                                    courseTasks.pendingHomeworks > 99
                                        ? '99+'
                                        : courseTasks.pendingHomeworks
                                }}
                            </span>
                        </button>
                        <button
                            type="button"
                            class="inline-flex min-w-24 shrink-0 justify-center rounded-xl px-4 py-2 text-sm font-medium transition"
                            :class="
                                activeTab === 'self-exam'
                                    ? 'bg-warm-800 text-white shadow-sm dark:bg-zinc-600'
                                    : 'text-warm-700 hover:bg-warm-50 dark:text-zinc-300 dark:hover:bg-zinc-800'
                            "
                            @click="activeTab = 'self-exam'"
                        >
                            練習
                        </button>
                        <button
                            v-if="nouToolsEnabled"
                            type="button"
                            class="inline-flex min-w-24 shrink-0 justify-center rounded-xl px-4 py-2 text-sm font-medium transition"
                            :class="
                                activeTab === 'course-info'
                                    ? 'bg-warm-800 text-white shadow-sm dark:bg-zinc-600'
                                    : 'text-warm-700 hover:bg-warm-50 dark:text-zinc-300 dark:hover:bg-zinc-800'
                            "
                            @click="activeTab = 'course-info'"
                        >
                            課程資訊
                        </button>
                    </div>
                </div>
            </div>

            <div
                class="mx-auto flex w-full max-w-6xl flex-col gap-4 [view-transition-name:pad-nav] md:flex-row md:items-start"
            >
                <div class="hidden w-56 md:block">
                    <aside
                        class="fixed hidden w-56 flex-col gap-1 rounded-2xl border border-warm-200 bg-white/90 p-1 shadow-sm md:flex dark:border-zinc-700 dark:bg-zinc-900/90"
                    >
                        <button
                            type="button"
                            class="flex items-center gap-1 rounded-xl px-3 py-2 text-left font-medium transition"
                            :class="
                                activeTab === 'materials'
                                    ? 'bg-warm-800 text-white shadow dark:bg-zinc-600'
                                    : 'text-warm-700 hover:bg-warm-50 dark:text-zinc-300 dark:hover:bg-zinc-800'
                            "
                            @click="activeTab = 'materials'"
                        >
                            <FolderIcon class="size-4" />
                            教材目錄
                        </button>
                        <button
                            type="button"
                            class="flex items-center justify-between rounded-xl px-3 py-2 text-left font-medium transition"
                            :class="
                                activeTab === 'discuss'
                                    ? 'bg-warm-800 text-white shadow dark:bg-zinc-600'
                                    : 'text-warm-700 hover:bg-warm-50 dark:text-zinc-300 dark:hover:bg-zinc-800'
                            "
                            @click="activeTab = 'discuss'"
                        >
                            <span class="inline-flex items-center gap-1">
                                <ChatBubbleLeftRightIcon class="size-4" />
                                討論板
                            </span>
                            <span
                                v-if="courseTasks.unreadArticles > 0"
                                class="ml-2 inline-flex w-8 items-center justify-center rounded-full px-2 py-0.5 text-xs font-semibold"
                                :class="
                                    activeTab === 'discuss'
                                        ? 'bg-white text-warm-800 dark:bg-zinc-900 dark:text-white'
                                        : 'bg-warm-800 text-white dark:bg-zinc-600'
                                "
                            >
                                {{
                                    courseTasks.unreadArticles > 99
                                        ? '99+'
                                        : courseTasks.unreadArticles
                                }}
                            </span>
                        </button>
                        <button
                            type="button"
                            class="flex items-center justify-between rounded-xl px-3 py-2 text-left font-medium transition"
                            :class="
                                activeTab === 'homework'
                                    ? 'bg-warm-800 text-white shadow dark:bg-zinc-600'
                                    : 'text-warm-700 hover:bg-warm-50 dark:text-zinc-300 dark:hover:bg-zinc-800'
                            "
                            @click="activeTab = 'homework'"
                        >
                            <span class="inline-flex items-center gap-1">
                                <ClipboardDocumentListIcon class="size-4" />
                                作業
                            </span>
                            <span
                                v-if="courseTasks.pendingHomeworks > 0"
                                class="ml-2 inline-flex w-8 items-center justify-center rounded-full px-2 py-0.5 text-xs font-semibold"
                                :class="
                                    activeTab === 'homework'
                                        ? 'bg-white text-warm-800 dark:bg-zinc-900 dark:text-white'
                                        : 'bg-warm-800 text-white dark:bg-zinc-600'
                                "
                            >
                                {{
                                    courseTasks.pendingHomeworks > 99
                                        ? '99+'
                                        : courseTasks.pendingHomeworks
                                }}
                            </span>
                        </button>
                        <button
                            type="button"
                            class="flex items-center gap-1 rounded-xl px-3 py-2 text-left font-medium transition"
                            :class="
                                activeTab === 'self-exam'
                                    ? 'bg-warm-800 text-white shadow dark:bg-zinc-600'
                                    : 'text-warm-700 hover:bg-warm-50 dark:text-zinc-300 dark:hover:bg-zinc-800'
                            "
                            @click="activeTab = 'self-exam'"
                        >
                            <ClipboardDocumentListIcon class="size-4" />
                            自我練習
                        </button>
                        <button
                            v-if="nouToolsEnabled"
                            type="button"
                            class="flex items-center gap-1 rounded-xl px-3 py-2 text-left font-medium transition"
                            :class="
                                activeTab === 'course-info'
                                    ? 'bg-warm-800 text-white shadow dark:bg-zinc-600'
                                    : 'text-warm-700 hover:bg-warm-50 dark:text-zinc-300 dark:hover:bg-zinc-800'
                            "
                            @click="activeTab = 'course-info'"
                        >
                            <ClipboardDocumentListIcon class="size-4" />
                            課程資訊
                        </button>
                    </aside>
                </div>

                <main class="w-full md:flex-1">
                    <transition name="fade" mode="out-in">
                        <div :key="activeTab">
                            <CourseMaterialsTab
                                v-if="activeTab === 'materials'"
                                :cid="cid"
                                :learning-time-items="learningTimeItems"
                                :is-loading="isLearningTimesLoading"
                                :error="learningTimesError"
                                @large-directory="
                                    (hasLarge: boolean) =>
                                        (hasLargeMaterialDirectory = hasLarge)
                                "
                            />

                            <CourseDiscussTab
                                v-else-if="activeTab === 'discuss'"
                                :course-id="cid"
                                :board-sections="boardSections"
                                :board-load-error="boardLoadError"
                                :is-boards-loading="isBoardsLoading"
                            />

                            <CourseHomeworkTab
                                v-else-if="activeTab === 'homework'"
                                :items="homeworkItems"
                                :is-loading="isHomeworkLoading"
                                :error="homeworkError"
                                @opened-in-app-browser="
                                    handleHomeworkBrowserOpened
                                "
                            />

                            <CourseSelfExamTab
                                v-else-if="activeTab === 'self-exam'"
                                :items="selfExamItems"
                                :is-loading="isSelfExamLoading"
                                :error="selfExamError"
                            />

                            <CourseInfoTab
                                v-else-if="activeTab === 'course-info'"
                                :course="nouToolsCourse"
                                :is-loading="isNouToolsCourseLoading"
                                :error="nouToolsCourseError"
                            />
                        </div>
                    </transition>
                </main>
            </div>
        </section>

        <AndroidBottomControlBackground />
    </AppLayout>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
    transition: opacity 220ms ease;
}
.fade-enter-from,
.fade-leave-to {
    opacity: 0;
}
.fade-enter-to,
.fade-leave-from {
    opacity: 1;
}
</style>

<script setup lang="ts">
import {
    ClipboardDocumentListIcon,
    ChatBubbleLeftRightIcon,
} from '@heroicons/vue/24/outline';
import { computed } from 'vue';
import ErrorRetry from '@/components/ErrorRetry.vue';
import type { ApiError } from '@/lib/apiError';
import type { CourseItem, CourseTasksCount } from '@/types';

const props = defineProps<{
    courses: CourseItem[];
    tasksCount: Record<string, CourseTasksCount>;
    tasksLoading: boolean;
    tasksError: string | null;
    isLoading: boolean;
    hasFetched: boolean;
    error: string | null;
    errorDetail?: ApiError | null;
}>();

const emit = defineEmits<{
    retry: [];
}>();

const grouped = computed(() => {
    const groups: Record<string, CourseItem[]> = {};

    for (const course of props.courses) {
        const key = course.semester ? course.semester.trim() : '其他';

        if (!groups[key]) {
            groups[key] = [];
        }

        groups[key].push(course);
    }

    return groups;
});

function getCourseTasks(course: CourseItem): CourseTasksCount {
    const primary = props.tasksCount[course.courseId] ?? {
        courseId: course.courseId,
        pendingHomeworks: 0,
        unreadArticles: 0,
    };

    const common = course.commonCourseId
        ? (props.tasksCount[course.commonCourseId] ?? {
              courseId: course.commonCourseId,
              pendingHomeworks: 0,
              unreadArticles: 0,
          })
        : {
              courseId: course.courseId,
              pendingHomeworks: 0,
              unreadArticles: 0,
          };

    return {
        courseId: course.courseId,
        pendingHomeworks: primary.pendingHomeworks + common.pendingHomeworks,
        unreadArticles: primary.unreadArticles + common.unreadArticles,
    };
}
</script>

<template>
    <div v-if="props.isLoading || !props.hasFetched" class="space-y-6">
        <div v-for="g in 2" :key="g">
            <div
                class="mb-3 h-5 w-16 animate-pulse rounded bg-theme-200 md:h-6 dark:bg-zinc-700"
            />
            <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <div
                    v-for="c in 5"
                    :key="c"
                    class="rounded-xl border border-theme-200 bg-white px-4 py-3 dark:border-zinc-700 dark:bg-zinc-900"
                >
                    <div class="mb-2 flex gap-2">
                        <div
                            class="h-4 w-12 animate-pulse rounded-full bg-theme-200 dark:bg-zinc-700"
                        />
                        <div
                            class="h-4 w-16 animate-pulse rounded-full bg-theme-200 dark:bg-zinc-700"
                        />
                    </div>
                    <div
                        class="h-[2lh] w-3/4 animate-pulse rounded bg-theme-200 text-base md:text-lg dark:bg-zinc-700"
                    />
                </div>
            </div>
        </div>
    </div>

    <ErrorRetry
        v-else-if="props.error"
        :message="props.error"
        :retrying="props.isLoading"
        :detail="props.errorDetail"
        @retry="emit('retry')"
    />

    <div
        v-else-if="props.courses.length === 0"
        class="rounded-xl border border-dashed border-theme-300 bg-theme-50 px-5 py-12 text-center text-theme-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
    >
        您的帳號目前未有課程，期待下學期與您在課堂上見面
    </div>

    <div v-else class="space-y-6">
        <div v-for="(semesterCourses, semester) in grouped" :key="semester">
            <h3
                class="mb-3 text-sm font-semibold text-theme-700 md:text-base dark:text-zinc-300"
            >
                {{ semester }}
            </h3>
            <div class="grid gap-3 sm:grid-cols-2 md:gap-5 xl:grid-cols-3">
                <router-link
                    v-for="course in semesterCourses"
                    :key="course.courseId"
                    :to="`/courses/${course.courseId}`"
                    class="group flex flex-col gap-1 rounded-xl border border-theme-200 bg-white px-4 py-3 text-left transition hover:border-theme-500 hover:bg-theme-50 md:gap-2 md:px-8 md:py-6 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-zinc-500 dark:hover:bg-zinc-800"
                >
                    <div class="-ml-2 flex items-start justify-between gap-2">
                        <div
                            class="flex min-w-0 items-stretch text-xs text-theme-700 md:text-sm"
                        >
                            <span
                                v-if="course.courseType"
                                class="flex shrink-0 items-center rounded-full bg-theme-100 px-2 py-0.5 font-medium text-theme-800 dark:bg-theme-900 dark:text-zinc-300"
                                :class="{
                                    'rounded-r-none pr-1': course.className,
                                }"
                            >
                                {{ course.courseType }}
                            </span>
                            <span
                                v-if="course.className"
                                class="min-w-0 rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-600 dark:bg-zinc-700 dark:text-zinc-300"
                                :class="
                                    course.courseType
                                        ? 'rounded-l-none rounded-r-xl pl-1'
                                        : 'rounded-xl'
                                "
                            >
                                {{ course.className }}
                            </span>
                        </div>

                        <div
                            class="flex min-h-5 items-center gap-2 text-xs text-slate-500 md:min-h-6 dark:text-zinc-400"
                        >
                            <template
                                v-if="props.tasksError && !props.tasksLoading"
                            >
                                取得待辦失敗
                            </template>
                            <template v-else>
                                <span
                                    v-if="
                                        getCourseTasks(course)
                                            .pendingHomeworks > 0 ||
                                        props.tasksLoading
                                    "
                                    :class="[
                                        'inline-flex shrink-0 items-center gap-0.5 rounded-full border px-2 py-0.5 font-medium md:gap-1',
                                        props.tasksLoading
                                            ? 'invisible'
                                            : 'border-rose-700 text-rose-700 dark:border-red-400 dark:text-red-400',
                                    ]"
                                >
                                    <ClipboardDocumentListIcon
                                        class="size-3 md:size-4"
                                    />
                                    <span class="sr-only 2xl:not-sr-only"
                                        >未繳作業</span
                                    >
                                    <span v-if="!props.tasksLoading">
                                        {{
                                            getCourseTasks(course)
                                                .pendingHomeworks
                                        }}
                                    </span>
                                    <span v-else aria-hidden="true">　</span>
                                </span>

                                <span
                                    v-if="
                                        getCourseTasks(course).unreadArticles >
                                            0 || props.tasksLoading
                                    "
                                    :class="[
                                        'inline-flex shrink-0 items-center gap-0.5 rounded-full border px-2 py-0.5 font-medium md:gap-1',
                                        props.tasksLoading
                                            ? 'invisible'
                                            : 'border-yellow-800 text-yellow-800 dark:border-yellow-300 dark:text-yellow-300',
                                    ]"
                                >
                                    <ChatBubbleLeftRightIcon
                                        class="size-3 md:size-4"
                                    />
                                    <span class="sr-only 2xl:not-sr-only"
                                        >未讀文章</span
                                    >
                                    <span v-if="!props.tasksLoading">
                                        {{
                                            getCourseTasks(course)
                                                .unreadArticles > 99
                                                ? '99+'
                                                : getCourseTasks(course)
                                                      .unreadArticles
                                        }}
                                    </span>
                                    <span v-else aria-hidden="true">　</span>
                                </span>

                                <span
                                    v-if="
                                        !props.tasksLoading &&
                                        getCourseTasks(course)
                                            .pendingHomeworks === 0 &&
                                        getCourseTasks(course)
                                            .unreadArticles === 0
                                    "
                                    class="text-slate-600 dark:text-zinc-400"
                                >
                                    無待辦
                                </span>

                                <span
                                    v-else-if="props.tasksLoading"
                                    class="inline-block h-5 w-14 animate-pulse rounded bg-theme-200 dark:bg-zinc-700"
                                    aria-hidden="true"
                                ></span>
                            </template>
                        </div>
                    </div>

                    <p
                        class="line-clamp-2 block min-h-[2lh] text-base font-semibold text-theme-900 md:text-lg dark:text-zinc-100"
                    >
                        {{ course.name || `課程 ${course.courseId}` }}
                    </p>
                </router-link>
            </div>
        </div>
    </div>
</template>

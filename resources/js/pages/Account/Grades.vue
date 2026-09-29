<script setup lang="ts">
import { computed, onMounted } from 'vue';
import AppLayout from '@/components/AppLayout.vue';
import BackButton from '@/components/BackButton.vue';
import ErrorRetry from '@/components/ErrorRetry.vue';
import { useAllCourseGrades } from '@/composables/useCoursePath';
import { useTitle } from '@/composables/useTitle';
import type { SchoolPortalGrade } from '@/types';

useTitle('我的成績');

const { grades, isLoading, error, errorDetail, fetchGrades } =
    useAllCourseGrades();

onMounted(() => {
    fetchGrades();
});

interface SemesterGroup {
    semesterLabel: string;
    grades: SchoolPortalGrade[];
}

const semesterGroups = computed<SemesterGroup[]>(() => {
    const groups: SemesterGroup[] = [];

    for (const grade of grades.value) {
        const lastGroup = groups[groups.length - 1];

        if (lastGroup && lastGroup.semesterLabel === grade.semesterLabel) {
            lastGroup.grades.push(grade);
        } else {
            groups.push({
                semesterLabel: grade.semesterLabel,
                grades: [grade],
            });
        }
    }

    return groups;
});

function creditItems(
    grade: SchoolPortalGrade,
): { label: string; value: string }[] {
    return [{ label: '學分數', value: grade.credits }].filter(
        (item): item is { label: string; value: string } => item.value !== null,
    );
}

function detailItems(
    grade: SchoolPortalGrade,
): { label: string; value: string }[] {
    return [
        { label: '平時成績', value: grade.regularAverage },
        { label: '期中成績', value: grade.midtermScore },
        { label: '期末成績', value: grade.finalScore },
    ].filter(
        (item): item is { label: string; value: string } => item.value !== null,
    );
}

function isScorePassing(score: string | null): boolean {
    if (score === null) {
        return false;
    }

    const numericScore = parseInt(score, 10);

    return !isNaN(numericScore) && numericScore >= 60;
}
</script>

<template>
    <AppLayout>
        <div
            class="sticky top-0 z-200 w-full bg-theme-100 py-1.5 pt-(--inset-top,4rem) pr-(--inset-right,0px) pl-[max(var(--inset-left,0px),var(--corner-inset-left,0px),1rem)] dark:bg-zinc-950"
        >
            <div
                class="flex items-center justify-between gap-2 pt-0.5 text-theme-900 dark:text-zinc-100"
            >
                <div class="flex items-center gap-2">
                    <BackButton href="/courses/account" />

                    <h2 class="text-lg font-semibold">我的成績</h2>
                </div>
            </div>
        </div>

        <div
            class="mx-auto w-full max-w-2xl space-y-4 px-4 pb-[calc(var(--inset-bottom,0px)+2rem)]"
        >
            <div
                v-if="isLoading"
                class="rounded-xl border border-theme-200 bg-white p-4 text-center text-sm text-theme-700 shadow-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400"
            >
                載入成績中…
            </div>

            <ErrorRetry
                v-else-if="error"
                :message="error"
                :detail="errorDetail"
                @retry="fetchGrades"
            />

            <div
                v-else-if="semesterGroups.length === 0"
                class="rounded-xl border border-dashed border-theme-300 bg-theme-50 p-4 text-center text-sm text-theme-700 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
            >
                查無成績資料。
            </div>

            <div
                v-for="group in semesterGroups"
                :key="group.semesterLabel"
                class="space-y-2"
            >
                <h3
                    class="px-1 text-sm font-semibold text-theme-700 dark:text-zinc-400"
                >
                    {{ group.semesterLabel }}
                </h3>

                <dl
                    v-for="(grade, index) in group.grades"
                    :key="`${group.semesterLabel}-${index}`"
                    class="rounded-xl border border-theme-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
                >
                    <div class="flex items-center justify-between gap-3">
                        <div class="flex min-w-0 flex-1 flex-col">
                            <dt class="sr-only">課程</dt>
                            <dd>
                                <p
                                    class="text-base font-medium wrap-break-word text-theme-900 dark:text-zinc-100"
                                >
                                    {{ grade.courseName }}
                                </p>
                            </dd>
                            <div
                                v-if="creditItems(grade).length > 0"
                                class="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-theme-700 dark:text-zinc-400"
                            >
                                <div
                                    v-for="item in creditItems(grade)"
                                    :key="item.label"
                                    class="flex items-center gap-1"
                                >
                                    <dt>{{ item.label }}</dt>
                                    <dd
                                        class="font-medium text-theme-900 dark:text-zinc-200"
                                    >
                                        {{ item.value }}
                                    </dd>
                                </div>
                            </div>
                            <div
                                v-if="detailItems(grade).length > 0"
                                class="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-theme-700 dark:text-zinc-400"
                            >
                                <div
                                    v-for="item in detailItems(grade)"
                                    :key="item.label"
                                    class="flex items-center gap-1"
                                >
                                    <dt>{{ item.label }}</dt>
                                    <dd
                                        class="font-medium text-theme-900 dark:text-zinc-200"
                                    >
                                        {{ item.value }}
                                    </dd>
                                </div>
                            </div>
                        </div>
                        <div class="shrink-0">
                            <dt class="sr-only">學期成績</dt>
                            <dd>
                                <span
                                    v-if="
                                        grade.semesterGrade === null ||
                                        grade.semesterGrade === ''
                                    "
                                    class="shrink-0 rounded bg-theme-100 px-2.5 py-1 text-lg font-semibold text-theme-700 dark:bg-zinc-800 dark:text-zinc-400"
                                    >—</span
                                >
                                <span
                                    v-else-if="
                                        isScorePassing(grade.semesterGrade)
                                    "
                                    class="shrink-0 rounded bg-emerald-100 px-2.5 py-1 text-lg font-semibold text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200"
                                >
                                    {{ grade.semesterGrade }}
                                </span>
                                <span
                                    v-else
                                    class="shrink-0 rounded bg-red-100 px-2.5 py-1 text-lg font-semibold text-red-800 dark:bg-red-900/50 dark:text-red-200"
                                >
                                    {{ grade.semesterGrade }}
                                </span>
                            </dd>
                        </div>
                    </div>
                </dl>
            </div>
        </div>
    </AppLayout>
</template>

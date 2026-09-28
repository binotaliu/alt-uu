<script setup lang="ts">
import { computed } from 'vue';
import { Browser } from '#nativephp';
import ErrorRetry from '@/components/ErrorRetry.vue';
import type { ApiError } from '@/lib/apiError';
import {
    formatSchoolPortalClassDates,
    formatSchoolPortalTimeRange,
} from '@/lib/schoolPortalFormat';
import type {
    NouToolsCourseInfo,
    NouToolsPreviousExam,
    SchoolPortalClassSessionInfo,
    SchoolPortalExamInfo,
} from '@/types';

const props = defineProps<{
    course: NouToolsCourseInfo | null;
    isLoading: boolean;
    error: string | null;
    errorDetail?: ApiError | null;
    nouToolsEnabled: boolean;
    classSessionInfo: SchoolPortalClassSessionInfo | null;
    examInfo: SchoolPortalExamInfo | null;
    isSchoolPortalLoading: boolean;
    schoolPortalError: string | null;
    schoolPortalErrorDetail?: ApiError | null;
}>();

const emit = defineEmits<{
    retry: [];
}>();

const hasSchoolPortalInfo = computed(
    () =>
        Boolean(props.classSessionInfo) ||
        Boolean(
            props.examInfo &&
            (props.examInfo.schedules.length > 0 ||
                props.examInfo.scopes.length > 0),
        ),
);

function formatExamTime(
    start: string | null,
    end: string | null,
): string | null {
    if (!start && !end) {
        return null;
    }

    if (start && end) {
        return `${start} - ${end}`;
    }

    return start ?? end;
}

function examLinks(
    exam: NouToolsPreviousExam,
): Array<{ key: string; label: string; href: string }> {
    const links: Array<{ key: string; label: string; href: string }> = [];

    if (exam.midtermReferencePrimary) {
        links.push({
            key: 'midterm-a',
            label: '期中正參',
            href: exam.midtermReferencePrimary,
        });
    }

    if (exam.midtermReferenceSecondary) {
        links.push({
            key: 'midterm-b',
            label: '期中副參',
            href: exam.midtermReferenceSecondary,
        });
    }

    if (exam.finalReferencePrimary) {
        links.push({
            key: 'final-a',
            label: '期末正參',
            href: exam.finalReferencePrimary,
        });
    }

    if (exam.finalReferenceSecondary) {
        links.push({
            key: 'final-b',
            label: '期末副參',
            href: exam.finalReferenceSecondary,
        });
    }

    return links;
}

const handleClick = (url: string): void => {
    try {
        Browser.inApp(url);
    } catch {
        window.open(url, '_blank', 'noopener');
    }
};
</script>

<template>
    <div class="space-y-4">
        <div
            v-if="isLoading || isSchoolPortalLoading"
            class="rounded-xl border border-theme-200 bg-white p-4 text-sm text-theme-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
        >
            載入課程資訊中...
        </div>

        <ErrorRetry
            v-else-if="nouToolsEnabled && error"
            :message="error"
            :retrying="isLoading"
            :detail="errorDetail"
            @retry="emit('retry')"
        />

        <template v-else>
            <div
                v-if="!nouToolsEnabled"
                class="rounded-xl border border-dashed border-theme-300 bg-theme-50 p-4 text-sm text-theme-700 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-300"
            >
                開啟「NOU
                小幫手整合」可以檢視更完整的課程資訊，請至「設定」頁面開啟。
            </div>

            <template v-if="course">
                <section
                    class="rounded-xl border border-theme-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
                >
                    <h3
                        class="text-sm font-semibold text-theme-900 dark:text-zinc-100"
                    >
                        基本資訊
                    </h3>
                    <dl
                        class="mt-3 grid grid-cols-1 gap-3 text-sm md:grid-cols-2"
                    >
                        <div>
                            <dt class="text-theme-700 dark:text-zinc-400">
                                學分型態
                            </dt>
                            <dd
                                class="font-medium text-theme-800 dark:text-zinc-200"
                            >
                                {{ course.creditType || '未提供' }}
                            </dd>
                        </div>
                        <div>
                            <dt class="text-theme-700 dark:text-zinc-400">
                                學分數
                            </dt>
                            <dd
                                class="font-medium text-theme-800 dark:text-zinc-200"
                            >
                                {{ course.credits ?? '未提供' }}
                            </dd>
                        </div>
                        <div>
                            <dt class="text-theme-700 dark:text-zinc-400">
                                開設學系
                            </dt>
                            <dd
                                class="font-medium text-theme-800 dark:text-zinc-200"
                            >
                                {{ course.department || '未提供' }}
                            </dd>
                        </div>
                        <div>
                            <dt class="text-theme-700 dark:text-zinc-400">
                                課程性質
                            </dt>
                            <dd
                                class="font-medium text-theme-800 dark:text-zinc-200"
                            >
                                {{ course.nature || '未提供' }}
                            </dd>
                        </div>
                        <div>
                            <dt class="text-theme-700 dark:text-zinc-400">
                                期中考日期
                            </dt>
                            <dd
                                class="font-medium text-theme-800 dark:text-zinc-200"
                            >
                                {{ course.midtermDate || '未提供' }}
                            </dd>
                        </div>
                        <div>
                            <dt class="text-theme-700 dark:text-zinc-400">
                                期末考日期
                            </dt>
                            <dd
                                class="font-medium text-theme-800 dark:text-zinc-200"
                            >
                                {{ course.finalDate || '未提供' }}
                            </dd>
                        </div>
                        <div class="md:col-span-2">
                            <dt class="text-theme-700 dark:text-zinc-400">
                                考試時間
                            </dt>
                            <dd
                                class="font-medium text-theme-800 dark:text-zinc-200"
                            >
                                {{
                                    formatExamTime(
                                        course.examTimeStart,
                                        course.examTimeEnd,
                                    ) || '未提供'
                                }}
                            </dd>
                        </div>
                    </dl>
                </section>

                <section
                    v-if="course.textbook"
                    class="rounded-xl border border-theme-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
                >
                    <h3
                        class="text-sm font-semibold text-theme-900 dark:text-zinc-100"
                    >
                        教材資訊
                    </h3>
                    <div
                        class="mt-3 space-y-2 text-sm text-theme-800 dark:text-zinc-200"
                    >
                        <p class="font-medium">
                            {{ course.textbook.bookTitle }}
                        </p>
                        <p v-if="course.textbook.edition">
                            版本：{{ course.textbook.edition }}
                        </p>
                        <p v-if="course.textbook.priceInfo">
                            價格：{{ course.textbook.priceInfo }}
                        </p>
                        <a
                            v-if="course.textbook.referenceUrl"
                            :href="course.textbook.referenceUrl"
                            target="_blank"
                            rel="noopener noreferrer"
                            class="inline-flex rounded-lg border border-theme-300 px-3 py-1.5 text-sm font-medium text-theme-700 transition hover:bg-theme-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
                        >
                            參考連結
                        </a>
                    </div>
                </section>

                <section
                    class="rounded-xl border border-theme-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
                >
                    <h3
                        class="text-sm font-semibold text-theme-900 dark:text-zinc-100"
                    >
                        考古題
                    </h3>

                    <div
                        v-if="course.previousExams.length === 0"
                        class="mt-3 text-sm text-theme-700 dark:text-zinc-400"
                    >
                        尚無可用考古題。
                    </div>

                    <div v-else class="mt-3 space-y-3">
                        <article
                            v-for="exam in course.previousExams"
                            :key="exam.term"
                            class="rounded-lg border border-theme-200 p-3 dark:border-zinc-700"
                        >
                            <h4
                                class="text-sm font-semibold text-theme-800 dark:text-zinc-200"
                            >
                                {{ exam.term }}
                            </h4>
                            <div class="mt-2 flex flex-wrap gap-2">
                                <a
                                    v-for="link in examLinks(exam)"
                                    :key="`${exam.term}-${link.key}`"
                                    :href="`https://noustud.nou.edu.tw/shared_tmp/work/exa/refans/${link.href}`"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    class="inline-flex rounded-lg border border-theme-300 px-2.5 py-1 text-xs font-medium text-theme-700 transition hover:bg-theme-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
                                    @click.prevent="
                                        handleClick(
                                            `https://noustud.nou.edu.tw/shared_tmp/work/exa/refans/${link.href}`,
                                        )
                                    "
                                >
                                    {{ link.label }}
                                </a>
                            </div>
                        </article>
                    </div>
                </section>
            </template>

            <section
                v-if="classSessionInfo"
                class="rounded-xl border border-theme-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
            >
                <h3
                    class="text-sm font-semibold text-theme-900 dark:text-zinc-100"
                >
                    上課資訊
                </h3>
                <dl class="mt-3 grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
                    <div v-if="classSessionInfo.teacher">
                        <dt class="text-theme-700 dark:text-zinc-400">
                            授課教師
                        </dt>
                        <dd
                            class="font-medium text-theme-800 dark:text-zinc-200"
                        >
                            {{ classSessionInfo.teacher }}
                        </dd>
                    </div>
                    <div v-if="classSessionInfo.classType">
                        <dt class="text-theme-700 dark:text-zinc-400">
                            班級類型
                        </dt>
                        <dd
                            class="font-medium text-theme-800 dark:text-zinc-200"
                        >
                            {{ classSessionInfo.classType }}
                        </dd>
                    </div>
                    <div v-if="classSessionInfo.classTime">
                        <dt class="text-theme-700 dark:text-zinc-400">
                            上課時間
                        </dt>
                        <dd
                            class="font-medium text-theme-800 dark:text-zinc-200"
                        >
                            {{
                                formatSchoolPortalTimeRange(
                                    classSessionInfo.classTime,
                                )
                            }}
                        </dd>
                    </div>
                    <div v-if="classSessionInfo.classCode">
                        <dt class="text-theme-700 dark:text-zinc-400">
                            授課班級代碼
                        </dt>
                        <dd
                            class="font-medium text-theme-800 dark:text-zinc-200"
                        >
                            {{ classSessionInfo.classCode }}
                        </dd>
                    </div>
                    <div
                        v-if="classSessionInfo.classDates"
                        class="md:col-span-2"
                    >
                        <dt class="text-theme-700 dark:text-zinc-400">
                            授課日期
                        </dt>
                        <dd
                            class="font-medium text-theme-800 dark:text-zinc-200"
                        >
                            <ul class="space-y-0.5">
                                <li
                                    v-for="(
                                        entry, index
                                    ) in formatSchoolPortalClassDates(
                                        classSessionInfo.classDates,
                                    )"
                                    :key="index"
                                >
                                    {{ entry }}
                                </li>
                            </ul>
                        </dd>
                    </div>
                </dl>
            </section>

            <section
                v-if="examInfo && examInfo.schedules.length > 0"
                class="rounded-xl border border-theme-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
            >
                <h3
                    class="text-sm font-semibold text-theme-900 dark:text-zinc-100"
                >
                    考試時間
                </h3>
                <div class="mt-3 space-y-3">
                    <div
                        v-for="schedule in examInfo.schedules"
                        :key="schedule.category"
                        class="rounded-lg border border-theme-200 p-3 text-sm dark:border-zinc-700"
                    >
                        <p
                            class="font-semibold text-theme-800 dark:text-zinc-200"
                        >
                            {{ schedule.category }}
                        </p>
                        <dl
                            class="mt-1 space-y-1 text-theme-700 dark:text-zinc-300"
                        >
                            <div v-if="schedule.date">
                                日期：{{ schedule.date }}
                            </div>
                            <div v-if="schedule.time">
                                時間：{{
                                    formatSchoolPortalTimeRange(schedule.time)
                                }}
                            </div>
                            <div v-if="schedule.room">
                                教室代號：{{ schedule.room }}
                            </div>
                            <div v-if="schedule.note">
                                {{ schedule.note }}
                            </div>
                        </dl>
                    </div>
                </div>
            </section>

            <section
                v-if="examInfo && examInfo.scopes.length > 0"
                class="rounded-xl border border-theme-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
            >
                <h3
                    class="text-sm font-semibold text-theme-900 dark:text-zinc-100"
                >
                    考試命題範圍
                </h3>
                <div class="mt-3 space-y-3">
                    <div
                        v-for="scope in examInfo.scopes"
                        :key="scope.category"
                        class="rounded-lg border border-theme-200 p-3 text-sm dark:border-zinc-700"
                    >
                        <p
                            class="font-semibold text-theme-800 dark:text-zinc-200"
                        >
                            {{ scope.category }}
                        </p>
                        <p class="mt-1 text-theme-700 dark:text-zinc-300">
                            {{ scope.scope }}
                        </p>
                    </div>
                </div>
            </section>

            <div
                v-if="!course && !hasSchoolPortalInfo"
                class="rounded-xl border border-dashed border-theme-300 bg-theme-50 p-4 text-sm text-theme-700 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-300"
            >
                NOU 小幫手與教務系統目前都沒有這門課的可用資訊。
            </div>
        </template>
    </div>
</template>

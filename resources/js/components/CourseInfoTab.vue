<script setup lang="ts">
import { Browser } from '#nativephp';
import type { NouToolsCourseInfo, NouToolsPreviousExam } from '@/types';

defineProps<{
    course: NouToolsCourseInfo | null;
    isLoading: boolean;
    error: string | null;
}>();

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
            v-if="isLoading"
            class="rounded-xl border border-warm-200 bg-white p-4 text-sm text-warm-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
        >
            載入課程資訊中...
        </div>

        <div
            v-else-if="error"
            class="rounded-xl border border-rose-300 bg-rose-50 p-4 text-sm text-rose-700"
        >
            {{ error }}
        </div>

        <div
            v-else-if="!course"
            class="rounded-xl border border-dashed border-warm-300 bg-warm-50 p-4 text-sm text-warm-700 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-300"
        >
            NOU 小幫手目前沒有這門課的可用資訊。
        </div>

        <template v-else>
            <section
                class="rounded-xl border border-warm-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
            >
                <h3
                    class="text-sm font-semibold text-warm-900 dark:text-zinc-100"
                >
                    基本資訊
                </h3>
                <dl class="mt-3 grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
                    <div>
                        <dt class="text-warm-500 dark:text-zinc-400">
                            學分型態
                        </dt>
                        <dd
                            class="font-medium text-warm-800 dark:text-zinc-200"
                        >
                            {{ course.creditType || '未提供' }}
                        </dd>
                    </div>
                    <div>
                        <dt class="text-warm-500 dark:text-zinc-400">學分數</dt>
                        <dd
                            class="font-medium text-warm-800 dark:text-zinc-200"
                        >
                            {{ course.credits ?? '未提供' }}
                        </dd>
                    </div>
                    <div>
                        <dt class="text-warm-500 dark:text-zinc-400">
                            開設學系
                        </dt>
                        <dd
                            class="font-medium text-warm-800 dark:text-zinc-200"
                        >
                            {{ course.department || '未提供' }}
                        </dd>
                    </div>
                    <div>
                        <dt class="text-warm-500 dark:text-zinc-400">
                            課程性質
                        </dt>
                        <dd
                            class="font-medium text-warm-800 dark:text-zinc-200"
                        >
                            {{ course.nature || '未提供' }}
                        </dd>
                    </div>
                    <div>
                        <dt class="text-warm-500 dark:text-zinc-400">
                            期中考日期
                        </dt>
                        <dd
                            class="font-medium text-warm-800 dark:text-zinc-200"
                        >
                            {{ course.midtermDate || '未提供' }}
                        </dd>
                    </div>
                    <div>
                        <dt class="text-warm-500 dark:text-zinc-400">
                            期末考日期
                        </dt>
                        <dd
                            class="font-medium text-warm-800 dark:text-zinc-200"
                        >
                            {{ course.finalDate || '未提供' }}
                        </dd>
                    </div>
                    <div class="md:col-span-2">
                        <dt class="text-warm-500 dark:text-zinc-400">
                            考試時間
                        </dt>
                        <dd
                            class="font-medium text-warm-800 dark:text-zinc-200"
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
                class="rounded-xl border border-warm-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
            >
                <h3
                    class="text-sm font-semibold text-warm-900 dark:text-zinc-100"
                >
                    教材資訊
                </h3>
                <div
                    class="mt-3 space-y-2 text-sm text-warm-800 dark:text-zinc-200"
                >
                    <p class="font-medium">{{ course.textbook.bookTitle }}</p>
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
                        class="inline-flex rounded-lg border border-warm-300 px-3 py-1.5 text-sm font-medium text-warm-700 transition hover:bg-warm-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
                    >
                        參考連結
                    </a>
                </div>
            </section>

            <section
                class="rounded-xl border border-warm-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
            >
                <h3
                    class="text-sm font-semibold text-warm-900 dark:text-zinc-100"
                >
                    考古題
                </h3>

                <div
                    v-if="course.previousExams.length === 0"
                    class="mt-3 text-sm text-warm-600 dark:text-zinc-400"
                >
                    尚無可用考古題。
                </div>

                <div v-else class="mt-3 space-y-3">
                    <article
                        v-for="exam in course.previousExams"
                        :key="exam.term"
                        class="rounded-lg border border-warm-200 p-3 dark:border-zinc-700"
                    >
                        <h4
                            class="text-sm font-semibold text-warm-800 dark:text-zinc-200"
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
                                class="inline-flex rounded-lg border border-warm-300 px-2.5 py-1 text-xs font-medium text-warm-700 transition hover:bg-warm-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
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
    </div>
</template>

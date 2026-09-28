<script setup lang="ts">
import { ClipboardDocumentIcon } from '@heroicons/vue/24/outline';
import { computed, onMounted, ref } from 'vue';
import AndroidBottomControlBackground from '@/components/AndroidBottomControlBackground.vue';
import AppLayout from '@/components/AppLayout.vue';
import BackButton from '@/components/BackButton.vue';
import ErrorRetry from '@/components/ErrorRetry.vue';
import { useCourses } from '@/composables/useCourses';
import { useMaterialSourceInspector } from '@/composables/useMaterialSourceInspector';
import type { MaterialDirectoryNode } from '@/composables/useMaterialSourceInspector';
import { useTitle } from '@/composables/useTitle';
import { copyToClipboard } from '@/lib/clipboard';

useTitle('教材來源檢視');

const {
    courses,
    isLoading: isLoadingCourses,
    error: coursesError,
    fetchCourses,
} = useCourses();

const {
    directory,
    source,
    isLoadingDirectory,
    isLoadingSource,
    directoryError,
    directoryErrorDetail,
    sourceError,
    sourceErrorDetail,
    loadDirectory,
    loadSource,
    clearSource,
    reset,
} = useMaterialSourceInspector();

const selectedCid = ref('');
const activeScoid = ref('');
const showRawJson = ref(false);

const selectedCourseName = computed(
    () => courses.value.find((c) => c.courseId === selectedCid.value)?.name,
);

const isViewingSource = computed(
    () => isLoadingSource.value || !!source.value || !!sourceError.value,
);

const PARSE_KIND_LABEL: Record<string, string> = {
    html: '解析出文字內容',
    video: '解析出影片',
    youtube: '解析出 YouTube 影片',
    download: '判定為檔案下載',
    empty: '解析後沒有可顯示的內容',
    error: '解析時發生錯誤',
};

/**
 * A one-line reading of the two halves, so the user does not have to know
 * what to look for. It only ever says what the data shows.
 */
const verdict = computed<string | null>(() => {
    const s = source.value;

    if (!s) {
        return null;
    }

    if (s.fetchError) {
        return '無法取得學校的頁面，問題出在連線，而不是解析。';
    }

    if (s.fetchStatus !== null && s.fetchStatus >= 400) {
        return `學校伺服器回應了 ${s.fetchStatus}，頁面本身就取不到。`;
    }

    if (s.parse.kind === 'error') {
        return 'App 在解析這個頁面時發生錯誤，這是 App 的問題。';
    }

    if (s.parse.kind === 'empty' && s.bodyBytes === 0) {
        return '學校回傳了空白頁面，App 沒有東西可以顯示。';
    }

    if (s.parse.kind === 'empty') {
        return '學校頁面有內容，但 App 解析後沒有可顯示的部分。請檢視下方原始碼，並將它回報給作者。';
    }

    return null;
});

function indent(node: MaterialDirectoryNode): string {
    return '  '.repeat(node.level);
}

async function onSelectCourse(): Promise<void> {
    reset();
    activeScoid.value = '';
    showRawJson.value = false;

    if (selectedCid.value !== '') {
        await loadDirectory(selectedCid.value);
    }
}

async function onInspect(node: MaterialDirectoryNode): Promise<void> {
    activeScoid.value = node.identifier;
    await loadSource(selectedCid.value, node.identifier);
}

async function onRetrySource(): Promise<void> {
    await loadSource(selectedCid.value, activeScoid.value);
}

function onBackToDirectory(): void {
    clearSource();
    activeScoid.value = '';
}

async function copy(text: string, label: string): Promise<void> {
    const copied = await copyToClipboard(text);

    window.showFlashMessage(
        copied ? `已複製${label}` : '複製失敗，請稍後再試',
        copied ? 'success' : 'error',
    );
}

function directoryReport(): string {
    const d = directory.value;

    if (!d) {
        return '';
    }

    return [
        '# Alt UU 教材目錄',
        `課程：${selectedCid.value} ${selectedCourseName.value ?? ''}`.trim(),
        `學校回應：code=${d.apiCode ?? '無'} message=${d.apiMessage ?? '無'}`,
        `節點數：${d.nodeCount}`,
        '',
        ...d.nodes.map(
            (n) =>
                `${indent(n)}- [${n.identifier}] ${n.text} → ${n.href ?? '（無連結）'}${n.itemDisabled ? ' (disabled)' : ''}`,
        ),
    ].join('\n');
}

function sourceReport(): string {
    const s = source.value;

    if (!s) {
        return '';
    }

    const lines = [
        '# Alt UU 教材來源',
        `課程：${s.cid} ${selectedCourseName.value ?? ''}`.trim(),
        `節點：${s.scoid} ${s.nodeText}`,
        `網址：${s.url}`,
        `HTTP 狀態：${s.fetchStatus ?? '無（未取得回應）'}`,
        `Content-Type：${s.contentType ?? '未知'}`,
        `大小：${s.bodyBytes} bytes${s.bodyTruncated ? '（下方原始碼已截斷）' : ''}`,
        `解析結果：${PARSE_KIND_LABEL[s.parse.kind] ?? s.parse.kind}`,
    ];

    if (s.parse.kind === 'html') {
        lines.push(`解析後 HTML 長度：${s.parse.htmlLength}`);
    }

    if (s.parse.videoUrl) {
        lines.push(`影片網址：${s.parse.videoUrl}`);
    }

    if (s.fetchError) {
        lines.push(`取得頁面失敗：${s.fetchError}`);
    }

    if (s.parse.errorClass) {
        lines.push(
            `解析錯誤：${s.parse.errorClass}: ${s.parse.errorMessage ?? ''}`,
            `位置：${s.parse.errorLocation ?? ''}`,
        );
    }

    lines.push('', '## 原始碼', '', s.body ?? '（非文字內容，未顯示）');

    return lines.join('\n');
}

onMounted(() => {
    void fetchCourses().catch(() => {
        // Surfaced through `coursesError` below.
    });
});
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
                    <BackButton v-if="!isViewingSource" href="/settings" />
                    <BackButton v-else @click="onBackToDirectory" />

                    <h2 class="text-lg font-semibold">教材來源檢視</h2>
                </div>
            </div>
        </div>

        <div class="mx-auto mt-6 w-full max-w-4xl space-y-4 px-4 pb-24">
            <section
                v-if="!isViewingSource"
                class="rounded-xl border border-theme-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
            >
                <p class="text-xs text-theme-700 dark:text-zinc-400">
                    當教材目錄或內容顯示不出來時，可以在這裡看到學校實際送來的資料：目錄中每個節點的網址，以及每個節點頁面的原始碼與解析結果。
                </p>
                <p class="mt-2 text-xs text-theme-700 dark:text-zinc-400">
                    原始碼中的密碼、Cookie
                    與登入憑證已遮蔽，但頁面內容可能包含您的姓名或學號，分享前請先檢查。
                </p>

                <label
                    class="mt-4 block text-sm font-semibold text-theme-900 dark:text-zinc-100"
                    for="material-source-course"
                >
                    選擇課程
                </label>
                <select
                    id="material-source-course"
                    v-model="selectedCid"
                    class="mt-1 w-full rounded-lg border border-theme-300 bg-theme-50 px-3 py-2 text-sm text-theme-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                    :disabled="isLoadingCourses"
                    @change="onSelectCourse"
                >
                    <option value="">
                        {{ isLoadingCourses ? '載入課程中…' : '請選擇課程' }}
                    </option>
                    <option
                        v-for="course in courses"
                        :key="course.courseId"
                        :value="course.courseId"
                    >
                        {{ course.name }}
                    </option>
                </select>

                <p
                    v-if="coursesError"
                    class="mt-2 text-xs text-rose-600 dark:text-rose-400"
                >
                    {{ coursesError }}
                </p>
            </section>

            <template v-if="!isViewingSource && selectedCid !== ''">
                <section
                    v-if="isLoadingDirectory"
                    class="rounded-xl border border-theme-200 bg-white p-4 text-sm text-theme-700 shadow-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400"
                >
                    載入教材目錄中…
                </section>

                <ErrorRetry
                    v-else-if="directoryError"
                    :message="directoryError"
                    :detail="directoryErrorDetail"
                    :retrying="isLoadingDirectory"
                    @retry="loadDirectory(selectedCid)"
                />

                <section
                    v-else-if="directory"
                    class="rounded-xl border border-theme-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
                >
                    <div class="flex items-start justify-between gap-2">
                        <div>
                            <h3
                                class="text-sm font-semibold text-theme-900 dark:text-zinc-100"
                            >
                                教材目錄（{{ directory.nodeCount }} 個節點）
                            </h3>
                            <p
                                class="mt-1 text-xs text-theme-700 dark:text-zinc-400"
                            >
                                學校回應：code={{ directory.apiCode ?? '無' }}
                                <template v-if="directory.apiMessage">
                                    · {{ directory.apiMessage }}
                                </template>
                            </p>
                        </div>
                        <button
                            type="button"
                            class="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-theme-300 bg-theme-50 px-2.5 py-1.5 text-xs font-medium text-theme-800 hover:bg-theme-100 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
                            @click="copy(directoryReport(), '教材目錄')"
                        >
                            <ClipboardDocumentIcon class="size-4" />
                            <span>複製目錄</span>
                        </button>
                    </div>

                    <p
                        v-if="directory.nodeCount === 0"
                        class="mt-3 text-xs text-theme-700 dark:text-zinc-400"
                    >
                        學校沒有回傳任何節點。這通常代表目錄本身是空的，或學校的回應格式有變，請展開下方原始
                        JSON 檢視。
                    </p>

                    <ul
                        v-else
                        class="mt-3 divide-y divide-theme-200 dark:divide-zinc-700"
                    >
                        <li
                            v-for="node in directory.nodes"
                            :key="node.identifier + node.level + node.text"
                            class="flex items-start justify-between gap-3 py-2"
                            :style="{ paddingLeft: `${node.level}rem` }"
                        >
                            <div class="min-w-0">
                                <p
                                    class="text-sm text-theme-900 dark:text-zinc-100"
                                >
                                    {{ node.text || '（無標題）' }}
                                    <span
                                        v-if="node.itemDisabled"
                                        class="ml-1 rounded bg-theme-200 px-1.5 py-0.5 text-[10px] text-theme-800 dark:bg-zinc-700 dark:text-zinc-300"
                                        >已停用</span
                                    >
                                </p>
                                <p
                                    class="font-mono text-[11px] text-theme-700 dark:text-zinc-400"
                                >
                                    {{ node.identifier }}
                                </p>
                                <p
                                    class="font-mono text-[11px] break-all text-theme-700 dark:text-zinc-400"
                                >
                                    {{ node.href ?? '（無連結）' }}
                                </p>
                            </div>

                            <button
                                v-if="node.isInspectable"
                                type="button"
                                class="shrink-0 rounded-lg border border-theme-300 bg-theme-50 px-2.5 py-1.5 text-xs font-medium text-theme-800 hover:bg-theme-100 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
                                @click="onInspect(node)"
                            >
                                檢視內容
                            </button>
                        </li>
                    </ul>

                    <div
                        class="mt-4 border-t border-theme-200 pt-3 dark:border-zinc-700"
                    >
                        <div class="flex items-center justify-between gap-2">
                            <button
                                type="button"
                                class="text-xs font-medium text-theme-700 underline underline-offset-2 dark:text-zinc-300"
                                :aria-expanded="showRawJson"
                                @click="showRawJson = !showRawJson"
                            >
                                {{
                                    showRawJson
                                        ? '隱藏原始 JSON'
                                        : '顯示原始 JSON'
                                }}
                            </button>
                            <button
                                v-if="showRawJson"
                                type="button"
                                class="inline-flex items-center gap-1.5 text-xs text-theme-700 hover:text-theme-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                                @click="copy(directory.rawJson, '原始 JSON')"
                            >
                                <ClipboardDocumentIcon class="size-4" />
                                <span>複製</span>
                            </button>
                        </div>

                        <template v-if="showRawJson">
                            <pre
                                class="mt-2 max-h-96 overflow-auto rounded-lg bg-theme-50 p-3 font-mono text-[11px] leading-relaxed break-all whitespace-pre-wrap text-theme-800 dark:bg-zinc-800 dark:text-zinc-200"
                                >{{ directory.rawJson }}</pre
                            >
                            <p
                                v-if="directory.rawJsonTruncated"
                                class="mt-1 text-xs text-theme-700 dark:text-zinc-400"
                            >
                                內容過長，已截斷。
                            </p>
                        </template>
                    </div>
                </section>
            </template>

            <section
                v-if="isLoadingSource"
                class="rounded-xl border border-theme-200 bg-white p-4 text-sm text-theme-700 shadow-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400"
            >
                載入教材原始碼中…
            </section>

            <ErrorRetry
                v-else-if="sourceError"
                :message="sourceError"
                :detail="sourceErrorDetail"
                :retrying="isLoadingSource"
                @retry="onRetrySource"
            />

            <template v-else-if="source">
                <section
                    class="rounded-xl border border-theme-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
                >
                    <div class="flex items-start justify-between gap-2">
                        <h3
                            class="text-sm font-semibold text-theme-900 dark:text-zinc-100"
                        >
                            {{ source.nodeText || source.scoid }}
                        </h3>
                        <button
                            type="button"
                            class="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-theme-300 bg-theme-50 px-2.5 py-1.5 text-xs font-medium text-theme-800 hover:bg-theme-100 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
                            @click="copy(sourceReport(), '教材來源')"
                        >
                            <ClipboardDocumentIcon class="size-4" />
                            <span>複製全部</span>
                        </button>
                    </div>

                    <p
                        v-if="verdict"
                        class="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-200"
                    >
                        {{ verdict }}
                    </p>

                    <dl
                        class="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs"
                    >
                        <dt class="font-medium">網址</dt>
                        <dd class="font-mono break-all">{{ source.url }}</dd>

                        <dt class="font-medium">HTTP 狀態</dt>
                        <dd class="font-mono">
                            {{ source.fetchStatus ?? '無（未取得回應）' }}
                        </dd>

                        <dt class="font-medium">Content-Type</dt>
                        <dd class="font-mono break-all">
                            {{ source.contentType ?? '未知' }}
                        </dd>

                        <dt class="font-medium">大小</dt>
                        <dd class="font-mono">{{ source.bodyBytes }} bytes</dd>

                        <dt class="font-medium">解析結果</dt>
                        <dd>
                            {{
                                PARSE_KIND_LABEL[source.parse.kind] ??
                                source.parse.kind
                            }}
                            <span
                                v-if="source.parse.kind === 'html'"
                                class="font-mono"
                                >（{{ source.parse.htmlLength }} 字元）</span
                            >
                        </dd>

                        <template v-if="source.parse.videoUrl">
                            <dt class="font-medium">影片網址</dt>
                            <dd class="font-mono break-all">
                                {{ source.parse.videoUrl }}
                            </dd>
                        </template>

                        <template v-if="source.fetchError">
                            <dt class="font-medium">取得失敗</dt>
                            <dd
                                class="font-mono break-all text-rose-700 dark:text-rose-300"
                            >
                                {{ source.fetchError }}
                            </dd>
                        </template>

                        <template v-if="source.parse.errorClass">
                            <dt class="font-medium">解析錯誤</dt>
                            <dd
                                class="font-mono break-all text-rose-700 dark:text-rose-300"
                            >
                                {{ source.parse.errorClass }}:
                                {{ source.parse.errorMessage }}
                                <br />
                                {{ source.parse.errorLocation }}
                            </dd>
                        </template>
                    </dl>
                </section>

                <section
                    class="rounded-xl border border-theme-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
                >
                    <h3
                        class="text-sm font-semibold text-theme-900 dark:text-zinc-100"
                    >
                        原始碼
                    </h3>

                    <p
                        v-if="source.body === null"
                        class="mt-2 text-xs text-theme-700 dark:text-zinc-400"
                    >
                        {{
                            source.fetchError
                                ? '沒有取得任何內容。'
                                : '這不是文字內容（例如 PDF 或圖片），因此不顯示原始碼。'
                        }}
                    </p>
                    <p
                        v-else-if="source.body === ''"
                        class="mt-2 text-xs text-theme-700 dark:text-zinc-400"
                    >
                        學校回傳的內容是空的。
                    </p>
                    <template v-else>
                        <pre
                            class="mt-2 max-h-[32rem] overflow-auto rounded-lg bg-theme-50 p-3 font-mono text-[11px] leading-relaxed break-all whitespace-pre-wrap text-theme-800 dark:bg-zinc-800 dark:text-zinc-200"
                            >{{ source.body }}</pre
                        >
                        <p
                            v-if="source.bodyTruncated"
                            class="mt-1 text-xs text-theme-700 dark:text-zinc-400"
                        >
                            內容過長，已截斷；完整大小為
                            {{ source.bodyBytes }} bytes。
                        </p>
                    </template>
                </section>
            </template>
        </div>

        <AndroidBottomControlBackground />
    </AppLayout>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { REPORT_REASONS } from '@/stores/moderation';

const props = defineProps<{
    isOpen: boolean;
    reportNodeId: string | null;
    reportContent: string;
    reportType: string;
    isSubmitting: boolean;
    reportSuccess: boolean | null;
}>();

const emit = defineEmits<{
    'update:is-open': [value: boolean];
    'update:report-type': [value: string];
    submit: [];
}>();

const localReportType = ref(props.reportType);

watch(
    () => props.reportType,
    (newValue) => {
        localReportType.value = newValue;
    },
);

const handleReportTypeChange = (value: string) => {
    localReportType.value = value;
    emit('update:report-type', value);
};

const handleClose = () => {
    emit('update:is-open', false);
};

const handleSubmit = () => {
    emit('submit');
};
</script>

<template>
    <Teleport to="body">
        <div
            v-if="isOpen"
            class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
            @click.self="handleClose"
        >
            <div
                class="flex max-h-[calc(100vh-2rem)] w-full max-w-md flex-col rounded-2xl bg-white shadow-xl dark:bg-zinc-900"
            >
                <!-- Header -->
                <div
                    class="border-b border-warm-200 px-5 py-4 dark:border-zinc-700"
                >
                    <h3
                        class="text-lg font-semibold text-warm-900 dark:text-zinc-100"
                    >
                        檢舉此內容
                    </h3>
                </div>

                <!-- Scrollable Content -->
                <div class="flex-1 overflow-y-auto px-5 py-4">
                    <p class="mb-3 text-sm text-warm-600 dark:text-zinc-400">
                        請選擇檢舉原因：
                    </p>

                    <div class="space-y-2">
                        <label
                            v-for="reason in REPORT_REASONS"
                            :key="reason.value"
                            class="flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition"
                            :class="
                                localReportType === reason.value
                                    ? 'border-warm-700 bg-warm-50 text-warm-900 dark:border-warm-500 dark:bg-warm-900 dark:text-zinc-100'
                                    : 'border-warm-200 text-warm-700 hover:bg-warm-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800'
                            "
                        >
                            <input
                                :checked="localReportType === reason.value"
                                type="radio"
                                :value="reason.value"
                                class="accent-warm-700 dark:accent-warm-500"
                                @change="handleReportTypeChange(reason.value)"
                            />
                            {{ reason.label }}
                        </label>
                    </div>

                    <!-- 檢舉功能說明 -->
                    <div
                        class="mt-3 rounded-lg border border-dashed border-warm-300 bg-warm-50 p-3 text-sm text-warm-700 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                    >
                        本檢舉功能由 Alt UU 提供：你的檢舉內容將傳送給 Alt UU
                        而非校方，包含去識別化的裝置資訊與討論板資訊，以及所檢舉的文字內容。一般來說，檢舉的內容將會在
                        24 小時內被處理。
                    </div>

                    <div
                        v-if="reportSuccess === true"
                        class="mt-3 rounded-lg bg-emerald-50 p-2 text-sm text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                    >
                        檢舉已送出，感謝你的回報。
                    </div>

                    <div
                        v-if="reportSuccess === false"
                        class="mt-3 rounded-lg bg-rose-50 p-2 text-sm text-rose-700 dark:bg-rose-950 dark:text-rose-300"
                    >
                        檢舉送出失敗，請稍後再試。
                    </div>
                </div>

                <!-- Footer -->
                <div
                    class="flex justify-end gap-2 border-t border-warm-200 px-5 py-4 dark:border-zinc-700"
                >
                    <button
                        type="button"
                        class="rounded-xl border border-warm-300 bg-white px-4 py-2 text-sm font-semibold text-warm-700 transition hover:bg-warm-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
                        @click="handleClose"
                    >
                        取消
                    </button>
                    <button
                        type="button"
                        class="rounded-xl bg-warm-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-warm-800 disabled:opacity-50 dark:bg-warm-800 dark:hover:bg-warm-700"
                        :disabled="!localReportType || isSubmitting"
                        @click="handleSubmit"
                    >
                        {{ isSubmitting ? '送出中…' : '送出檢舉' }}
                    </button>
                </div>
            </div>
        </div>
    </Teleport>
</template>

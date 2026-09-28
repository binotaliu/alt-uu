<script setup lang="ts">
import {
    CheckIcon,
    ClipboardDocumentIcon,
    VideoCameraIcon,
} from '@heroicons/vue/24/outline';
import { computed, ref } from 'vue';
import { copyToClipboard } from '@/lib/clipboard';

const props = defineProps<{
    isOpen: boolean;
    nickname: string;
    url: string;
    email: string;
}>();

const emit = defineEmits<{
    close: [];
    entered: [];
}>();

const showMoreInfo = ref(false);
const copyStates = ref<Record<string, 'idle' | 'copied' | 'failed'>>({});
const copyTimeouts: Record<string, ReturnType<typeof setTimeout>> = {};

function resetCopyStateSoon(key: string) {
    clearTimeout(copyTimeouts[key]);

    copyTimeouts[key] = setTimeout(() => {
        copyStates.value[key] = 'idle';
    }, 2000);
}

async function copyField(key: string, value: string) {
    const ok = await copyToClipboard(value);
    copyStates.value[key] = ok ? 'copied' : 'failed';
    resetCopyStateSoon(key);
}

function selectInputText(event: FocusEvent) {
    (event.target as HTMLInputElement).select();
}

const fields = computed(() => {
    const result = [
        {
            key: 'nickname',
            label: '顯示暱稱',
            value: props.nickname,
            visible: true,
        },
        {
            key: 'url',
            label: '教室連結',
            value: props.url,
            visible: showMoreInfo.value && props.url !== '',
        },
        {
            key: 'email',
            label: '電子郵件',
            value: props.email,
            visible: showMoreInfo.value && props.email !== '',
        },
    ];

    return result.filter((field) => field.visible);
});

const hasCopyFailure = computed(() =>
    fields.value.some((field) => copyStates.value[field.key] === 'failed'),
);
</script>

<template>
    <Teleport to="body">
        <Transition
            enter-active-class="transition duration-200 ease-out"
            enter-from-class="opacity-0"
            enter-to-class="opacity-100"
            leave-active-class="transition duration-150 ease-in"
            leave-from-class="opacity-100"
            leave-to-class="opacity-0"
        >
            <div
                v-if="isOpen"
                class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
                @click.self="emit('close')"
            >
                <Transition
                    enter-active-class="transition duration-200 ease-out"
                    enter-from-class="scale-95 opacity-0"
                    enter-to-class="scale-100 opacity-100"
                    leave-active-class="transition duration-150 ease-in"
                    leave-from-class="scale-100 opacity-100"
                    leave-to-class="scale-95 opacity-0"
                >
                    <div
                        v-if="isOpen"
                        class="w-full max-w-sm rounded-2xl bg-white shadow-xl dark:bg-zinc-900"
                    >
                        <div class="px-5 py-4">
                            <h3
                                class="text-lg font-semibold text-theme-900 dark:text-zinc-100"
                            >
                                設定顯示暱稱
                            </h3>
                            <p
                                class="mt-2 text-sm text-theme-700 dark:text-zinc-400"
                            >
                                進入教室前，請將您的顯示暱稱設定為以下內容，方便老師與同學辨識身分。
                            </p>

                            <div
                                v-for="field in fields"
                                :key="field.key"
                                class="mt-3"
                            >
                                <label
                                    :for="`live-session-field-${field.key}`"
                                    class="text-xs font-medium text-theme-700 dark:text-zinc-400"
                                >
                                    {{ field.label }}
                                </label>
                                <div class="mt-1 flex items-center gap-2">
                                    <input
                                        :id="`live-session-field-${field.key}`"
                                        type="text"
                                        readonly
                                        :value="field.value"
                                        class="min-w-0 flex-1 rounded-lg border border-theme-300 bg-theme-50 px-3 py-2 text-sm text-theme-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                                        @focus="selectInputText"
                                    />
                                    <button
                                        type="button"
                                        class="inline-flex shrink-0 items-center gap-1 rounded-lg border border-theme-300 px-3 py-2 text-sm font-medium text-theme-700 transition hover:bg-theme-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
                                        @click="
                                            copyField(field.key, field.value)
                                        "
                                    >
                                        <CheckIcon
                                            v-if="
                                                copyStates[field.key] ===
                                                'copied'
                                            "
                                            class="size-4"
                                        />
                                        <ClipboardDocumentIcon
                                            v-else
                                            class="size-4"
                                        />
                                        {{
                                            copyStates[field.key] === 'copied'
                                                ? '已複製'
                                                : '複製'
                                        }}
                                    </button>
                                </div>
                            </div>

                            <p
                                v-if="hasCopyFailure"
                                class="mt-2 text-xs text-rose-600 dark:text-rose-400"
                            >
                                自動複製失敗，請手動選取並複製上方文字。
                            </p>

                            <button
                                type="button"
                                class="mt-3 text-sm font-medium text-theme-700 underline underline-offset-2 dark:text-zinc-300"
                                :aria-expanded="showMoreInfo"
                                @click="showMoreInfo = !showMoreInfo"
                            >
                                {{
                                    showMoreInfo
                                        ? '隱藏更多資訊'
                                        : '顯示更多資訊'
                                }}
                            </button>
                        </div>

                        <div
                            class="flex justify-end gap-2 border-t border-theme-200 px-5 py-4 dark:border-zinc-700"
                        >
                            <button
                                type="button"
                                class="rounded-xl border border-theme-300 bg-white px-4 py-2 text-sm font-semibold text-theme-700 transition hover:bg-theme-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
                                @click="emit('close')"
                            >
                                取消
                            </button>
                            <button
                                type="button"
                                class="inline-flex items-center gap-1 rounded-xl bg-theme-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-theme-800 dark:bg-theme-800 dark:hover:bg-theme-700"
                                @click="emit('entered')"
                            >
                                <VideoCameraIcon class="size-4" />
                                進入教室
                            </button>
                        </div>
                    </div>
                </Transition>
            </div>
        </Transition>
    </Teleport>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';

const props = defineProps<{
    isOpen: boolean;
    initialValue: string;
    processing?: boolean;
    error?: string;
}>();

const emit = defineEmits<{
    confirm: [value: string];
    cancel: [];
}>();

const value = ref(props.initialValue);

watch(
    () => props.isOpen,
    (isOpen) => {
        if (isOpen) {
            value.value = props.initialValue;
        }
    },
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
                @click.self="emit('cancel')"
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
                        <form
                            class="px-5 py-4"
                            @submit.prevent="emit('confirm', value)"
                        >
                            <h3
                                class="text-lg font-semibold text-theme-900 dark:text-zinc-100"
                            >
                                修改名稱
                            </h3>
                            <p
                                class="mt-2 text-sm text-theme-700 dark:text-zinc-400"
                            >
                                設定這個帳號的自訂名稱，僅顯示在這個裝置上。
                            </p>

                            <input
                                v-model="value"
                                type="text"
                                maxlength="30"
                                placeholder="請輸入自訂名稱"
                                class="mt-3 w-full rounded-lg border border-theme-300 bg-white px-3 py-2 text-sm text-theme-900 focus:outline-none dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                            />

                            <p
                                v-if="error"
                                class="mt-2 text-xs text-rose-600 dark:text-rose-400"
                            >
                                {{ error }}
                            </p>
                        </form>

                        <div
                            class="flex justify-end gap-2 border-t border-theme-200 px-5 py-4 dark:border-zinc-700"
                        >
                            <button
                                type="button"
                                class="rounded-xl border border-theme-300 bg-white px-4 py-2 text-sm font-semibold text-theme-700 transition hover:bg-theme-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
                                @click="emit('cancel')"
                            >
                                取消
                            </button>
                            <button
                                type="button"
                                :disabled="processing"
                                class="rounded-xl bg-theme-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-theme-800 disabled:opacity-50 dark:bg-theme-800 dark:hover:bg-theme-700"
                                @click="emit('confirm', value)"
                            >
                                {{ processing ? '儲存中…' : '儲存' }}
                            </button>
                        </div>
                    </div>
                </Transition>
            </div>
        </Transition>
    </Teleport>
</template>

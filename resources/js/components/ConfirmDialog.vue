<script setup lang="ts">
defineProps<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    danger?: boolean;
}>();

const emit = defineEmits<{
    confirm: [];
    cancel: [];
}>();
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
                        <div class="px-5 py-4">
                            <h3
                                class="text-lg font-semibold text-theme-900 dark:text-zinc-100"
                            >
                                {{ title }}
                            </h3>
                            <p
                                class="mt-2 text-sm text-theme-700 dark:text-zinc-400"
                            >
                                {{ message }}
                            </p>
                        </div>

                        <div
                            class="flex justify-end gap-2 border-t border-theme-200 px-5 py-4 dark:border-zinc-700"
                        >
                            <button
                                type="button"
                                class="rounded-xl border border-theme-300 bg-white px-4 py-2 text-sm font-semibold text-theme-700 transition hover:bg-theme-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
                                @click="emit('cancel')"
                            >
                                {{ cancelLabel ?? '取消' }}
                            </button>
                            <button
                                type="button"
                                class="rounded-xl px-4 py-2 text-sm font-semibold text-white transition disabled:opacity-50"
                                :class="
                                    danger
                                        ? 'bg-rose-600 hover:bg-rose-700 dark:bg-rose-700 dark:hover:bg-rose-600'
                                        : 'bg-theme-700 hover:bg-theme-800 dark:bg-theme-800 dark:hover:bg-theme-700'
                                "
                                @click="emit('confirm')"
                            >
                                {{ confirmLabel ?? '確認' }}
                            </button>
                        </div>
                    </div>
                </Transition>
            </div>
        </Transition>
    </Teleport>
</template>

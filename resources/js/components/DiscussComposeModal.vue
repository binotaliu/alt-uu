<script setup lang="ts">
import { XMarkIcon } from '@heroicons/vue/24/outline';
import { computed, onBeforeUnmount, watch } from 'vue';

const props = withDefaults(
    defineProps<{
        modelValue: boolean;
        title: string;
        contextLabel: string;
        contextValue: string;
        submitLabel?: string;
        isSubmitting?: boolean;
    }>(),
    {
        submitLabel: '送出',
        isSubmitting: false,
    },
);

const emit = defineEmits<{
    (e: 'update:modelValue', value: boolean): void;
    (e: 'submit'): void;
}>();

const isOpen = computed(() => props.modelValue);

const closeModal = (): void => {
    emit('update:modelValue', false);
};

const onBackdropClick = (event: MouseEvent): void => {
    if (event.target === event.currentTarget) {
        closeModal();
    }
};

const onEscape = (event: KeyboardEvent): void => {
    if (event.key === 'Escape' && isOpen.value) {
        closeModal();
    }
};

watch(
    isOpen,
    (open) => {
        if (typeof document === 'undefined' || typeof window === 'undefined') {
            return;
        }

        document.body.style.overflow = open ? 'hidden' : '';

        if (open) {
            window.addEventListener('keydown', onEscape);
        } else {
            window.removeEventListener('keydown', onEscape);
        }
    },
    { immediate: true },
);

onBeforeUnmount(() => {
    if (typeof document !== 'undefined') {
        document.body.style.overflow = '';
    }

    if (typeof window !== 'undefined') {
        window.removeEventListener('keydown', onEscape);
    }
});
</script>

<template>
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
            class="fixed inset-0 z-50 flex items-end justify-center bg-zinc-950/45 px-(--inset-left,0px) pt-6 pr-(--inset-right,0px) pb-(--inset-bottom,0px) md:items-center md:px-6"
            @click="onBackdropClick"
        >
            <Transition
                enter-active-class="transition duration-200 ease-out"
                enter-from-class="translate-y-full opacity-0 md:translate-y-2 md:scale-[0.98]"
                enter-to-class="translate-y-0 opacity-100 md:scale-100"
                leave-active-class="transition duration-150 ease-in"
                leave-from-class="translate-y-0 opacity-100 md:scale-100"
                leave-to-class="translate-y-full opacity-0 md:translate-y-2 md:scale-[0.98]"
            >
                <section
                    v-if="isOpen"
                    role="dialog"
                    aria-modal="true"
                    class="w-full max-w-2xl rounded-t-3xl bg-white shadow-2xl md:rounded-2xl dark:border-zinc-700 dark:bg-zinc-900"
                >
                    <header
                        class="flex items-start justify-between gap-3 border-b border-warm-200 px-4 pt-4 pb-3 dark:border-zinc-700"
                    >
                        <div class="min-w-0">
                            <h3
                                class="text-base font-semibold text-warm-900 md:text-lg dark:text-zinc-100"
                            >
                                {{ title }}
                            </h3>
                            <p
                                class="mt-1 text-xs text-warm-600 md:text-sm dark:text-zinc-400"
                            >
                                {{ contextLabel }}：{{ contextValue }}
                            </p>
                        </div>
                        <button
                            type="button"
                            class="inline-flex h-9 w-9 items-center justify-center text-warm-700 transition hover:border-warm-400 hover:text-warm-900 dark:text-zinc-300 dark:hover:border-zinc-400 dark:hover:text-zinc-100"
                            aria-label="關閉"
                            @click="closeModal"
                        >
                            <XMarkIcon class="size-5" />
                        </button>
                    </header>

                    <div
                        class="max-h-[72vh] space-y-3 overflow-y-auto px-4 py-4"
                    >
                        <slot />
                    </div>

                    <footer
                        class="flex flex-col items-stretch justify-end gap-2 border-t border-warm-200 px-4 py-3 pb-(--inset-bottom,1.5rem) md:flex-row md:items-center md:pb-3 dark:border-zinc-700"
                    >
                        <button
                            type="button"
                            class="rounded-xl border border-warm-300 bg-white px-4 py-2 font-semibold text-warm-700 transition hover:border-warm-400 hover:bg-warm-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:border-zinc-500 dark:hover:bg-zinc-700"
                            :disabled="isSubmitting"
                            @click="closeModal"
                        >
                            取消
                        </button>
                        <button
                            type="button"
                            class="rounded-xl bg-warm-700 px-4 py-2 font-semibold text-white transition hover:bg-warm-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-warm-800 dark:hover:bg-warm-700"
                            :disabled="isSubmitting"
                            @click="emit('submit')"
                        >
                            {{ submitLabel }}
                        </button>
                    </footer>
                </section>
            </Transition>
        </div>
    </Transition>
</template>

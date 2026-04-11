<script setup lang="ts">
import {
    CheckCircleIcon,
    XCircleIcon,
    XMarkIcon,
} from '@heroicons/vue/24/outline';
import { ref, onMounted, computed } from 'vue';
import type { Slot } from 'vue';
import {
    bootstrapNativePageTransitions,
    commitNativePageVisit,
} from '@/lib/nativePageTransition';

defineProps<{
    title?: string;
}>();

defineSlots<{
    default: Slot;
    header?: Slot;
}>();

const showFlash = ref(false);
const flashMessage = ref('');
const flashType = ref<'success' | 'error'>('success');

const toastIcon = computed(() => {
    return flashType.value === 'success' ? CheckCircleIcon : XCircleIcon;
});

const showFlashMessage = (message: string, type: 'success' | 'error') => {
    flashMessage.value = message;
    flashType.value = type;
    showFlash.value = true;
    setTimeout(() => {
        showFlash.value = false;
    }, 4000);
};

// add to window for easier debugging and testing in DevTools console
window.showFlashMessage = showFlashMessage;

onMounted(() => {
    bootstrapNativePageTransitions();
    commitNativePageVisit();
});
</script>

<template>
    <main class="min-h-screen text-warm-900 dark:text-zinc-100">
        <Transition
            enter-active-class="transition-opacity duration-200"
            leave-active-class="transition-opacity duration-200"
            enter-from-class="opacity-0"
            leave-to-class="opacity-0"
        >
            <div
                v-if="showFlash"
                class="fixed inset-x-0 top-auto bottom-4 z-500 mb-(--inset-bottom,0px) flex w-full justify-center px-4 md:top-[calc(max(var(--inset-top,0),var(--corner-inset-top,0))+1rem)] md:bottom-auto"
            >
                <div
                    class="pointer-events-auto w-full max-w-md rounded-2xl border bg-white px-4 py-3 shadow-lg transition md:max-w-lg md:px-6 md:py-4 md:text-base dark:bg-zinc-900"
                    :class="{
                        'border-emerald-300 text-emerald-800 dark:border-emerald-700 dark:text-zinc-100':
                            flashType === 'success',
                        'border-rose-300 text-rose-800 dark:border-rose-700 dark:text-zinc-100':
                            flashType === 'error',
                    }"
                >
                    <div class="flex items-center gap-3">
                        <component
                            :is="toastIcon"
                            class="h-5 w-5 shrink-0"
                            :class="{
                                'text-emerald-500': flashType === 'success',
                                'text-rose-500': flashType === 'error',
                            }"
                        />
                        <div class="flex-1 text-sm leading-relaxed">
                            {{ flashMessage }}
                        </div>
                        <button
                            type="button"
                            class="text-current opacity-70 transition hover:opacity-100"
                            aria-label="關閉"
                            @click="showFlash = false"
                        >
                            <XMarkIcon class="size-5" />
                        </button>
                    </div>
                </div>
            </div>
        </Transition>

        <slot name="header" />
        <slot />
    </main>
</template>

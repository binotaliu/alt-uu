<script setup lang="ts">
import BackButton from '@/components/BackButton.vue';

defineProps<{
    title: string;
    subtitle?: string | null;
    showLeftSlot?: boolean;
    showRightSlot?: boolean;
    isLoading?: boolean;
}>();

const emit = defineEmits<{
    (e: 'back'): void;
}>();

function onBackClick(): void {
    emit('back');
}
</script>

<template>
    <header
        class="sticky top-0 z-40 flex items-stretch border-b border-warm-200/80 bg-white/90 pt-(--inset-top,0px) pr-[max(var(--inset-right,0px),var(--corner-inset-right,0px),1rem)] pl-[max(var(--inset-left,0px),var(--corner-inset-left,0px),1rem)] backdrop-blur [view-transition-name:page-header] dark:border-zinc-700/80 dark:bg-zinc-900/90"
    >
        <div class="inline-flex shrink-0 items-start pt-1.5">
            <slot name="left">
                <BackButton
                    v-if="showLeftSlot"
                    class="inline-flex shrink-0 items-center gap-1 px-3 py-1.5 text-xs font-medium text-warm-700 transition [view-transition-name:page-header-back-button] hover:border-warm-500"
                    @click="onBackClick"
                />
            </slot>
        </div>

        <div
            class="flex min-w-0 grow items-start justify-between gap-3 pt-1.5 pb-3"
        >
            <div class="flex min-w-0 flex-1 items-center gap-3">
                <div class="max-w-full min-w-0 flex-1 overflow-hidden">
                    <template v-if="!isLoading">
                        <p
                            class="w-fit max-w-full truncate text-base font-semibold text-warm-900 [view-transition-name:page-header-title] md:text-lg dark:text-zinc-100"
                        >
                            {{ title }}
                        </p>
                        <div
                            v-if="subtitle"
                            class="mt-1 flex h-6 max-w-full items-center overflow-hidden md:mt-2 md:h-7"
                        >
                            <p
                                class="w-fit max-w-full truncate text-sm text-warm-700 [view-transition-name:page-header-subtitle] md:mt-2 md:h-7 md:text-sm dark:text-zinc-300"
                            >
                                {{ subtitle }}
                            </p>
                        </div>
                        <div
                            class="mt-1 h-6 w-fit max-w-full [view-transition-name:page-header-subtitle] md:mt-2 md:h-7"
                            v-if="$slots.below"
                        >
                            <slot name="below" />
                        </div>
                    </template>
                    <template v-else>
                        <div class="flex flex-col">
                            <span
                                class="h-6 w-20 animate-pulse rounded bg-warm-200 [view-transition-name:page-header-title] md:h-7 dark:bg-zinc-700"
                            ></span>
                            <span
                                class="mt-1 h-6 w-36 animate-pulse rounded bg-warm-200 [view-transition-name:page-header-subtitle] md:mt-2 md:h-7 dark:bg-zinc-700"
                            ></span>
                        </div>
                    </template>
                </div>
            </div>
        </div>

        <div
            class="ml-2 inline-flex shrink-0 items-center gap-2 [view-transition-name:page-header-actions]"
            v-if="$slots.right"
        >
            <slot name="right" />
        </div>
    </header>
</template>

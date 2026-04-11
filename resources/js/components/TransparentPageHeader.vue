<script setup lang="ts">
import { Cog6ToothIcon } from '@heroicons/vue/24/outline';

interface Props {
    title: string;
    settingsUrl?: string;
    settingsLabel?: string;
}

const props = defineProps<Props>();

const settingsUrl = props.settingsUrl ?? '/settings';
const settingsLabel = props.settingsLabel ?? '設定';
</script>

<template>
    <div
        class="sticky top-0 w-full bg-warm-100/80 py-1.5 pt-(--inset-top,4rem) pr-(--inset-right,0px) pl-(--inset-left,0px) backdrop-blur-xs [view-transition-name:page-header] dark:bg-zinc-950/80"
    >
        <!-- 左右都給他一樣 Padding 讓他看起來置中 -->
        <div
            v-if="$slots.nav"
            class="mb-2 pr-(--corner-inset-left,0px) pl-(--corner-inset-left,0px)"
        >
            <slot name="nav" />
        </div>

        <div :class="{ 'pl-(--corner-inset-left,0px)': !$slots.nav }">
            <div
                class="flex items-center justify-between gap-2 px-4 pt-0.5 text-warm-900 dark:text-zinc-100"
            >
                <div class="flex items-center gap-2">
                    <slot name="icon" />
                    <h2
                        class="w-fit text-lg font-semibold [view-transition-name:page-header-title] md:text-xl"
                    >
                        {{ props.title }}
                    </h2>
                </div>

                <slot name="actions">
                    <router-link
                        :to="settingsUrl"
                        class="inline-flex items-center gap-1 rounded-full border border-warm-300 bg-white px-3 py-1.5 text-sm font-medium text-warm-700 transition [view-transition-name:page-header-actions] hover:border-warm-500 hover:bg-warm-50 md:gap-2 md:px-4 md:py-2 md:text-base dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:border-zinc-400 dark:hover:bg-zinc-700"
                    >
                        <Cog6ToothIcon class="size-4 md:size-5" />
                        {{ settingsLabel }}
                    </router-link>
                </slot>
            </div>
        </div>
    </div>
</template>

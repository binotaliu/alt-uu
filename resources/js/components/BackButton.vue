<script setup lang="ts">
import { navigateBack } from '@/router';

const props = defineProps<{
    href?: string;
    class?: string;
}>();
const emit = defineEmits<{ (e: 'click'): void }>();

const buttonClass =
    props.class ??
    'inline-flex shrink-0 items-center self-start pl-4 pr-6 py-5.5 -m-4 text-theme-700 transition hover:border-theme-500 dark:text-zinc-300';

function handleClick(): void {
    if (!props.href) {
        emit('click');

        return;
    }

    navigateBack(props.href);
}
</script>

<template>
    <button type="button" :class="buttonClass" @click="handleClick">
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.1"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="h-6 w-6"
            aria-hidden="true"
        >
            <path d="M15 18l-6-6 6-6" />
        </svg>
    </button>
</template>

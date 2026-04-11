<script setup lang="ts">
import { useRouter } from 'vue-router';

const vueRouter = useRouter();

const props = defineProps<{
    href?: string;
    class?: string;
}>();
const emit = defineEmits<{ (e: 'click'): void }>();

const buttonClass =
    props.class ??
    'inline-flex shrink-0 items-center self-start pl-4 pr-6 py-5.5 -m-4 text-warm-700 transition hover:border-warm-500 dark:text-zinc-300';

function navigateBack(): void {
    if (document.startViewTransition) {
        document.startViewTransition(() => {
            window.history.back();
        });
    } else {
        window.history.back();
    }
}

function handleClick(): void {
    if (!props.href) {
        emit('click');

        return;
    }

    // Use history.back() only when the previous history entry matches the
    // target href. This pops the stack correctly in normal navigation flow.
    // When history is absent or mismatched (e.g. after WebView recovery),
    // fall back to replace to avoid creating loop entries.
    const previousPath = window.history.state?.back as string | null;

    if (previousPath === props.href) {
        navigateBack();
    } else {
        vueRouter.replace(props.href);
    }
}
</script>

<template>
    <button
        type="button"
        :class="buttonClass"
        data-native-transition="back"
        @click="handleClick"
    >
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

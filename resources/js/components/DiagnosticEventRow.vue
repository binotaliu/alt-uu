<script setup lang="ts">
import { computed, ref } from 'vue';
import type { DiagnosticEventRow } from '@/composables/useDiagnosticLog';

const props = defineProps<{
    event: DiagnosticEventRow;
}>();

const expanded = ref(false);

const hasContext = computed(
    () => Object.keys(props.event.context ?? {}).length > 0,
);

const marker = computed(() => {
    switch (props.event.level) {
        case 'error':
            return '✗';
        case 'warning':
            return '!';
        default:
            return '·';
    }
});

const toneClass = computed(() => {
    switch (props.event.level) {
        case 'error':
            return 'text-rose-700 dark:text-rose-300';
        case 'warning':
            return 'text-amber-700 dark:text-amber-300';
        default:
            return 'text-theme-700 dark:text-zinc-400';
    }
});

const time = computed(() => {
    const parsed = new Date(props.event.occurredAt);

    return Number.isNaN(parsed.getTime())
        ? props.event.occurredAt
        : parsed.toLocaleTimeString('zh-TW', { hour12: false });
});

const contextJson = computed(() =>
    JSON.stringify(props.event.context, null, 2),
);
</script>

<template>
    <li
        class="border-b border-theme-200 py-2 text-xs last:border-b-0 dark:border-zinc-800"
    >
        <button
            type="button"
            class="flex w-full items-start gap-2 text-left"
            :aria-expanded="expanded"
            :disabled="!hasContext"
            @click="expanded = !expanded"
        >
            <span :class="['w-3 shrink-0 font-mono', toneClass]">{{
                marker
            }}</span>
            <span
                class="w-16 shrink-0 font-mono text-theme-700 dark:text-zinc-400"
                >{{ time }}</span
            >
            <span class="min-w-0 flex-1">
                <span class="block break-all text-theme-900 dark:text-zinc-100">
                    {{ event.summary }}
                </span>
                <span
                    class="mt-0.5 flex flex-wrap gap-x-2 text-theme-700 dark:text-zinc-400"
                >
                    <span>{{ event.typeLabel }}</span>
                    <span v-if="event.status !== null" class="font-mono"
                        >→ {{ event.status }}</span
                    >
                    <span v-if="event.durationMs !== null" class="font-mono"
                        >{{ event.durationMs }}ms</span
                    >
                    <span v-if="event.op" class="font-mono">{{
                        event.op
                    }}</span>
                    <span v-if="event.requestId" class="font-mono"
                        >#{{ event.requestId }}</span
                    >
                </span>
            </span>
        </button>

        <pre
            v-if="expanded && hasContext"
            class="mt-2 overflow-x-auto rounded-lg bg-theme-100 p-2 font-mono text-[11px] text-theme-800 dark:bg-zinc-800 dark:text-zinc-200"
            >{{ contextJson }}</pre
        >
    </li>
</template>

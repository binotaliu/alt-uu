<script setup lang="ts">
const props = withDefaults(
    defineProps<{
        modelValue: boolean;
        label: string;
        description?: string;
        disabled?: boolean;
    }>(),
    {
        description: '',
        disabled: false,
    },
);

const emit = defineEmits<{
    'update:modelValue': [value: boolean];
}>();

function onChange(event: Event): void {
    if (props.disabled) {
        return;
    }

    const input = event.target as HTMLInputElement;
    emit('update:modelValue', input.checked);
}
</script>

<template>
    <div class="z-0 flex items-center justify-between gap-3 py-2.5">
        <div>
            <p class="text-sm font-medium text-theme-800 dark:text-zinc-100">
                {{ label }}
            </p>
            <p
                v-if="description"
                class="text-xs text-theme-700 dark:text-zinc-300"
            >
                {{ description }}
            </p>
        </div>

        <label
            class="relative inline-flex h-8 w-16 shrink-0 cursor-pointer items-center rounded-full border transition disabled:cursor-not-allowed disabled:opacity-50"
            :class="
                modelValue
                    ? 'border-theme-700 bg-theme-200 dark:border-theme-500 dark:bg-theme-500 dark:bg-zinc-700'
                    : 'border-theme-300 bg-white dark:bg-zinc-500'
            "
        >
            <input
                type="checkbox"
                class="peer sr-only"
                :checked="modelValue"
                :disabled="disabled"
                :aria-checked="modelValue"
                @change="onChange"
            />

            <span
                class="absolute inset-0 rounded-full transition"
                :class="
                    modelValue
                        ? 'bg-theme-200 dark:bg-theme-700'
                        : 'bg-white dark:bg-zinc-700'
                "
            />

            <span
                class="h-5 w-5 rounded-full bg-theme-700 shadow-lg transition dark:bg-theme-500"
                :class="modelValue ? 'translate-x-9' : 'translate-x-1'"
            />
        </label>
    </div>
</template>

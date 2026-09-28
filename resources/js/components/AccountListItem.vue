<script setup lang="ts">
import { UserCircleIcon } from '@heroicons/vue/24/outline';
import type { AccountProfile } from '@/types';

defineProps<{
    account: AccountProfile;
    disabled?: boolean;
}>();

defineEmits<{ select: [] }>();

defineSlots<{
    trailing?: () => unknown;
}>();
</script>

<template>
    <button
        type="button"
        :disabled="disabled"
        class="flex w-full items-center gap-3 px-5 py-3 text-left transition hover:bg-theme-50 disabled:opacity-50 dark:hover:bg-zinc-800"
        @click="$emit('select')"
    >
        <img
            v-if="account.picture"
            :src="account.picture"
            alt=""
            draggable="false"
            class="size-9 shrink-0 rounded-full object-cover select-none [-webkit-touch-callout:none]"
        />
        <UserCircleIcon
            v-else
            class="size-9 shrink-0 text-theme-700 dark:text-zinc-500"
        />

        <div class="min-w-0 flex-1">
            <p
                class="truncate text-sm font-semibold text-theme-900 dark:text-zinc-100"
            >
                {{ account.nickname || account.username }}
            </p>
            <p class="truncate text-xs text-theme-700 dark:text-zinc-400">
                {{ account.displayName }}
            </p>
        </div>

        <slot name="trailing" />
    </button>
</template>

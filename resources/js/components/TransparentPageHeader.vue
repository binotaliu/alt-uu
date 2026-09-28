<script setup lang="ts">
import AccountSwitcherButton from '@/components/AccountSwitcherButton.vue';

interface Props {
    title: string;
}

const props = defineProps<Props>();
</script>

<template>
    <div
        class="sticky top-0 w-full bg-theme-100 py-1.5 pt-(--inset-top,4rem) pr-(--inset-right,0px) pl-(--inset-left,0px) dark:bg-zinc-950"
    >
        <!-- 左右都給他一樣 Padding 讓他看起來置中 -->
        <div
            v-if="$slots.nav"
            class="mb-2 pr-(--corner-inset-left,0px) pl-(--corner-inset-left,0px)"
        >
            <slot name="nav" />
        </div>

        <div
            class="pl-(--corner-inset-left,0px)"
            :class="{
                // 有 nav 的話在平板上不給 pl，因為這個 Title 會被 Nav 推到下面，不會被 Window Control 擋住
                'md:pl-0': !$slots.nav,
            }"
        >
            <div
                class="flex items-center justify-between gap-2 px-4 pt-0.5 text-theme-900 dark:text-zinc-100"
            >
                <div class="flex items-center gap-2">
                    <slot name="icon" />
                    <h2 class="w-fit text-lg font-semibold md:text-xl">
                        {{ props.title }}
                    </h2>
                </div>

                <slot name="actions">
                    <AccountSwitcherButton />
                </slot>
            </div>
        </div>
    </div>
</template>

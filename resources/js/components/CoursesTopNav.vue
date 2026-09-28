<script setup lang="ts">
const props = defineProps<{
    activeTab: 'courses' | 'live-sessions' | 'school-calendar' | 'account';
    nouToolsEnabled?: boolean;
}>();
</script>

<template>
    <nav class="hidden md:block">
        <div
            class="z-90 mx-auto flex max-w-lg items-center gap-2 rounded-2xl border border-theme-200 bg-white/90 p-1 shadow dark:border-zinc-700 dark:bg-zinc-900/90"
        >
            <router-link
                to="/courses"
                class="inline-flex flex-1 items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold transition"
                :class="{
                    'bg-theme-800 text-white dark:bg-zinc-600':
                        activeTab === 'courses',
                    'text-theme-700 hover:bg-theme-50 dark:text-zinc-300 dark:hover:bg-zinc-800':
                        activeTab !== 'courses',
                }"
            >
                我的課程
            </router-link>

            <router-link
                v-if="props.nouToolsEnabled !== false"
                to="/courses/live-sessions"
                class="inline-flex flex-1 items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold transition"
                :class="{
                    'bg-theme-800 text-white dark:bg-zinc-600':
                        activeTab === 'live-sessions',
                    'text-theme-700 hover:bg-theme-50 dark:text-zinc-300 dark:hover:bg-zinc-800':
                        activeTab !== 'live-sessions',
                }"
            >
                視訊面授
            </router-link>

            <router-link
                v-if="props.nouToolsEnabled !== false"
                to="/courses/school-calendar"
                class="inline-flex flex-1 items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold transition"
                :class="{
                    'bg-theme-800 text-white dark:bg-zinc-600':
                        activeTab === 'school-calendar',
                    'text-theme-700 hover:bg-theme-50 dark:text-zinc-300 dark:hover:bg-zinc-800':
                        activeTab !== 'school-calendar',
                }"
            >
                學校行事曆
            </router-link>

            <router-link
                to="/courses/account"
                class="inline-flex flex-1 items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold transition"
                :class="{
                    'bg-theme-800 text-white dark:bg-zinc-600':
                        activeTab === 'account',
                    'text-theme-700 hover:bg-theme-50 dark:text-zinc-300 dark:hover:bg-zinc-800':
                        activeTab !== 'account',
                }"
            >
                我的帳號
            </router-link>
        </div>
    </nav>
</template>

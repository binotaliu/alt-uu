<script setup lang="ts">
import {
    BriefcaseIcon,
    VideoCameraIcon,
    CalendarDaysIcon,
} from '@heroicons/vue/24/outline';
import { computed, ref, watch } from 'vue';

const props = defineProps<{
    activeTab: 'courses' | 'live-sessions' | 'school-calendar';
    nouToolsEnabled?: boolean;
}>();

const localActiveTab = ref<
    'courses' | 'live-sessions' | 'school-calendar' | null
>(null);
const isNavigationLocked = ref(false);
const showNouToolsModal = ref(false);

const activeTab = computed(() => localActiveTab.value ?? props.activeTab);

const onTabClick = (
    event: MouseEvent,
    target: 'courses' | 'live-sessions' | 'school-calendar',
) => {
    if (isNavigationLocked.value) {
        event.preventDefault();

        return;
    }

    // Check if NOU Tools is enabled for non-courses tabs
    if (target !== 'courses' && !props.nouToolsEnabled) {
        event.preventDefault();
        showNouToolsModal.value = true;

        return;
    }

    localActiveTab.value = target;
    isNavigationLocked.value = true;
};

const enableNouTools = async () => {
    try {
        const response = await fetch('/api/preferences/nou-tools', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ enabled: true }),
        });

        if (response.ok) {
            showNouToolsModal.value = false;
            // Reload the page to reflect the change
            window.location.reload();
        } else {
            alert('啟用失敗，請稍後重試');
        }
    } catch {
        alert('啟用失敗，請稍後重試');
    }
};

const closeModal = () => {
    showNouToolsModal.value = false;
};

watch(
    () => props.activeTab,
    () => {
        localActiveTab.value = null;
        isNavigationLocked.value = false;
    },
);
</script>

<template>
    <nav
        :class="[
            'fixed right-0 bottom-0 left-0 z-20 border-t border-warm-200 bg-white px-4 pt-2 pb-[max(var(--inset-bottom,0px),0.75rem)] [view-transition-name:mobile-bottom-nav] md:hidden dark:border-zinc-700 dark:bg-zinc-900',
            { 'pointer-events-none': isNavigationLocked },
        ]"
    >
        <div class="mx-auto grid max-w-xl grid-cols-3 gap-2">
            <router-link
                to="/courses"
                @click="onTabClick($event, 'courses')"
                class="inline-flex flex-col items-center gap-1 rounded-xl px-3 py-2 text-xs font-semibold transition md:text-sm"
                :class="{
                    'bg-warm-800 text-white dark:bg-zinc-600':
                        activeTab === 'courses',
                    'text-warm-700 hover:bg-warm-50 dark:text-zinc-300 dark:hover:bg-zinc-800':
                        activeTab !== 'courses',
                }"
                data-native-transition="lateral"
            >
                <BriefcaseIcon class="size-6" />
                我的課程
            </router-link>

            <component
                :is="props.nouToolsEnabled ? 'router-link' : 'button'"
                v-bind="
                    props.nouToolsEnabled
                        ? { to: '/courses/live-sessions' }
                        : {}
                "
                @click="onTabClick($event, 'live-sessions')"
                class="inline-flex flex-col items-center gap-1 rounded-xl px-3 py-2 text-xs font-semibold transition md:text-sm"
                :class="{
                    'bg-warm-800 text-white dark:bg-zinc-600':
                        activeTab === 'live-sessions',
                    'text-warm-700 hover:bg-warm-50 dark:text-zinc-300 dark:hover:bg-zinc-800':
                        activeTab !== 'live-sessions',
                }"
                data-native-transition="lateral"
            >
                <VideoCameraIcon class="size-6" />
                視訊面授
            </component>

            <component
                :is="props.nouToolsEnabled ? 'router-link' : 'button'"
                v-bind="
                    props.nouToolsEnabled
                        ? { to: '/courses/school-calendar' }
                        : {}
                "
                @click="onTabClick($event, 'school-calendar')"
                class="inline-flex flex-col items-center gap-1 rounded-xl px-3 py-2 text-xs font-semibold transition md:text-sm"
                :class="{
                    'bg-warm-800 text-white dark:bg-zinc-600':
                        activeTab === 'school-calendar',
                    'text-warm-700 hover:bg-warm-50 dark:text-zinc-300 dark:hover:bg-zinc-800':
                        activeTab !== 'school-calendar',
                }"
                data-native-transition="lateral"
            >
                <CalendarDaysIcon class="size-6" />
                學校行事曆
            </component>
        </div>
    </nav>

    <!-- NOU Tools disabled modal -->
    <teleport to="body" v-if="showNouToolsModal">
        <div
            class="bg-opacity-50 fixed inset-0 z-50 flex items-center justify-center bg-black"
        >
            <div
                class="mx-4 rounded-2xl bg-white p-6 shadow-lg dark:bg-zinc-800"
            >
                <h3
                    class="mb-2 text-lg font-semibold text-warm-900 dark:text-white"
                >
                    開啟 NOU 小幫手整合
                </h3>
                <p class="mb-6 text-sm text-warm-700 dark:text-zinc-300">
                    此功能需要開啟 NOU 小幫手整合才可使用。
                </p>
                <div class="flex gap-3">
                    <button
                        @click="closeModal"
                        class="flex-1 rounded-lg border border-warm-300 px-4 py-2 text-sm font-medium text-warm-700 transition hover:bg-warm-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-700"
                    >
                        取消
                    </button>
                    <button
                        @click="enableNouTools"
                        class="flex-1 rounded-lg bg-warm-800 px-4 py-2 text-sm font-medium text-white transition hover:bg-warm-900 dark:bg-zinc-600 dark:hover:bg-zinc-500"
                    >
                        開啟
                    </button>
                </div>
            </div>
        </div>
    </teleport>
</template>

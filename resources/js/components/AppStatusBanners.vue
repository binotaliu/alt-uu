<script setup lang="ts">
import {
    ArrowUpCircleIcon,
    ExclamationCircleIcon,
    ExclamationTriangleIcon,
    InformationCircleIcon,
    XMarkIcon,
} from '@heroicons/vue/24/outline';
import { Browser } from '#nativephp';
import { useAppStatusStore } from '@/stores/appStatus';

const store = useAppStatusStore();

const severityStyles: Record<
    string,
    { container: string; icon: typeof InformationCircleIcon }
> = {
    info: {
        container:
            'border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-100',
        icon: InformationCircleIcon,
    },
    warning: {
        container:
            'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100',
        icon: ExclamationTriangleIcon,
    },
    critical: {
        container:
            'border-red-300 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-100',
        icon: ExclamationCircleIcon,
    },
};

function stylesFor(severity: string) {
    return severityStyles[severity] ?? severityStyles.info;
}

function openInApp(url: string): void {
    try {
        Browser.inApp(url);
    } catch {
        window.open(url, '_blank', 'noopener');
    }
}

function openStore(url: string): void {
    try {
        Browser.open(url);
    } catch {
        window.open(url, '_blank', 'noopener');
    }
}
</script>

<template>
    <div
        v-if="store.update || store.announcements.length > 0"
        class="space-y-2 px-4 pt-3 md:px-6 md:pt-4"
    >
        <div
            v-if="store.update"
            role="status"
            class="flex items-start gap-3 rounded-xl border border-theme-300 bg-theme-50 px-4 py-3 text-theme-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
        >
            <ArrowUpCircleIcon class="mt-0.5 size-5 shrink-0" />
            <div class="min-w-0 flex-1">
                <p class="text-sm font-semibold">
                    {{
                        store.update.required
                            ? '請更新至最新版本'
                            : '有新版本可用'
                    }}
                </p>
                <p class="mt-0.5 text-sm">
                    {{
                        store.update.required
                            ? `目前的版本已不再支援，請更新至 ${store.update.latestVersion}。`
                            : `Alt UU ${store.update.latestVersion} 已推出。`
                    }}
                </p>
                <button
                    v-if="store.update.storeUrl"
                    type="button"
                    class="mt-2 rounded-lg bg-theme-700 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-theme-800 dark:bg-theme-800 dark:hover:bg-theme-700"
                    @click="openStore(store.update.storeUrl)"
                >
                    前往更新
                </button>
            </div>
            <button
                v-if="!store.update.required"
                type="button"
                aria-label="關閉"
                class="-m-1 shrink-0 rounded-full p-1 transition hover:bg-black/10 dark:hover:bg-white/10"
                @click="store.dismiss(store.update.dismissKey)"
            >
                <XMarkIcon class="size-5" />
            </button>
        </div>

        <div
            v-for="announcement in store.announcements"
            :key="announcement.dismissKey"
            role="status"
            class="flex items-start gap-3 rounded-xl border px-4 py-3"
            :class="stylesFor(announcement.severity).container"
        >
            <component
                :is="stylesFor(announcement.severity).icon"
                class="mt-0.5 size-5 shrink-0"
            />
            <div class="min-w-0 flex-1">
                <p class="text-sm font-semibold">{{ announcement.title }}</p>
                <p
                    v-if="announcement.body"
                    class="mt-0.5 text-sm whitespace-pre-line"
                >
                    {{ announcement.body }}
                </p>
                <button
                    v-if="announcement.url"
                    type="button"
                    class="mt-1 text-sm font-medium underline"
                    @click="openInApp(announcement.url)"
                >
                    了解更多
                </button>
            </div>
            <button
                v-if="announcement.dismissible"
                type="button"
                aria-label="關閉"
                class="-m-1 shrink-0 rounded-full p-1 transition hover:bg-black/10 dark:hover:bg-white/10"
                @click="store.dismiss(announcement.dismissKey)"
            >
                <XMarkIcon class="size-5" />
            </button>
        </div>
    </div>
</template>

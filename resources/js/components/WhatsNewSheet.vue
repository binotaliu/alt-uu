<script setup lang="ts">
import { computed, watch } from 'vue';
import { Browser } from '#nativephp';
import PremiumBadge from '@/components/PremiumBadge.vue';
import { useScrollLock } from '@/composables/useScrollLock';
import { useWhatsNew } from '@/composables/useWhatsNew';
import { findRelease, releases } from '@/lib/releaseNotes';
import { useAppConfigStore } from '@/stores/appConfig';

const { isOpen, close } = useWhatsNew();
const configStore = useAppConfigStore();

useScrollLock(isOpen);

// Development builds have no entry of their own, so fall back to the newest
// release rather than showing an empty sheet.
const release = computed(
    () => findRelease(configStore.appVersion) ?? releases[0],
);

const changelogBaseUrl =
    'https://alt-uu-statics.wcsvdzeimhwq.workers.dev/changelog';

async function openChangelog() {
    const changelogUrl = release.value
        ? `${changelogBaseUrl}?version=${encodeURIComponent(release.value.version)}`
        : changelogBaseUrl;

    try {
        const handled = await Browser.inApp(changelogUrl);

        if (!handled) {
            window.open(changelogUrl, '_blank', 'noopener,noreferrer');
        }
    } catch {
        window.open(changelogUrl, '_blank', 'noopener,noreferrer');
    }
}

watch(isOpen, async (open) => {
    if (!open) {
        return;
    }

    try {
        await Promise.all([
            configStore.loadConfig(),
            configStore.loadPreferences(),
        ]);

        if (
            findRelease(configStore.appVersion) &&
            configStore.whatsNewSeenVersion !== configStore.appVersion
        ) {
            await configStore.updatePreferences({
                whatsNewSeenVersion: configStore.appVersion,
            });
        }
    } catch {
        // Failing to record the visit only means the sheet shows again next launch.
    }
});
</script>

<template>
    <Teleport to="body">
        <Transition
            enter-active-class="transition duration-200 ease-out"
            enter-from-class="opacity-0"
            enter-to-class="opacity-100"
            leave-active-class="transition duration-150 ease-in"
            leave-from-class="opacity-100"
            leave-to-class="opacity-0"
        >
            <div
                v-if="isOpen && release"
                class="fixed inset-0 z-400 flex items-end justify-center bg-black/40 p-4 pb-[max(var(--inset-bottom,0px),1rem)] backdrop-blur-xs md:items-center"
                @click.self="close"
            >
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="whats-new-title"
                    class="flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-3xl bg-white shadow-xl dark:bg-zinc-900"
                >
                    <div class="overflow-y-auto overscroll-contain px-6 pt-8">
                        <div class="text-center">
                            <p
                                class="text-sm font-semibold text-theme-700 dark:text-theme-400"
                            >
                                v{{ release.version }}
                            </p>
                            <h2
                                id="whats-new-title"
                                class="mt-1 text-2xl font-extrabold text-zinc-900 dark:text-zinc-50"
                            >
                                Alt UU 有新功能了
                            </h2>
                        </div>

                        <ul class="mt-8 space-y-6 pb-2">
                            <li
                                v-for="highlight in release.highlights"
                                :key="highlight.title"
                                class="flex items-start gap-4"
                            >
                                <span
                                    class="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-theme-100 text-theme-700 dark:bg-theme-900/40 dark:text-theme-400"
                                >
                                    <component
                                        :is="highlight.icon"
                                        class="size-6"
                                    />
                                </span>
                                <div class="pt-0.5">
                                    <div class="flex items-center gap-2">
                                        <h3
                                            class="text-base font-semibold text-zinc-900 dark:text-zinc-100"
                                        >
                                            {{ highlight.title }}
                                        </h3>
                                        <PremiumBadge v-if="highlight.plus" />
                                    </div>
                                    <p
                                        class="mt-0.5 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400"
                                    >
                                        {{ highlight.description }}
                                    </p>
                                </div>
                            </li>
                        </ul>
                    </div>

                    <div class="flex flex-col gap-2 px-6 pt-4 pb-6">
                        <button
                            type="button"
                            class="inline-flex h-12 w-full items-center justify-center rounded-2xl bg-theme-800 px-5 text-sm font-semibold text-white transition hover:bg-theme-900 dark:hover:bg-theme-700"
                            @click="close"
                        >
                            好
                        </button>
                        <button
                            type="button"
                            class="inline-flex h-10 w-full items-center justify-center rounded-2xl text-sm font-medium text-theme-700 transition hover:bg-theme-50 dark:text-theme-400 dark:hover:bg-zinc-800"
                            @click="openChangelog"
                        >
                            完整版本更新說明
                        </button>
                    </div>
                </div>
            </div>
        </Transition>
    </Teleport>
</template>

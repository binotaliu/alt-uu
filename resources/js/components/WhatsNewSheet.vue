<script setup lang="ts">
import { CheckCircleIcon, SparklesIcon } from '@heroicons/vue/24/outline';
import { computed, watch } from 'vue';
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

const generalNotes = computed(
    () => release.value?.notes.filter((note) => !note.plus) ?? [],
);
const plusNotes = computed(
    () => release.value?.notes.filter((note) => note.plus) ?? [],
);

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
                    <div class="overflow-y-auto overscroll-contain px-5 pt-6">
                        <div
                            class="flex flex-col items-center gap-1 text-center text-theme-700 dark:text-theme-300"
                        >
                            <SparklesIcon class="size-12" />
                            <h2
                                id="whats-new-title"
                                class="text-xl font-extrabold"
                            >
                                Alt UU 有新功能了
                            </h2>
                            <p class="text-sm font-semibold">
                                v{{ release.version }}
                            </p>
                        </div>

                        <section v-if="generalNotes.length > 0" class="mt-5">
                            <h3
                                class="text-sm font-semibold text-theme-900 dark:text-zinc-100"
                            >
                                更新內容
                            </h3>
                            <ul class="mt-3 space-y-3">
                                <li
                                    v-for="note in generalNotes"
                                    :key="note.text"
                                    class="flex items-start gap-3"
                                >
                                    <CheckCircleIcon
                                        class="mt-0.5 size-5 shrink-0 text-theme-700 dark:text-theme-400"
                                    />
                                    <span
                                        class="text-sm leading-relaxed text-theme-800 dark:text-zinc-300"
                                        >{{ note.text }}</span
                                    >
                                </li>
                            </ul>
                        </section>

                        <section
                            v-if="plusNotes.length > 0"
                            class="mt-5 rounded-xl border border-amber-200 p-4 dark:border-amber-900/50"
                        >
                            <div class="flex items-center gap-2">
                                <h3
                                    class="text-sm font-semibold text-theme-900 dark:text-zinc-100"
                                >
                                    Alt UU+ 專屬功能
                                </h3>
                                <PremiumBadge />
                            </div>
                            <ul class="mt-3 space-y-3">
                                <li
                                    v-for="note in plusNotes"
                                    :key="note.text"
                                    class="flex items-start gap-3"
                                >
                                    <CheckCircleIcon
                                        class="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400"
                                    />
                                    <span
                                        class="text-sm leading-relaxed text-theme-800 dark:text-zinc-300"
                                        >{{ note.text }}</span
                                    >
                                </li>
                            </ul>
                        </section>
                    </div>

                    <div class="px-5 pt-4 pb-5">
                        <button
                            type="button"
                            class="inline-flex h-12 w-full items-center justify-center rounded-2xl bg-theme-800 px-5 text-sm font-semibold text-white transition hover:bg-theme-900 dark:hover:bg-theme-700"
                            @click="close"
                        >
                            知道了
                        </button>
                    </div>
                </div>
            </div>
        </Transition>
    </Teleport>
</template>

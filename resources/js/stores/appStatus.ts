import { defineStore } from 'pinia';
import { ref } from 'vue';
import { apiFetch } from '@/composables/useApi';

type AppStatus = AltUU.Domains.AppStatus.ViewModels.AppStatusViewModel;
type AppUpdate = AltUU.Domains.AppStatus.ViewModels.AppUpdateViewModel;
type Announcement = AltUU.Domains.AppStatus.ViewModels.AnnouncementViewModel;

export const useAppStatusStore = defineStore('appStatus', () => {
    const update = ref<AppUpdate | null>(null);
    const announcements = ref<Announcement[]>([]);

    function apply(status: AppStatus): void {
        update.value = status.update;
        announcements.value = status.announcements;
    }

    async function load(): Promise<void> {
        try {
            apply(await apiFetch<AppStatus>('/api/app-status'));
        } catch {
            // Purely informational: a failed check must never get in the way
            // of the screen it is decorating, so show nothing.
        }
    }

    async function dismiss(dismissKey: string): Promise<void> {
        // Close it right away; the request only makes that stick for next time.
        if (update.value?.dismissKey === dismissKey) {
            update.value = null;
        }

        announcements.value = announcements.value.filter(
            (announcement) => announcement.dismissKey !== dismissKey,
        );

        try {
            await apiFetch<AppStatus>('/api/app-status/dismissals', {
                method: 'POST',
                body: JSON.stringify({ dismissKey }),
            });
        } catch {
            // Worst case it comes back on the next launch.
        }
    }

    return { update, announcements, load, dismiss };
});

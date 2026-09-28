import { useAccountsStore } from '@/stores/accounts';
import { useAppConfigStore } from '@/stores/appConfig';
import { useCourseStore } from '@/stores/courses';
import { useDiscussStore } from '@/stores/discuss';
import { useModerationStore } from '@/stores/moderation';

export async function refreshAppStateAfterAccountChange(): Promise<void> {
    useModerationStore().reset();
    useDiscussStore().reset();

    const courseStore = useCourseStore();
    courseStore.reset();

    await Promise.all([
        useAppConfigStore().loadConfig(true),
        useAppConfigStore().loadProfile(true),
    ]);

    // Best-effort: a failure here shouldn't block the switch from completing
    // — CoursesPane reads the store's own error state and surfaces it.
    await courseStore.loadCourses(true).catch(() => {});
}

export function useAccountSwitcher() {
    const accountsStore = useAccountsStore();

    async function switchAccount(accountId: number): Promise<void> {
        await accountsStore.switchAccount(accountId);
        await refreshAppStateAfterAccountChange();
    }

    return { switchAccount };
}

import { useModerationStore } from '@/stores/moderation';

export function useModeration() {
    const store = useModerationStore();

    return {
        blockedUsers: store.blockedUsers,
        isSyncing: store.isSyncing,
        syncBlockedContents: store.syncBlockedContents,
        reportContent: store.reportContent,
        blockUser: store.blockUser,
        unblockUser: store.unblockUser,
        loadBlockedUsers: store.loadBlockedUsers,
        isUserBlocked: store.isUserBlocked,
        getReasonLabel: store.getReasonLabel,
    };
}

import { defineStore } from 'pinia';
import { ref } from 'vue';
import { apiFetch } from '@/composables/useApi';

interface BlockedUserItem {
    poster: string;
    realname: string;
}

export const REASON_LABELS: Record<string, string> = {
    s: '垃圾訊息',
    i: '不適當的內容',
    c: '受版權保護的內容',
    p: '散播個人資訊',
    l: '違法內容',
    m: '偽冒他人',
    o: '其他',
};

export const REPORT_REASONS = [
    { value: 's', label: '垃圾訊息' },
    { value: 'i', label: '不適當的內容' },
    { value: 'c', label: '受版權保護的內容' },
    { value: 'p', label: '散播個人資訊' },
    { value: 'l', label: '違法內容' },
    { value: 'm', label: '偽冒他人' },
    { value: 'o', label: '其他' },
] as const;

export const useModerationStore = defineStore('moderation', () => {
    const blockedUsers = ref<BlockedUserItem[]>([]);
    const isSyncing = ref(false);

    async function syncBlockedContents(): Promise<void> {
        if (isSyncing.value) {
            return;
        }

        isSyncing.value = true;

        try {
            await apiFetch('/api/moderation/sync', { method: 'POST' });
        } catch {
            // Sync failures are non-critical
        } finally {
            isSyncing.value = false;
        }
    }

    async function reportContent(
        boardId: string,
        nodeId: string,
        content: string,
        type: string,
    ): Promise<boolean> {
        const result = await apiFetch<{ ok: boolean }>(
            '/api/moderation/report',
            {
                method: 'POST',
                body: JSON.stringify({
                    board_id: boardId,
                    node_id: nodeId,
                    content,
                    type,
                }),
            },
        );

        return result.ok;
    }

    async function blockUser(poster: string, realname: string): Promise<void> {
        await apiFetch('/api/moderation/block-user', {
            method: 'POST',
            body: JSON.stringify({ poster, realname }),
        });

        if (
            !blockedUsers.value.some(
                (u) => u.poster === poster && u.realname === realname,
            )
        ) {
            blockedUsers.value = [...blockedUsers.value, { poster, realname }];
        }
    }

    async function unblockUser(
        poster: string,
        realname: string,
    ): Promise<void> {
        await apiFetch('/api/moderation/block-user', {
            method: 'DELETE',
            body: JSON.stringify({ poster, realname }),
        });

        blockedUsers.value = blockedUsers.value.filter(
            (u) => !(u.poster === poster && u.realname === realname),
        );
    }

    async function loadBlockedUsers(): Promise<void> {
        blockedUsers.value = await apiFetch<BlockedUserItem[]>(
            '/api/moderation/blocked-users',
        );
    }

    function isUserBlocked(
        poster: string | null | undefined,
        realname: string | null | undefined,
    ): boolean {
        if (!poster || !realname) {
            return false;
        }

        return blockedUsers.value.some(
            (u) => u.poster === poster && u.realname === realname,
        );
    }

    function getReasonLabel(reason: string): string {
        return REASON_LABELS[reason] ?? '其他';
    }

    function reset(): void {
        blockedUsers.value = [];
        isSyncing.value = false;
    }

    return {
        blockedUsers,
        isSyncing,
        syncBlockedContents,
        reportContent,
        blockUser,
        unblockUser,
        loadBlockedUsers,
        isUserBlocked,
        getReasonLabel,
        reset,
    };
});

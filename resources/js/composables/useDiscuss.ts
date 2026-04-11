import { ref } from 'vue';
import { useDiscussStore } from '@/stores/discuss';
import type { DiscussData } from '@/types';

interface FetchDiscussOptions {
    includeCourses?: boolean;
    force?: boolean;
}

export function useDiscuss() {
    const store = useDiscussStore();
    const data = ref<DiscussData | null>(null);
    const isLoading = ref(false);
    const error = ref<string | null>(null);

    async function fetchDiscuss(
        cid?: string,
        bid?: string,
        nid?: string,
        options: FetchDiscussOptions = {},
    ): Promise<void> {
        isLoading.value = true;
        error.value = null;

        try {
            const selectedCid = cid ?? '';
            const selectedBid = bid ?? '';
            const selectedNid = nid ?? '';
            const includeCourses = options.includeCourses !== false;
            const force = options.force === true;

            if (includeCourses) {
                await store.loadCourses(force);
            }

            if (selectedCid !== '') {
                await store.loadBoards(selectedCid, force);
            }

            if (selectedBid !== '') {
                await store.loadNodes(selectedCid, selectedBid, force);
            }

            if (selectedNid !== '') {
                await store.loadPosts(
                    selectedCid,
                    selectedBid,
                    selectedNid,
                    force,
                );
            }

            const thread = store.getThread(
                selectedCid,
                selectedBid,
                selectedNid,
            );

            data.value = {
                courses: includeCourses ? store.courses : [],
                selectedCid,
                boards: store.getBoards(selectedCid),
                selectedBid,
                nodes: store.getNodes(selectedCid, selectedBid),
                selectedNid,
                posts: thread,
            };
        } catch (e) {
            error.value = e instanceof Error ? e.message : '載入討論板失敗';
        } finally {
            isLoading.value = false;
        }
    }

    return {
        data,
        isLoading,
        error,
        fetchDiscuss,
        createPost: store.createPost,
        updatePost: store.updatePost,
        deletePost: store.deletePost,
        likePost: store.likePost,
        unlikePost: store.unlikePost,
        createWhisper: store.createWhisper,
        updateWhisper: store.updateWhisper,
        deleteWhisper: store.deleteWhisper,
        setForumRead: store.setForumRead,
    };
}

import { defineStore } from 'pinia';
import { ref } from 'vue';
import { apiFetch } from '@/composables/useApi';
import type {
    CourseItem,
    DiscussBoard,
    DiscussNode,
    DiscussPost,
    BoardListViewModel,
    NodeListViewModel,
    PostListViewModel,
} from '@/types';

interface DiscussCourseOption {
    courseId: string;
    title: string;
}

export const useDiscussStore = defineStore('discuss', () => {
    const courses = ref<DiscussCourseOption[]>([]);
    const boardsByCourse = ref<Record<string, DiscussBoard[]>>({});
    const nodesByBoard = ref<Record<string, DiscussNode[]>>({});
    const postsByThread = ref<Record<string, DiscussPost[]>>({});

    async function loadCourses(force = false): Promise<void> {
        if (!force && courses.value.length > 0) {
            return;
        }

        const rawCourses = await apiFetch<CourseItem[]>('/api/courses');

        courses.value = rawCourses.map((course) => ({
            courseId: course.courseId,
            title: course.name,
        }));
    }

    async function loadBoards(courseId: string, force = false): Promise<void> {
        if (courseId === '') {
            return;
        }

        if (!force && boardsByCourse.value[courseId] !== undefined) {
            return;
        }

        const params = new URLSearchParams({ cid: courseId });
        const payload = await apiFetch<BoardListViewModel>(
            `/api/discuss/boards?${params.toString()}`,
        );

        boardsByCourse.value = {
            ...boardsByCourse.value,
            [courseId]: payload.boards ?? [],
        };
    }

    async function loadNodes(
        courseId: string,
        boardId: string,
        force = false,
    ): Promise<void> {
        if (courseId === '' || boardId === '') {
            return;
        }

        const cacheKey = `${courseId}:${boardId}`;

        if (!force && nodesByBoard.value[cacheKey] !== undefined) {
            return;
        }

        const params = new URLSearchParams({ cid: courseId, bid: boardId });
        const payload = await apiFetch<NodeListViewModel>(
            `/api/discuss/nodes?${params.toString()}`,
        );

        nodesByBoard.value = {
            ...nodesByBoard.value,
            [cacheKey]: payload.nodes ?? [],
        };
    }

    async function loadPosts(
        courseId: string,
        boardId: string,
        nodeId: string,
        force = false,
    ): Promise<void> {
        if (courseId === '' || boardId === '' || nodeId === '') {
            return;
        }

        const cacheKey = `${courseId}:${boardId}:${nodeId}`;

        if (!force && postsByThread.value[cacheKey] !== undefined) {
            return;
        }

        const params = new URLSearchParams({
            cid: courseId,
            bid: boardId,
            nid: nodeId,
        });
        const payload = await apiFetch<PostListViewModel>(
            `/api/discuss/posts?${params.toString()}`,
        );

        postsByThread.value = {
            ...postsByThread.value,
            [cacheKey]: payload.posts ?? [],
        };
    }

    function getBoards(courseId: string): DiscussBoard[] {
        if (courseId === '') {
            return [];
        }

        return boardsByCourse.value[courseId] ?? [];
    }

    function getNodes(courseId: string, boardId: string): DiscussNode[] {
        if (courseId === '' || boardId === '') {
            return [];
        }

        return nodesByBoard.value[`${courseId}:${boardId}`] ?? [];
    }

    function getThread(
        courseId: string,
        boardId: string,
        nodeId: string,
    ): DiscussPost[] {
        if (courseId === '' || boardId === '' || nodeId === '') {
            return [];
        }

        return postsByThread.value[`${courseId}:${boardId}:${nodeId}`] ?? [];
    }

    async function createPost(
        boardId: string,
        subject: string,
        content: string,
        replyContent?: string,
        replyPostId?: string,
        attaches?: Array<Record<string, unknown>>,
    ): Promise<void> {
        const body: Record<string, unknown> = {
            bid: boardId,
            subject,
            content,
        };

        if (replyContent) {
            body.reply_content = replyContent;
        }

        if (replyPostId) {
            body.reply_post_id = replyPostId;
        }

        if (attaches) {
            body.attaches = attaches;
        }

        await apiFetch('/api/discuss/posts', {
            method: 'POST',
            body: JSON.stringify(body),
        });
    }

    async function updatePost(
        postId: string,
        subject?: string,
        content?: string,
        attaches?: Array<Record<string, unknown>>,
    ): Promise<void> {
        const body: Record<string, unknown> = {};

        if (subject !== undefined) {
            body.subject = subject;
        }

        if (content !== undefined) {
            body.content = content;
        }

        if (attaches !== undefined) {
            body.attaches = attaches;
        }

        await apiFetch(`/api/discuss/posts/${encodeURIComponent(postId)}`, {
            method: 'PATCH',
            body: JSON.stringify(body),
        });
    }

    async function deletePost(postId: string): Promise<void> {
        await apiFetch(`/api/discuss/posts/${encodeURIComponent(postId)}`, {
            method: 'DELETE',
        });
    }

    async function likePost(boardId: string, nodeId: string): Promise<void> {
        await apiFetch(
            `/api/discuss/posts/${encodeURIComponent(nodeId)}/like`,
            {
                method: 'POST',
                body: JSON.stringify({ bid: boardId }),
            },
        );
    }

    async function unlikePost(boardId: string, nodeId: string): Promise<void> {
        await apiFetch(
            `/api/discuss/posts/${encodeURIComponent(nodeId)}/unlike`,
            {
                method: 'POST',
                body: JSON.stringify({ bid: boardId }),
            },
        );
    }

    async function createWhisper(
        boardId: string,
        nodeId: string,
        content: string,
    ): Promise<void> {
        await apiFetch('/api/discuss/whispers', {
            method: 'POST',
            body: JSON.stringify({ bid: boardId, nid: nodeId, content }),
        });
    }

    async function updateWhisper(
        whisperId: string,
        boardId: string,
        nodeId: string,
        content: string,
    ): Promise<void> {
        await apiFetch(
            `/api/discuss/whispers/${encodeURIComponent(whisperId)}`,
            {
                method: 'PATCH',
                body: JSON.stringify({ bid: boardId, nid: nodeId, content }),
            },
        );
    }

    async function deleteWhisper(
        whisperId: string,
        boardId: string,
        nodeId: string,
    ): Promise<void> {
        await apiFetch(
            `/api/discuss/whispers/${encodeURIComponent(whisperId)}`,
            {
                method: 'DELETE',
                body: JSON.stringify({ bid: boardId, nid: nodeId }),
            },
        );
    }

    function clearCourseBoards(courseId: string): void {
        if (!courseId || boardsByCourse.value[courseId] === undefined) {
            return;
        }

        const updatedBoards = { ...boardsByCourse.value };
        delete updatedBoards[courseId];
        boardsByCourse.value = updatedBoards;
    }

    function clearBoardNodes(courseId: string, boardId: string): void {
        if (!courseId || !boardId) {
            return;
        }

        const cacheKey = `${courseId}:${boardId}`;

        if (nodesByBoard.value[cacheKey] === undefined) {
            return;
        }

        const updatedNodes = { ...nodesByBoard.value };
        delete updatedNodes[cacheKey];
        nodesByBoard.value = updatedNodes;
    }

    function clearThreadPosts(
        courseId: string,
        boardId: string,
        nodeId: string,
    ): void {
        if (!courseId || !boardId || !nodeId) {
            return;
        }

        const cacheKey = `${courseId}:${boardId}:${nodeId}`;

        if (postsByThread.value[cacheKey] === undefined) {
            return;
        }

        const updatedPosts = { ...postsByThread.value };
        delete updatedPosts[cacheKey];
        postsByThread.value = updatedPosts;
    }

    async function setForumRead(
        courseId: string,
        boardId: string,
        nodeId: string,
    ): Promise<void> {
        await apiFetch(`/api/discuss/read/${encodeURIComponent(nodeId)}`, {
            method: 'POST',
        });

        clearCourseBoards(courseId);
        clearBoardNodes(courseId, boardId);
        clearThreadPosts(courseId, boardId, nodeId);

        // Keep the board listing fresh for immediate return navigation.
        await loadBoards(courseId, true);
        await loadNodes(courseId, boardId, true);
    }

    function reset(): void {
        courses.value = [];
        boardsByCourse.value = {};
        nodesByBoard.value = {};
        postsByThread.value = {};
    }

    return {
        courses,
        loadCourses,
        loadBoards,
        loadNodes,
        loadPosts,
        createPost,
        updatePost,
        deletePost,
        likePost,
        unlikePost,
        createWhisper,
        updateWhisper,
        deleteWhisper,
        setForumRead,
        getBoards,
        getNodes,
        getThread,
        reset,
    };
});

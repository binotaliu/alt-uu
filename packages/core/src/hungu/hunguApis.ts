import type { QueryValue } from '../http/encoding';
import type { AccountId } from '../session/types';
import type { HunguClient } from './hunguClient';
import type {
    HunguFetchHandoff,
    HunguPageResult,
    HunguPayloadResult,
} from './types';

/** Port of legacy UUCourseClient. */
export class HunguCourseClient {
    constructor(private readonly client: HunguClient) {}

    fetchCourseList(accountId?: AccountId): Promise<HunguPayloadResult> {
        return this.client.request('my-course-list', {
            params: { offset: 0, pagesize: 100 },
            accountId,
        });
    }

    fetchCoursePathInfo(cid: string): Promise<HunguPayloadResult> {
        return this.client.request('my-course-path-info', { params: { cid } });
    }

    fetchCourseNodeResources(
        cid: string,
        scoid: string,
    ): Promise<HunguPayloadResult> {
        return this.client.request('course-node-resources', {
            params: { cid, scoid },
        });
    }

    goCourse(cid: string): Promise<HunguPayloadResult> {
        return this.client.request('go-course', { params: { cid } });
    }

    fetchHomeworkPage(): Promise<HunguPageResult> {
        return this.client.fetchCourseHomeworkPage();
    }

    fetchSelfExamPage(): Promise<HunguPageResult> {
        return this.client.fetchCourseSelfExamPage();
    }

    fetchLearningTimePage(cid: string): Promise<HunguPageResult> {
        return this.client.fetchCourseLearningTimePage(cid);
    }

    fetchPendingHomeworkPage(): Promise<HunguPageResult> {
        return this.client.fetchPendingHomeworkPage();
    }

    fetchUnreadArticlesPage(): Promise<HunguPageResult> {
        return this.client.fetchUnreadArticlesPage();
    }

    fetchCoursePathTree(): Promise<HunguPageResult> {
        return this.client.fetchCoursePathTree();
    }

    fetchMaterialContent(url: string): Promise<HunguPageResult> {
        return this.client.fetchMaterialContent(url);
    }

    probeContentType(url: string): ReturnType<HunguClient['probeContentType']> {
        return this.client.probeContentType(url);
    }

    materialFetchHandoff(url: string): Promise<HunguFetchHandoff> {
        return this.client.materialFetchHandoff(url);
    }

    setCookie(name: string, value: string): Promise<void> {
        return this.client.setCookie(name, value);
    }
}

/** Port of legacy UUDiscussClient. */
export class HunguDiscussClient {
    constructor(private readonly client: HunguClient) {}

    fetchBoardList(courseId: string): Promise<HunguPayloadResult> {
        return this.client.request('get-board-list', {
            params: { cid: courseId, include: 1 },
        });
    }

    fetchBoardNodeList(
        boardId: string,
        keyword = '',
    ): Promise<HunguPayloadResult> {
        return this.client.request('get-board-node-list', {
            params: { offset: 0, size: 50, bid: boardId, keyword },
        });
    }

    fetchBoardReplyList(
        boardId: string,
        nodeId: string,
    ): Promise<HunguPayloadResult> {
        return this.client.request('get-board-reply-list', {
            params: { offset: 0, size: 50, bid: boardId, nid: nodeId },
        });
    }

    fetchWhispers(
        boardId: string,
        nodeId: string,
    ): Promise<HunguPayloadResult> {
        return this.client.request('board-whisper-handler', {
            params: { bid: boardId, nid: nodeId, act: 'get' },
        });
    }

    createPost(post: {
        boardId: string;
        subject: string;
        content: string;
        replyContent?: string | null;
        replyPostId?: string | null;
        attaches?: QueryValue[];
    }): Promise<HunguPayloadResult> {
        return this.client.request('add-course-post', {
            method: 'POST',
            body: withoutNull({
                board_id: post.boardId,
                subject: post.subject,
                content: post.content,
                reply_content: post.replyContent ?? null,
                // Legacy always sent this, even as `{bid}_` without a reply.
                reply_post_id: `${post.boardId}_${post.replyPostId ?? ''}`,
                attaches: post.attaches ?? [],
            }),
            bodyType: 'json',
        });
    }

    updatePost(post: {
        postId: string;
        subject?: string | null;
        content?: string | null;
        attaches?: QueryValue[];
    }): Promise<HunguPayloadResult> {
        return this.client.request('mod-course-post', {
            method: 'POST',
            body: withoutNull({
                post_id: post.postId,
                subject: post.subject ?? null,
                content: post.content ?? null,
                attaches: post.attaches ?? [],
            }),
            bodyType: 'json',
        });
    }

    deletePost(postId: string): Promise<HunguPayloadResult> {
        return this.client.request('del-course-post', {
            params: { post_id: postId },
        });
    }

    createWhisper(
        boardId: string,
        nodeId: string,
        content: string,
    ): Promise<HunguPayloadResult> {
        return this.client.request('board-whisper-handler', {
            method: 'POST',
            params: { act: 'set' },
            body: { bid: boardId, nid: nodeId, content },
            bodyType: 'json',
        });
    }

    updateWhisper(
        boardId: string,
        nodeId: string,
        whisperId: string,
        content: string,
    ): Promise<HunguPayloadResult> {
        return this.client.request('board-whisper-handler', {
            method: 'POST',
            params: { act: 'mod' },
            body: { bid: boardId, nid: nodeId, wid: whisperId, content },
            bodyType: 'json',
        });
    }

    deleteWhisper(
        boardId: string,
        nodeId: string,
        whisperId: string,
    ): Promise<HunguPayloadResult> {
        return this.client.request('board-whisper-handler', {
            method: 'POST',
            params: { act: 'del' },
            body: { bid: boardId, nid: nodeId, wid: whisperId },
            bodyType: 'json',
        });
    }

    likePost(boardId: string, nodeId: string): Promise<HunguPayloadResult> {
        return this.setPush(boardId, nodeId, 1);
    }

    unlikePost(boardId: string, nodeId: string): Promise<HunguPayloadResult> {
        return this.setPush(boardId, nodeId, 0);
    }

    setForumRead(postId: string): Promise<HunguPayloadResult> {
        return this.client.request('set-forum-read', {
            params: { postid: postId },
        });
    }

    private setPush(
        boardId: string,
        nodeId: string,
        firstPush: 0 | 1,
    ): Promise<HunguPayloadResult> {
        return this.client.requestOnPath('/mooc/controllers/forum_ajax.php', {
            method: 'POST',
            body: {
                bid: boardId,
                nid: nodeId,
                sid: 1000110001,
                action: 'setPush',
                firstPush,
            },
            bodyType: 'form',
        });
    }
}

/** Port of legacy UUStudyTimeClient. */
export class HunguStudyTimeClient {
    constructor(private readonly client: HunguClient) {}

    fetchServerTime(): Promise<HunguPayloadResult> {
        return this.client.request('get-server-time');
    }

    recordStudyTime(
        payload: Record<string, QueryValue>,
    ): Promise<HunguPayloadResult> {
        return this.client.request('set-read-node-history', {
            method: 'POST',
            body: payload,
        });
    }
}

function withoutNull(
    values: Record<string, QueryValue>,
): Record<string, QueryValue> {
    return Object.fromEntries(
        Object.entries(values).filter(([, value]) => value !== null),
    );
}

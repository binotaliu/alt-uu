import { beforeEach, describe, expect, it } from 'vitest';

import { blockedContents } from '../../db/schema';
import { createFakeFetch, InMemorySessionStore } from '../../http/testing';
import { defaultHunguConfig } from '../../hungu/config';
import { HunguDiscussClient } from '../../hungu/hunguApis';
import { HunguClient } from '../../hungu/hunguClient';
import type { HunguSessionData } from '../../hungu/types';
import { UUCrypto } from '../../hungu/uuCrypto';
import type { HunguSession } from '../../session/types';
import {
    loadExpected,
    loadFixture,
    loadFixtureJson,
    loadGolden,
} from '../../../test/fixtures';
import { createTestContext, type TestContext } from '../../../test/db/helpers';
import { UserFacingHttpError } from '../../errors/errors';
import { sha256Hex } from './blockedContents';
import { createDiscussServices } from './discussServices';

const session = (): HunguSessionData => ({
    baseUrl: 'https://uu.nou.edu.tw/xmlapi/index.php',
    userAgent: 'test-agent',
    ticket: 'ticket-1',
    session_idx: 'idx-1',
    cookies: {},
});

/** Stand-in for HTMLPurifier: strips scripts and auto-paragraphs bare text. */
const fakeSanitizeHtml = (html: string): string => {
    const stripped = html.replace(/<script[\s\S]*?<\/script>/gi, '');

    return /^<p>/.test(stripped) ? stripped : `<p>${stripped}</p>`;
};

describe('discuss services', () => {
    let ctx: TestContext;

    beforeEach(async () => {
        ctx = await createTestContext();
    });

    const setup = (routes: Parameters<typeof createFakeFetch>[0]) => {
        const store = new InMemorySessionStore<HunguSession>(1);
        void store.put(session());
        const fake = createFakeFetch(routes);
        const client = new HunguClient({
            fetch: fake.fetch,
            sessionStore: store,
            config: defaultHunguConfig,
            crypto: new UUCrypto(),
        });
        const services = createDiscussServices({
            client: new HunguDiscussClient(client),
            db: ctx.db,
            sanitizeHtml: fakeSanitizeHtml,
        });

        return { services, requests: fake.requests };
    };

    const block = async (boardId: string, nodeId: string, reason: string) => {
        await ctx.db.insert(blockedContents).values({
            boardHash: sha256Hex(boardId),
            nodeHash: sha256Hex(nodeId),
            reason,
            blockedAt: new Date(),
        });
    };

    it('lists boards (golden)', async () => {
        const { services, requests } = setup([
            [
                '*action=get-board-list*',
                { body: loadFixture('discuss', 'boards-list') },
            ],
        ]);
        const golden = loadGolden('discuss', 'boards-list').cases[0];

        expect(await services.listBoards('1001')).toEqual(
            (golden.output as { json: unknown }).json,
        );
        expect(requests).toHaveLength(1);
        expect(requests[0].url).toContain('cid=1001&include=1');
    });

    it('maps node read state', async () => {
        const { services, requests } = setup([
            [
                '*action=get-board-node-list*',
                { body: loadFixture('discuss', 'nodes-read-state') },
            ],
        ]);
        const golden = loadGolden('discuss', 'nodes-read-state').cases[0];
        const result = await services.listNodes('1001', 'B-1', '');

        expect(result).toEqual((golden.output as { json: unknown }).json);
        expect(result.nodes.map((node) => node.isRead)).toEqual([false, true]);
        expect(requests[0].url).toContain('offset=0&size=50&bid=B-1');
    });

    it('marks blocked nodes and posts', async () => {
        await block('B-1', 'N-1', 'c');
        const nodes = setup([
            [
                '*action=get-board-node-list*',
                { body: loadFixture('discuss', 'nodes-blocked') },
            ],
        ]);
        const result = await nodes.services.listNodes('1001', 'B-1');
        const expectedNodes = loadExpected('discuss', 'nodes-blocked').cases[0]
            .expected as Record<string, object>;

        expect(result.nodes[0]).toMatchObject(expectedNodes['nodes[0]']);
        expect(result.nodes[1]).toMatchObject(expectedNodes['nodes[1]']);

        await block('B-1', 'P-2', 'i');
        const posts = setup([
            [
                '*action=get-board-reply-list*',
                { body: loadFixture('discuss', 'posts-blocked') },
            ],
        ]);
        const postResult = await posts.services.listPosts(
            '1001',
            'B-1',
            'N-99',
        );
        const expectedPosts = loadExpected('discuss', 'posts-blocked').cases[0]
            .expected as Record<string, object>;

        expect(postResult.posts[0]).toMatchObject(expectedPosts['posts[0]']);
        expect(postResult.posts[1]).toMatchObject(expectedPosts['posts[1]']);
    });

    it('fetches posts and whispers, sanitizing only post content (golden)', async () => {
        const { services, requests } = setup([
            [
                '*action=get-board-reply-list*',
                { body: loadFixture('discuss', 'posts-with-whispers.replies') },
            ],
            [
                '*action=board-whisper-handler*',
                {
                    body: loadFixture(
                        'discuss',
                        'posts-with-whispers.whispers',
                    ),
                },
            ],
        ]);
        const golden = loadGolden('discuss', 'posts-with-whispers').cases[0];

        expect(await services.listPosts('1001', 'B-1', 'N-99')).toEqual(
            (golden.output as { json: unknown }).json,
        );
        expect(requests[1].url).toContain('bid=B-1&nid=N-POST-1&act=get');
    });

    it('maps attachments (golden)', async () => {
        const { services } = setup([
            [
                '*action=get-board-reply-list*',
                { body: loadFixture('discuss', 'posts-attachments') },
            ],
        ]);
        const golden = loadGolden('discuss', 'posts-attachments').cases[0];

        expect(await services.listPosts('1001', 'B-1', 'N-9')).toEqual(
            (golden.output as { json: unknown }).json,
        );
    });

    it('sends the same upstream requests as legacy for every mutation', async () => {
        const fixture = loadFixtureJson<{
            upstreamResponses: Array<{ match: string; json: object }>;
        }>('discuss', 'mutations');
        const golden = loadGolden('discuss', 'mutations').cases.at(-1)!;
        const { services, requests } = setup(
            fixture.upstreamResponses.map(
                (reply) => [reply.match, { body: reply.json }] as const,
            ) as never,
        );

        const created = await services.createPost({
            boardId: 'B-1',
            subject: '新文章',
            content: '文章內容',
        });
        await services.updatePost('P-1', {
            subject: '更新標題',
            content: '更新內容',
        });
        await services.deletePost('P-1');
        await services.likePost('B-1', 'N-1');
        await services.unlikePost('B-1', 'N-1');
        await services.createWhisper('B-1', 'N-1', '留言');
        await services.updateWhisper('B-1', 'N-1', 'W-1', '編輯留言');
        await services.deleteWhisper('B-1', 'N-1', 'W-1');
        await services.setForumRead('P-1');

        expect(created).toMatchObject({ data: { post_id: 'P-1' } });
        expect(
            requests.map(({ method, url, body }) => ({ method, url, body })),
        ).toEqual(golden.upstreamRequests);
    });

    it('escapes and nl2br-encodes new post and whisper content', async () => {
        const { services, requests } = setup([['*', { body: { code: 0 } }]]);

        await services.createPost({
            boardId: 'B-1',
            subject: 's',
            content: ' <b>"hi" & \'x\'</b>\r\nline2\nline3 ',
            replyContent: 'quoted',
            replyPostId: 'P-9',
        });
        await services.createWhisper('B-1', 'N-1', 'a\nb');

        expect(JSON.parse(requests[0].body!)).toMatchObject({
            content:
                '&lt;b&gt;&quot;hi&quot; &amp; &#039;x&#039;&lt;/b&gt;<br />\r\nline2<br />\nline3',
            reply_content: 'quoted',
            reply_post_id: 'B-1_P-9',
        });
        expect(JSON.parse(requests[1].body!).content).toBe('a<br />\nb');
    });

    it('validates required input like the legacy controllers', async () => {
        const { services, requests } = setup([['*', { body: { code: 0 } }]]);
        const rejects = async (promise: Promise<unknown>, message: string) => {
            const error = await promise.catch((e: unknown) => e);

            expect(error).toBeInstanceOf(UserFacingHttpError);
            expect((error as UserFacingHttpError).status).toBe(400);
            expect((error as Error).message).toBe(message);
        };

        await rejects(services.listBoards(''), 'Course ID is required');
        await rejects(
            services.listNodes('1', ''),
            'Course ID and Board ID are required',
        );
        await rejects(
            services.listPosts('1', 'b', ''),
            'Course ID, Board ID, and Node ID are required',
        );
        await rejects(
            services.createPost({ boardId: 'b', subject: '  ', content: 'c' }),
            'bid, subject and content are required',
        );
        await rejects(
            services.updatePost('p', { subject: '', content: null }),
            'subject or content is required',
        );
        await rejects(services.deletePost(''), 'postId is required');
        await rejects(
            services.likePost('', 'n'),
            'bid and nodeId are required',
        );
        await rejects(
            services.createWhisper('b', 'n', ''),
            'bid, nid and content are required',
        );
        await rejects(
            services.updateWhisper('b', 'n', '', 'c'),
            'bid, nid, wid and content are required',
        );
        await rejects(
            services.deleteWhisper('b', 'n', ''),
            'bid, nid and wid are required',
        );
        await rejects(services.setForumRead(''), 'postId is required');
        expect(requests).toHaveLength(0);
    });
});

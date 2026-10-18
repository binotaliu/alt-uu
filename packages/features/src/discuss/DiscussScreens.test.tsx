import type {
    BoardListViewModel,
    NodeListViewModel,
    PostListViewModel,
    PostViewModel,
} from '@altuu/core';
import {
    act,
    fireEvent,
    render,
    screen,
    waitFor,
} from '@testing-library/react-native';
import { router } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppServicesProvider } from '../services';
import {
    createFakeServices,
    createTestQueryClient,
    resetStores,
} from '../testing/fakeServices';
import { DiscussBoardScreen } from './DiscussBoardScreen';
import { DiscussThreadScreen } from './DiscussThreadScreen';

jest.mock('@altuu/attachment-bridge', () =>
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('@altuu/attachment-bridge/mock'),
);

const metrics = {
    frame: { x: 0, y: 0, width: 390, height: 844 },
    insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

function post(overrides: Partial<PostViewModel> = {}): PostViewModel {
    return {
        floor: 1,
        node: 'p1',
        subject: '主題',
        content: '<p>第一則 <b>內容</b></p>',
        poster: 'u1',
        realname: '王小明',
        postDate: '2026-01-01',
        push: 2,
        liked: false,
        whisperCount: 0,
        whispers: [],
        attachments: [],
        isBlocked: false,
        blockedReason: null,
        ...overrides,
    };
}

function setup(
    options: {
        nodes?: NodeListViewModel['nodes'];
        posts?: PostViewModel[];
        blockedUsers?: Array<{ poster: string; realname: string }>;
    } = {},
) {
    const blockedUsers = [...(options.blockedUsers ?? [])];
    let posts = options.posts ?? [post()];
    const discuss = {
        listBoards: jest.fn(
            async (courseId: string): Promise<BoardListViewModel> => ({
                courseId,
                boards: [
                    {
                        boardId: 'b1',
                        boardName: '課程討論',
                        allowPost: true,
                        hasNewPost: false,
                        subjectCount: 1,
                    },
                ],
            }),
        ),
        listNodes: jest.fn(
            async (
                courseId: string,
                boardId: string,
            ): Promise<NodeListViewModel> => ({
                courseId,
                boardId,
                nodes: options.nodes ?? [],
            }),
        ),
        listPosts: jest.fn(
            async (
                courseId: string,
                boardId: string,
                nodeId: string,
            ): Promise<PostListViewModel> => ({
                courseId,
                boardId,
                nodeId,
                posts,
            }),
        ),
        createPost: jest.fn(async () => ({})),
        createWhisper: jest.fn(async () => ({})),
        likePost: jest.fn(async () => {
            posts = posts.map((item) => ({
                ...item,
                liked: true,
                push: item.push + 1,
            }));

            return {};
        }),
        unlikePost: jest.fn(async () => {
            posts = posts.map((item) => ({
                ...item,
                liked: false,
                push: item.push - 1,
            }));

            return {};
        }),
        setForumRead: jest.fn(async () => ({})),
    };
    const moderation = {
        getBlockedUsers: jest.fn(async () => [...blockedUsers]),
        blockUser: jest.fn(async (poster: string, realname: string) => {
            blockedUsers.push({ poster, realname });
        }),
        unblockUser: jest.fn(async (poster: string, realname: string) => {
            const index = blockedUsers.findIndex(
                (item) => item.poster === poster && item.realname === realname,
            );
            blockedUsers.splice(index, 1);
        }),
        reportContent: jest.fn(async () => true),
    };
    const course = {
        listCourses: jest.fn(async () => [
            { courseId: '10', name: '微積分', className: null },
        ]),
    };
    const { services } = createFakeServices();
    Object.assign(services, { discuss, moderation, course });
    const queryClient = createTestQueryClient({ staleTime: 60_000 });
    const wrap = (children: React.ReactNode) => (
        <SafeAreaProvider initialMetrics={metrics}>
            <AppServicesProvider
                services={services}
                queryClient={queryClient}
                router={{ push: jest.fn(), replace: jest.fn() }}
            >
                {children}
            </AppServicesProvider>
        </SafeAreaProvider>
    );

    return { discuss, moderation, wrap };
}

beforeEach(() => {
    resetStores();
    jest.clearAllMocks();
});

describe('DiscussBoardScreen', () => {
    const nodes: NodeListViewModel['nodes'] = [
        {
            node: 'n1',
            subject: '第一個主題',
            isRead: false,
            poster: '王小明',
            repliesCount: 3,
            likesCount: 2,
            isBlocked: false,
            blockedReason: null,
        },
        {
            node: 'n2',
            subject: '被隱藏的主題',
            isRead: true,
            poster: '某人',
            repliesCount: 0,
            likesCount: 0,
            isBlocked: true,
            blockedReason: 'i',
        },
    ];

    it('lists topics, hides blocked ones until revealed and opens a thread', async () => {
        const { wrap } = setup({ nodes });

        await render(
            wrap(<DiscussBoardScreen cid="10" boardCid="20" bid="b1" />),
        );

        expect(await screen.findByText('第一個主題')).toBeTruthy();
        expect(screen.getByText('未讀')).toBeTruthy();
        expect(screen.getByText('課程討論')).toBeTruthy();
        expect(screen.queryByText('被隱藏的主題')).toBeNull();
        expect(
            screen.getByText(/本內容經檢舉已在 Alt UU/, { exact: false }),
        ).toBeTruthy();
        expect(screen.getByText(/原因：不適當的內容。/)).toBeTruthy();

        await fireEvent.press(screen.getByText('仍要檢視'));
        expect(await screen.findByText('被隱藏的主題')).toBeTruthy();

        await fireEvent.press(screen.getByText('第一個主題'));
        expect(router.push).toHaveBeenCalledWith(
            '/courses/10/discuss/20/b1/n1',
        );
    });

    it('searches topics by keyword', async () => {
        const { wrap, discuss } = setup({ nodes });

        await render(
            wrap(<DiscussBoardScreen cid="10" boardCid="20" bid="b1" />),
        );
        await screen.findByText('第一個主題');

        const input = screen.getByLabelText('搜尋文章主題');
        await fireEvent.changeText(input, ' 作業 ');
        await fireEvent(input, 'submitEditing');

        await waitFor(() =>
            expect(discuss.listNodes).toHaveBeenLastCalledWith(
                '20',
                'b1',
                '作業',
            ),
        );
    });

    it('validates the new post and creates it with the default subject', async () => {
        const { wrap, discuss } = setup({ nodes });

        await render(
            wrap(<DiscussBoardScreen cid="10" boardCid="20" bid="b1" />),
        );
        await fireEvent.press(await screen.findByLabelText('新增文章'));
        await fireEvent.press(screen.getByText('送出文章'));

        expect(screen.getByText('請輸入內容。')).toBeTruthy();
        expect(discuss.createPost).not.toHaveBeenCalled();

        await fireEvent.changeText(screen.getByLabelText('內容'), '你好');
        await fireEvent.press(screen.getByText('送出文章'));

        await waitFor(() =>
            expect(discuss.createPost).toHaveBeenCalledWith({
                boardId: 'b1',
                subject: '新文章',
                content: '你好',
            }),
        );
    });

    it('shows the empty state', async () => {
        const { wrap } = setup({ nodes: [] });

        await render(
            wrap(<DiscussBoardScreen cid="10" boardCid="20" bid="b1" />),
        );

        expect(
            await screen.findByText('目前沒有可顯示的文章主題。'),
        ).toBeTruthy();
    });
});

describe('DiscussThreadScreen', () => {
    const renderThread = (wrap: ReturnType<typeof setup>['wrap']) =>
        render(
            wrap(
                <DiscussThreadScreen
                    cid="10"
                    boardCid="20"
                    bid="b1"
                    nid="p1"
                />,
            ),
        );

    it('renders sanitised post html natively and marks the thread read', async () => {
        const { wrap, discuss } = setup();

        await renderThread(wrap);

        expect(await screen.findByText('內容')).toBeTruthy();
        expect(screen.getByText(/樓層 1 · 王小明/)).toBeTruthy();
        await waitFor(() =>
            expect(discuss.setForumRead).toHaveBeenCalledWith('p1'),
        );
    });

    it('hides reported posts behind a notice with the reason', async () => {
        const { wrap } = setup({
            posts: [
                post({
                    isBlocked: true,
                    blockedReason: 's',
                    content: '<p>廣告內容</p>',
                }),
            ],
        });

        await renderThread(wrap);

        expect(await screen.findByText(/原因：垃圾訊息。/)).toBeTruthy();
        expect(screen.queryByText('廣告內容')).toBeNull();

        await fireEvent.press(screen.getByText('仍要檢視'));
        expect(await screen.findByText('廣告內容')).toBeTruthy();
    });

    it('hides posts of blocked users and lets the user unblock them', async () => {
        const { wrap, moderation } = setup({
            blockedUsers: [{ poster: 'u1', realname: '王小明' }],
        });

        await renderThread(wrap);

        expect(
            await screen.findByText(
                /由於你封鎖了名稱為「王小明」、帳號為「u1」的使用者/,
            ),
        ).toBeTruthy();
        expect(screen.queryByText('內容')).toBeNull();

        await fireEvent.press(screen.getByText('解除封鎖'));

        await waitFor(() =>
            expect(moderation.unblockUser).toHaveBeenCalledWith('u1', '王小明'),
        );
        expect(await screen.findByText('內容')).toBeTruthy();
    });

    it('waits for the block list before showing any post', async () => {
        const { wrap, moderation } = setup({
            blockedUsers: [{ poster: 'u1', realname: '王小明' }],
        });
        let releaseBlockList: () => void = () => undefined;
        moderation.getBlockedUsers.mockImplementationOnce(
            () =>
                new Promise((resolve) => {
                    releaseBlockList = () =>
                        resolve([{ poster: 'u1', realname: '王小明' }]);
                }),
        );

        await renderThread(wrap);

        await waitFor(() =>
            expect(moderation.getBlockedUsers).toHaveBeenCalled(),
        );
        expect(screen.queryByText('內容')).toBeNull();
        expect(screen.queryByText(/樓層 1/)).toBeNull();

        releaseBlockList();

        expect(
            await screen.findByText(
                /由於你封鎖了名稱為「王小明」、帳號為「u1」的使用者/,
            ),
        ).toBeTruthy();
        expect(screen.queryByText('內容')).toBeNull();
    });

    it('blocks a user after confirmation and hides their post', async () => {
        const { wrap, moderation } = setup();

        await renderThread(wrap);
        await fireEvent.press(await screen.findByText('封鎖使用者'));
        expect(screen.getByText(/確定要封鎖名稱為「王小明」/)).toBeTruthy();
        await fireEvent.press(screen.getByText('確定封鎖'));

        await waitFor(() =>
            expect(moderation.blockUser).toHaveBeenCalledWith('u1', '王小明'),
        );
        expect(
            await screen.findByText(/因此此內容已隱藏/, { exact: false }),
        ).toBeTruthy();
    });

    it('toggles likes optimistically and reloads the server state', async () => {
        const { wrap, discuss } = setup();

        await renderThread(wrap);
        await fireEvent.press(await screen.findByLabelText('讚'));

        expect(await screen.findByLabelText('取消讚')).toBeTruthy();
        expect(screen.getByText('3')).toBeTruthy();
        await waitFor(() =>
            expect(discuss.likePost).toHaveBeenCalledWith('b1', 'p1'),
        );
        await waitFor(() => expect(discuss.listPosts).toHaveBeenCalledTimes(2));

        await fireEvent.press(screen.getByLabelText('取消讚'));
        await waitFor(() =>
            expect(discuss.unlikePost).toHaveBeenCalledWith('b1', 'p1'),
        );
        expect(await screen.findByLabelText('讚')).toBeTruthy();
        expect(screen.getByText('2')).toBeTruthy();
    });

    it('validates a reply and posts it as a reply to the thread', async () => {
        const { wrap, discuss } = setup();

        await renderThread(wrap);
        await fireEvent.press(await screen.findByLabelText('新增回覆'));
        await fireEvent.press(screen.getByText('送出回覆'));

        expect(screen.getByText('請輸入內容。')).toBeTruthy();
        expect(discuss.createPost).not.toHaveBeenCalled();

        await fireEvent.changeText(screen.getByLabelText('內容'), '我的回覆');
        await fireEvent.press(screen.getByText('送出回覆'));

        await waitFor(() =>
            expect(discuss.createPost).toHaveBeenCalledWith({
                boardId: 'b1',
                subject: '回覆',
                content: '我的回覆',
                replyPostId: 'p1',
            }),
        );
    });

    it('creates a whisper on the chosen post', async () => {
        const { wrap, discuss } = setup({
            posts: [
                post(),
                post({ floor: 2, node: 'p2', content: '<p>第二則</p>' }),
            ],
        });

        await renderThread(wrap);
        const buttons = await screen.findAllByText('新增留言');
        await fireEvent.press(buttons[0]);
        expect(screen.getByText('留言於：樓層 2')).toBeTruthy();
        await fireEvent.changeText(screen.getByLabelText('留言內容'), ' 嗨 ');
        await fireEvent.press(screen.getByText('送出留言'));

        await waitFor(() =>
            expect(discuss.createWhisper).toHaveBeenCalledWith(
                'b1',
                'p2',
                '嗨',
            ),
        );
    });

    it('shows existing whispers as plain text', async () => {
        const { wrap } = setup({
            posts: [
                post({
                    whisperCount: 1,
                    whispers: [
                        {
                            wid: 'w1',
                            sid: null,
                            creator: 'u2',
                            realname: '李小華',
                            content: '第一行<br />\n第二行 &amp; 好',
                            createTime: '2026-01-02',
                            createTimeDescription: null,
                            canDelete: false,
                        },
                    ],
                }),
            ],
        });

        await renderThread(wrap);

        expect(await screen.findByText('第一行\n第二行 & 好')).toBeTruthy();
        expect(screen.getByText(/李小華/)).toBeTruthy();
    });

    it('reports a post with the chosen reason and confirms it', async () => {
        const { wrap, moderation } = setup();

        await renderThread(wrap);
        await fireEvent.press(await screen.findByText('檢舉'));

        const submit = screen.getByText('送出檢舉');
        await fireEvent.press(submit);
        expect(moderation.reportContent).not.toHaveBeenCalled();

        await fireEvent.press(screen.getByText('違法內容'));
        await fireEvent.press(screen.getByText('送出檢舉'));

        await waitFor(() =>
            expect(moderation.reportContent).toHaveBeenCalledWith({
                boardId: 'b1',
                nodeId: 'p1',
                content: '<p>第一則 <b>內容</b></p>',
                type: 'l',
            }),
        );
        expect(
            await screen.findByText('檢舉已送出，感謝你的回報。'),
        ).toBeTruthy();
    });

    it('shows a failure message when reporting fails', async () => {
        const { wrap, moderation } = setup();

        moderation.reportContent.mockRejectedValueOnce(new Error('boom'));
        await renderThread(wrap);
        await fireEvent.press(await screen.findByText('檢舉'));
        await fireEvent.press(screen.getByText('其他'));
        await act(async () => {
            await fireEvent.press(screen.getByText('送出檢舉'));
        });

        expect(
            await screen.findByText('檢舉送出失敗，請稍後再試。'),
        ).toBeTruthy();
    });
});

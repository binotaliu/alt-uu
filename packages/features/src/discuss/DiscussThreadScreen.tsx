import type {
    BlockedUserViewModel,
    PostViewModel,
    PostListViewModel,
    ReportType,
    WhisperViewModel,
} from '@altuu/core';
import { ConfirmDialog, Icon, PageHeader, Text } from '@altuu/ui';
import { useQueryClient } from '@tanstack/react-query';
import type { ImageSource } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import {
    FlatList,
    Pressable,
    RefreshControl,
    TextInput,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useServiceMutation } from '../services';
import { ErrorRetry } from '../shell';
import { AttachmentSection } from './components/AttachmentSection';
import { ComposeSheet } from './components/ComposeSheet';
import { GlyphIcon } from './components/GlyphIcon';
import { ImageLightbox } from './components/ImageLightbox';
import { PostHtml } from './components/PostHtml';
import { ReportSheet } from './components/ReportSheet';
import { getReasonLabel, isUserBlocked } from './moderation';
import {
    discussQueryKeys,
    useBlockedUsers,
    useBlockUser,
    useCourseTitle,
    useDiscussBoards,
    useDiscussNodes,
    useDiscussPosts,
    useReportContent,
    useUnblockUser,
} from './queries';

export interface DiscussThreadScreenProps {
    cid: string;
    boardCid: string;
    bid: string;
    nid: string;
}

const DEFAULT_REPLY_SUBJECT = '回覆';
const REPORT_CLOSE_DELAY_MS = 1500;

/** Legacy `decodeURIComponent`-free whisper text: nl2br / entity output back to plain text. */
export function whisperText(content: string | null): string {
    if (content === null || content === '') {
        return '（無內容）';
    }

    return content
        .replace(/<br\s*\/?>\r?\n?/gi, '\n')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#0?39;/g, "'")
        .replace(/&amp;/g, '&');
}

interface ReportTarget {
    nodeId: string;
    content: string;
}

interface WhisperTarget {
    nodeId: string;
    floor: number | null;
}

/** Legacy pages/Courses/DiscussThread.vue: posts of one topic with likes, whispers, reply, report and block. */
export function DiscussThreadScreen({
    cid,
    boardCid,
    bid,
    nid,
}: DiscussThreadScreenProps) {
    const insets = useSafeAreaInsets();
    const queryClient = useQueryClient();
    const course = useCourseTitle(cid);
    const boards = useDiscussBoards(boardCid);
    const nodes = useDiscussNodes(boardCid, bid, '');
    const posts = useDiscussPosts(boardCid, bid, nid);
    const blocked = useBlockedUsers();
    const blockedUsers = blocked.data ?? [];
    const postsKey = discussQueryKeys.posts(boardCid, bid, nid);

    const boardTitle =
        boards.data?.boards.find((item) => item.boardId === bid)?.boardName ||
        '討論板';
    const postList = posts.data?.posts ?? [];
    const threadTitle =
        nodes.data?.nodes.find((item) => item.node === nid)?.subject ||
        postList.find((post) => post.subject)?.subject ||
        '文章內容';

    const [revealedPosts, setRevealedPosts] = useState<ReadonlySet<string>>(
        new Set(),
    );
    const [lightbox, setLightbox] = useState<{
        source: ImageSource;
        alt: string | null;
    } | null>(null);

    // Reply compose
    const [isReplyOpen, setIsReplyOpen] = useState(false);
    const [replySubject, setReplySubject] = useState('');
    const [replyContent, setReplyContent] = useState('');
    const [replyError, setReplyError] = useState<string | null>(null);

    // Whisper compose
    const [whisperTarget, setWhisperTarget] = useState<WhisperTarget | null>(
        null,
    );
    const [whisperContent, setWhisperContent] = useState('');
    const [whisperError, setWhisperError] = useState<string | null>(null);

    // Moderation
    const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
    const [reportType, setReportType] = useState<ReportType | null>(null);
    const [reportSuccess, setReportSuccess] = useState<boolean | null>(null);
    const [blockTarget, setBlockTarget] = useState<BlockedUserViewModel | null>(
        null,
    );
    const reportCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const reportContent = useReportContent();
    const blockUser = useBlockUser();
    const unblockUser = useUnblockUser();

    const refetchPosts = () =>
        queryClient.invalidateQueries({ queryKey: postsKey });

    const setForumRead = useServiceMutation({
        op: 'discuss.read',
        mutationFn: (_: void, services) => services.discuss.setForumRead(nid),
        onSuccess: async () => {
            // The unread badges on the board and topic list are stale now.
            await Promise.all([
                queryClient.invalidateQueries({
                    queryKey: discussQueryKeys.nodesOfBoard(boardCid, bid),
                }),
                queryClient.invalidateQueries({
                    queryKey: discussQueryKeys.boards(boardCid),
                }),
            ]);
        },
    });
    const markedRead = useRef(false);

    useEffect(() => {
        if (posts.isSuccess && !markedRead.current) {
            markedRead.current = true;
            setForumRead.mutate();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [posts.isSuccess]);

    useEffect(
        () => () => {
            if (reportCloseTimer.current !== null) {
                clearTimeout(reportCloseTimer.current);
            }
        },
        [],
    );

    const createReply = useServiceMutation({
        op: 'discuss.posts',
        mutationFn: (
            variables: { subject: string; content: string },
            services,
        ) =>
            services.discuss.createPost({
                boardId: bid,
                subject: variables.subject,
                content: variables.content,
                replyPostId: nid,
            }),
        onSuccess: async () => {
            setReplySubject('');
            setReplyContent('');
            setIsReplyOpen(false);
            await refetchPosts();
        },
    });

    const createWhisper = useServiceMutation({
        op: 'discuss.whispers',
        mutationFn: (
            variables: { nodeId: string; content: string },
            services,
        ) =>
            services.discuss.createWhisper(
                bid,
                variables.nodeId,
                variables.content,
            ),
        onSuccess: async () => {
            setWhisperTarget(null);
            setWhisperContent('');
            await refetchPosts();
        },
    });

    const toggleLike = useServiceMutation({
        op: 'discuss.posts',
        mutationFn: (
            variables: { nodeId: string; liked: boolean },
            services,
        ) =>
            variables.liked
                ? services.discuss.unlikePost(bid, variables.nodeId)
                : services.discuss.likePost(bid, variables.nodeId),
        onMutate: async ({ nodeId, liked }) => {
            await queryClient.cancelQueries({ queryKey: postsKey });
            const previous =
                queryClient.getQueryData<PostListViewModel>(postsKey);

            // Optimistic: flip the state and the count right away.
            queryClient.setQueryData<PostListViewModel>(postsKey, (current) =>
                current === undefined
                    ? current
                    : {
                          ...current,
                          posts: current.posts.map((post) =>
                              post.node === nodeId
                                  ? {
                                        ...post,
                                        liked: !liked,
                                        push: post.push + (liked ? -1 : 1),
                                    }
                                  : post,
                          ),
                      },
            );

            return { previous };
        },
        onError: (_error, _variables, context) => {
            const previous = (
                context as { previous?: PostListViewModel } | undefined
            )?.previous;

            if (previous !== undefined) {
                queryClient.setQueryData(postsKey, previous);
            }
        },
        // Either way, reload so the final server state is what is shown.
        onSettled: () => refetchPosts(),
    });

    const submitReply = () => {
        if (replyContent.trim() === '') {
            setReplyError('請輸入內容。');

            return;
        }

        setReplyError(null);
        createReply.mutate({
            subject: replySubject.trim() || DEFAULT_REPLY_SUBJECT,
            content: replyContent,
        });
    };

    const closeReply = () => {
        setIsReplyOpen(false);
        setReplyError(null);
        createReply.reset();
    };

    const submitWhisper = () => {
        if (whisperTarget === null) {
            return;
        }

        if (whisperContent.trim() === '') {
            setWhisperError('請輸入留言內容。');

            return;
        }

        setWhisperError(null);
        createWhisper.mutate({
            nodeId: whisperTarget.nodeId,
            content: whisperContent.trim(),
        });
    };

    const closeWhisper = () => {
        setWhisperTarget(null);
        setWhisperContent('');
        setWhisperError(null);
        createWhisper.reset();
    };

    const openReport = (nodeId: string, content: string) => {
        setReportTarget({ nodeId, content });
        setReportType(null);
        setReportSuccess(null);
    };

    const closeReport = () => {
        if (reportCloseTimer.current !== null) {
            clearTimeout(reportCloseTimer.current);
            reportCloseTimer.current = null;
        }

        setReportTarget(null);
    };

    const submitReport = () => {
        if (reportTarget === null || reportType === null) {
            return;
        }

        reportContent.mutate(
            {
                boardId: bid,
                nodeId: reportTarget.nodeId,
                content: reportTarget.content,
                type: reportType,
            },
            {
                onSuccess: (ok) => {
                    setReportSuccess(ok);

                    if (ok) {
                        reportCloseTimer.current = setTimeout(
                            closeReport,
                            REPORT_CLOSE_DELAY_MS,
                        );
                    }
                },
                onError: () => setReportSuccess(false),
            },
        );
    };

    const confirmBlockUser = () => {
        const target = blockTarget;

        setBlockTarget(null);

        if (target !== null) {
            blockUser.mutate(target);
        }
    };

    const isHeaderLoading = course.isLoading;

    const renderPost = ({
        item: post,
        index,
    }: {
        item: PostViewModel;
        index: number;
    }) => (
        <PostCard
            post={post}
            index={index}
            cid={cid}
            isRevealed={post.node !== null && revealedPosts.has(post.node)}
            blockedUsers={blockedUsers}
            onReveal={() =>
                post.node !== null &&
                setRevealedPosts(
                    (current) => new Set([...current, post.node as string]),
                )
            }
            onToggleLike={() =>
                post.node !== null &&
                toggleLike.mutate({ nodeId: post.node, liked: post.liked })
            }
            onAddWhisper={() =>
                post.node !== null &&
                (setWhisperTarget({
                    nodeId: post.node,
                    floor: post.floor ?? index + 1,
                }),
                setWhisperContent(''))
            }
            onReport={() =>
                post.node !== null && openReport(post.node, post.content ?? '')
            }
            onBlock={() =>
                post.poster &&
                post.realname &&
                setBlockTarget({
                    poster: post.poster,
                    realname: post.realname,
                })
            }
            onUnblock={() =>
                unblockUser.mutate({
                    poster: post.poster ?? '',
                    realname: post.realname ?? '',
                })
            }
            onOpenImage={(source, alt) => setLightbox({ source, alt })}
        />
    );

    return (
        <View className="flex-1 bg-theme-100 dark:bg-zinc-950">
            <PageHeader
                title={course.title}
                subtitle={boardTitle}
                isLoading={isHeaderLoading}
                backHref={`/courses/${encodeURIComponent(cid)}/discuss/${encodeURIComponent(boardCid)}/${encodeURIComponent(bid)}`}
                right={
                    <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="新增回覆"
                        onPress={() => setIsReplyOpen(true)}
                        className="flex-row items-center gap-1 rounded-xl bg-theme-700 px-4 py-2 active:bg-theme-800 dark:bg-theme-800"
                    >
                        <GlyphIcon
                            name="plus"
                            size={16}
                            className="text-white"
                        />
                        <Text className="text-sm font-semibold text-white">
                            新增回覆
                        </Text>
                    </Pressable>
                }
            />

            <FlatList
                data={posts.error ? [] : postList}
                keyExtractor={(post, index) =>
                    post.node ?? `floor-${post.floor ?? index}`
                }
                contentContainerStyle={{
                    gap: 8,
                    paddingHorizontal: 12,
                    paddingTop: 16,
                    paddingBottom: Math.max(insets.bottom, 16) + 64,
                }}
                refreshControl={
                    <RefreshControl
                        refreshing={posts.isRefetching && !posts.isPending}
                        onRefresh={() => void posts.refetch()}
                    />
                }
                ListHeaderComponent={
                    <View className="flex-row items-center gap-2">
                        <GlyphIcon
                            name="chat"
                            size={20}
                            className="text-theme-900 dark:text-zinc-100"
                        />
                        <Text className="min-w-0 flex-1 font-semibold">
                            {threadTitle}
                        </Text>
                    </View>
                }
                ListEmptyComponent={
                    posts.error ? (
                        <ErrorRetry
                            error={posts.error}
                            retrying={posts.isFetching}
                            onRetry={() => void posts.refetch()}
                        />
                    ) : posts.isPending ? (
                        <View className="gap-3">
                            {[0, 1, 2].map((row) => (
                                <View
                                    key={row}
                                    className="h-24 rounded-xl bg-theme-200 dark:bg-zinc-700"
                                />
                            ))}
                        </View>
                    ) : (
                        <Text className="rounded-xl border border-dashed border-theme-300 bg-theme-50 p-4 text-sm text-theme-700 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                            目前沒有可顯示的討論內容。
                        </Text>
                    )
                }
                renderItem={renderPost}
            />

            <ComposeSheet
                visible={isReplyOpen}
                title="新增回覆"
                contextLabel="回覆文章"
                contextValue={threadTitle}
                submitLabel="送出回覆"
                isSubmitting={createReply.isPending}
                error={replyError ?? createReply.error?.message ?? null}
                onClose={closeReply}
                onSubmit={submitReply}
            >
                <TextInput
                    accessibilityLabel="主題"
                    value={replySubject}
                    onChangeText={setReplySubject}
                    placeholder="主題（選填）"
                    placeholderTextColor="#9ca3af"
                    className="rounded-xl border border-theme-300 bg-white px-3 py-2 text-sm text-theme-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
                />
                <TextInput
                    accessibilityLabel="內容"
                    value={replyContent}
                    onChangeText={setReplyContent}
                    placeholder="內容"
                    placeholderTextColor="#9ca3af"
                    multiline
                    textAlignVertical="top"
                    className="h-36 rounded-xl border border-theme-300 bg-white px-3 py-2 text-sm text-theme-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
                />
            </ComposeSheet>

            <ComposeSheet
                visible={whisperTarget !== null}
                title="新增留言"
                contextLabel="留言於"
                contextValue={
                    whisperTarget?.floor
                        ? `樓層 ${whisperTarget.floor}`
                        : threadTitle
                }
                submitLabel="送出留言"
                isSubmitting={createWhisper.isPending}
                error={whisperError ?? createWhisper.error?.message ?? null}
                onClose={closeWhisper}
                onSubmit={submitWhisper}
            >
                <TextInput
                    accessibilityLabel="留言內容"
                    value={whisperContent}
                    onChangeText={setWhisperContent}
                    placeholder="留言內容"
                    placeholderTextColor="#9ca3af"
                    multiline
                    textAlignVertical="top"
                    className="h-24 rounded-xl border border-theme-300 bg-white px-3 py-2 text-sm text-theme-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
                />
            </ComposeSheet>

            <ReportSheet
                visible={reportTarget !== null}
                reportType={reportType}
                isSubmitting={reportContent.isPending}
                reportSuccess={reportSuccess}
                onChangeType={setReportType}
                onClose={closeReport}
                onSubmit={submitReport}
            />

            <ConfirmDialog
                isOpen={blockTarget !== null}
                title="封鎖使用者"
                message={`確定要封鎖名稱為「${blockTarget?.realname ?? ''}」、帳號為「${blockTarget?.poster ?? ''}」的使用者嗎？封鎖後，所有相同名稱使用者的所有貼文將被隱藏。`}
                confirmLabel="確定封鎖"
                danger
                onConfirm={confirmBlockUser}
                onCancel={() => setBlockTarget(null)}
            />

            <ImageLightbox
                source={lightbox?.source ?? null}
                alt={lightbox?.alt}
                onClose={() => setLightbox(null)}
            />
        </View>
    );
}

interface PostCardProps {
    post: PostViewModel;
    index: number;
    cid: string;
    isRevealed: boolean;
    blockedUsers: BlockedUserViewModel[];
    onReveal: () => void;
    onToggleLike: () => void;
    onAddWhisper: () => void;
    onReport: () => void;
    onBlock: () => void;
    onUnblock: () => void;
    onOpenImage: (source: ImageSource, alt: string | null) => void;
}

function PostCard({
    post,
    index,
    cid,
    isRevealed,
    blockedUsers,
    onReveal,
    onToggleLike,
    onAddWhisper,
    onReport,
    onBlock,
    onUnblock,
    onOpenImage,
}: PostCardProps) {
    const cardClass =
        'rounded-xl border border-theme-200 bg-theme-50 px-3 py-3 dark:border-zinc-700 dark:bg-zinc-800';

    if (post.isBlocked && post.node !== null && !isRevealed) {
        return (
            <View className={cardClass}>
                <View className="rounded-lg border border-dashed border-amber-300 bg-amber-50 p-3 dark:border-amber-700 dark:bg-amber-950">
                    <View className="flex-row items-center gap-2">
                        <Icon
                            name="exclamation-triangle"
                            size={20}
                            className="text-amber-800 dark:text-amber-200"
                        />
                        <Text className="min-w-0 flex-1 text-sm text-amber-800 dark:text-amber-200">
                            本內容經檢舉已在 Alt UU
                            中隱藏，若有需要請前往其他平台檢視。原因：
                            {getReasonLabel(post.blockedReason)}。
                        </Text>
                    </View>
                    <Pressable accessibilityRole="button" onPress={onReveal}>
                        <Text className="mt-2 text-xs font-medium text-amber-700 underline dark:text-amber-400">
                            仍要檢視
                        </Text>
                    </Pressable>
                </View>
            </View>
        );
    }

    if (isUserBlocked(blockedUsers, post.poster, post.realname)) {
        return (
            <View className={cardClass}>
                <View className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-3 dark:border-zinc-600 dark:bg-zinc-800">
                    <Text className="text-sm text-zinc-600 dark:text-zinc-400">
                        由於你封鎖了名稱為「{post.realname}」、帳號為「
                        {post.poster}」的使用者，因此此內容已隱藏。
                    </Text>
                    <Pressable
                        accessibilityRole="button"
                        onPress={onUnblock}
                        className="mt-2 self-start rounded-lg border border-zinc-300 bg-white px-3 py-1.5 active:bg-zinc-100 dark:border-zinc-500 dark:bg-zinc-700"
                    >
                        <Text className="text-xs font-semibold text-zinc-700 dark:text-zinc-200">
                            解除封鎖
                        </Text>
                    </Pressable>
                </View>
            </View>
        );
    }

    const floor = post.floor ?? index + 1;
    const showWhispers =
        index !== 0 || post.whisperCount > 0 || post.whispers.length > 0;
    const smallButton =
        'flex-row items-center gap-1 rounded border border-theme-300 bg-white px-2 py-1 active:bg-theme-100 dark:border-zinc-600 dark:bg-zinc-800';

    return (
        <View className={cardClass}>
            <View className="mb-1 flex-row items-center justify-between gap-2">
                <Text className="min-w-0 flex-1 text-sm text-theme-700 dark:text-zinc-400">
                    樓層 {floor} · {post.realname ?? post.poster ?? '匿名'} ·{' '}
                    {post.postDate ?? ''}
                </Text>
                <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={post.liked ? '取消讚' : '讚'}
                    accessibilityState={{ selected: post.liked }}
                    onPress={onToggleLike}
                    className={`flex-row items-center gap-1 rounded border px-2 py-1 ${
                        post.liked
                            ? 'border-theme-800 bg-theme-800'
                            : 'border-theme-300 bg-white active:bg-theme-100 dark:border-zinc-600 dark:bg-zinc-800'
                    }`}
                >
                    <GlyphIcon
                        name="thumb-up"
                        solid={post.liked}
                        size={16}
                        className={
                            post.liked
                                ? 'text-white'
                                : 'text-theme-700 dark:text-zinc-300'
                        }
                    />
                    <Text
                        className={`text-xs ${post.liked ? 'text-white' : 'text-theme-700 dark:text-zinc-300'}`}
                    >
                        {post.push ?? 0}
                    </Text>
                </Pressable>
            </View>

            {post.content ? (
                <PostHtml html={post.content} onOpenImage={onOpenImage} />
            ) : (
                <Text className="mt-1 text-sm">（無內容）</Text>
            )}

            {post.attachments.length > 0 ? (
                <AttachmentSection
                    cid={cid}
                    attachments={post.attachments}
                    onOpenImage={onOpenImage}
                />
            ) : null}

            {showWhispers ? (
                <View className="mt-3 rounded-lg border border-theme-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900">
                    <View
                        className={`flex-row items-center justify-between ${post.whisperCount ? 'mb-2' : ''}`}
                    >
                        <Text className="text-xs font-semibold text-theme-700 dark:text-zinc-300">
                            留言 ({post.whisperCount ?? post.whispers.length})
                        </Text>
                        <Pressable
                            accessibilityRole="button"
                            onPress={onAddWhisper}
                            className="rounded bg-theme-700 px-3 py-1.5 active:bg-theme-800 dark:bg-theme-800"
                        >
                            <Text className="text-xs font-semibold text-white">
                                新增留言
                            </Text>
                        </Pressable>
                    </View>
                    <View className="gap-2">
                        {post.whispers.map((whisper, whisperIndex) => (
                            <WhisperItem
                                key={
                                    whisper.wid ??
                                    whisper.sid ??
                                    String(whisperIndex)
                                }
                                whisper={whisper}
                            />
                        ))}
                    </View>
                </View>
            ) : null}

            <View className="mt-2 flex-row items-center gap-2 border-t border-theme-200 pt-2 dark:border-zinc-700">
                {post.node ? (
                    <Pressable
                        accessibilityRole="button"
                        onPress={onReport}
                        className={smallButton}
                    >
                        <GlyphIcon
                            name="flag"
                            size={14}
                            className="text-theme-700 dark:text-zinc-400"
                        />
                        <Text className="text-xs text-theme-700 dark:text-zinc-400">
                            檢舉
                        </Text>
                    </Pressable>
                ) : null}
                {post.poster && post.realname ? (
                    <Pressable
                        accessibilityRole="button"
                        onPress={onBlock}
                        className={smallButton}
                    >
                        <GlyphIcon
                            name="no-symbol"
                            size={14}
                            className="text-theme-700 dark:text-zinc-400"
                        />
                        <Text className="text-xs text-theme-700 dark:text-zinc-400">
                            封鎖使用者
                        </Text>
                    </Pressable>
                ) : null}
            </View>
        </View>
    );
}

function WhisperItem({ whisper }: { whisper: WhisperViewModel }) {
    return (
        <View className="rounded-md border border-theme-100 bg-theme-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-800">
            <Text className="mb-1 text-sm text-theme-700 dark:text-zinc-400">
                {whisper.realname ?? whisper.creator ?? '匿名'} ·{' '}
                {whisper.createTime ?? ''}
            </Text>
            <Text
                selectable
                className="text-sm text-theme-800 dark:text-zinc-200"
            >
                {whisperText(whisper.content)}
            </Text>
        </View>
    );
}

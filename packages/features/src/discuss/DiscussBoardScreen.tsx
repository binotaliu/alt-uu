import type { NodeViewModel } from '@altuu/core';
import { Button, PageHeader, Text } from '@altuu/ui';
import { router } from 'expo-router';
import { useState } from 'react';
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
import { ComposeSheet } from './components/ComposeSheet';
import { GlyphIcon } from './components/GlyphIcon';
import { getReasonLabel } from './moderation';
import {
    discussQueryKeys,
    useCourseTitle,
    useDiscussBoards,
    useDiscussNodes,
} from './queries';
import { useQueryClient } from '@tanstack/react-query';

export interface DiscussBoardScreenProps {
    cid: string;
    boardCid: string;
    bid: string;
}

const DEFAULT_SUBJECT = '新文章';

/** Legacy pages/Courses/DiscussBoard.vue: the topics of one board. */
export function DiscussBoardScreen({
    cid,
    boardCid,
    bid,
}: DiscussBoardScreenProps) {
    const insets = useSafeAreaInsets();
    const queryClient = useQueryClient();
    const course = useCourseTitle(cid);
    const boards = useDiscussBoards(boardCid);
    const [searchText, setSearchText] = useState('');
    const [keyword, setKeyword] = useState('');
    const nodes = useDiscussNodes(boardCid, bid, keyword);
    const [revealedNodes, setRevealedNodes] = useState<ReadonlySet<string>>(
        new Set(),
    );
    const [isComposeOpen, setIsComposeOpen] = useState(false);
    const [subject, setSubject] = useState('');
    const [content, setContent] = useState('');
    const [validationError, setValidationError] = useState<string | null>(null);

    const board = boards.data?.boards.find((item) => item.boardId === bid);
    const boardTitle = board?.boardName || '討論板';
    const canCreatePost = board?.allowPost ?? false;
    const isHeaderLoading = course.isLoading || boards.isPending;

    const createPost = useServiceMutation({
        op: 'discuss.nodes',
        mutationFn: (
            variables: { subject: string; content: string },
            services,
        ) =>
            services.discuss.createPost({
                boardId: bid,
                subject: variables.subject,
                content: variables.content,
            }),
        onSuccess: async () => {
            setSubject('');
            setContent('');
            setIsComposeOpen(false);
            await queryClient.invalidateQueries({
                queryKey: discussQueryKeys.nodesOfBoard(boardCid, bid),
            });
        },
    });

    const submitNewPost = () => {
        if (content.trim() === '') {
            setValidationError('請輸入內容。');

            return;
        }

        setValidationError(null);
        createPost.mutate({
            subject: subject.trim() || DEFAULT_SUBJECT,
            content,
        });
    };

    const closeCompose = () => {
        setIsComposeOpen(false);
        setValidationError(null);
        createPost.reset();
    };

    const openNode = (node: NodeViewModel) => {
        router.push(
            `/courses/${encodeURIComponent(cid)}/discuss/${encodeURIComponent(boardCid)}/${encodeURIComponent(bid)}/${encodeURIComponent(node.node)}`,
        );
    };

    const nodeList = nodes.data?.nodes ?? [];
    const refresh = async () => {
        await Promise.all([nodes.refetch(), boards.refetch()]);
    };

    const header = (
        <View className="gap-3">
            <View className="flex-row items-center gap-2">
                <GlyphIcon
                    name="chat"
                    size={20}
                    className="text-theme-900 dark:text-zinc-100"
                />
                <Text className="font-semibold">文章列表</Text>
            </View>
            <View className="flex-row items-center gap-2">
                <TextInput
                    accessibilityLabel="搜尋文章主題"
                    value={searchText}
                    onChangeText={setSearchText}
                    onSubmitEditing={() => setKeyword(searchText.trim())}
                    returnKeyType="search"
                    placeholder="搜尋文章主題"
                    placeholderTextColor="#9ca3af"
                    className="min-h-10 flex-1 rounded-xl border border-theme-300 bg-white px-3 py-2 text-sm text-theme-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
                />
                {keyword !== '' ? (
                    <Button
                        label="清除"
                        variant="secondary"
                        onPress={() => {
                            setSearchText('');
                            setKeyword('');
                        }}
                    />
                ) : null}
            </View>
        </View>
    );

    return (
        <View className="flex-1 bg-theme-100 dark:bg-zinc-950">
            <PageHeader
                title={course.title}
                subtitle={boardTitle}
                isLoading={isHeaderLoading}
                backHref={{
                    pathname: '/courses/[cid]',
                    params: { cid, tab: 'discuss' },
                }}
                right={
                    !isHeaderLoading && canCreatePost ? (
                        <Pressable
                            accessibilityRole="button"
                            accessibilityLabel="新增文章"
                            onPress={() => setIsComposeOpen(true)}
                            className="flex-row items-center gap-1 rounded-xl bg-theme-700 px-4 py-2 active:bg-theme-800 dark:bg-theme-800"
                        >
                            <GlyphIcon
                                name="plus"
                                size={16}
                                className="text-white"
                            />
                            <Text className="text-sm font-semibold text-white">
                                新增文章
                            </Text>
                        </Pressable>
                    ) : null
                }
            />

            <FlatList
                data={nodes.error ? [] : nodeList}
                keyExtractor={(node) => node.node}
                contentContainerStyle={{
                    gap: 8,
                    paddingHorizontal: 12,
                    paddingTop: 16,
                    paddingBottom: Math.max(insets.bottom, 16) + 64,
                }}
                keyboardShouldPersistTaps="handled"
                refreshControl={
                    <RefreshControl
                        refreshing={nodes.isRefetching && !nodes.isPending}
                        onRefresh={refresh}
                    />
                }
                ListHeaderComponent={header}
                ListEmptyComponent={
                    nodes.error ? (
                        <ErrorRetry
                            error={nodes.error}
                            retrying={nodes.isFetching}
                            onRetry={() => void nodes.refetch()}
                        />
                    ) : nodes.isPending ? (
                        <View className="gap-2">
                            {[0, 1, 2, 3, 4].map((row) => (
                                <View
                                    key={row}
                                    className="h-14 rounded-xl bg-theme-200 dark:bg-zinc-700"
                                />
                            ))}
                        </View>
                    ) : (
                        <Text className="rounded-xl border border-dashed border-theme-300 bg-theme-50 p-4 text-sm text-theme-700 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                            {keyword === ''
                                ? '目前沒有可顯示的文章主題。'
                                : `找不到包含「${keyword}」的文章主題。`}
                        </Text>
                    )
                }
                renderItem={({ item }) =>
                    item.isBlocked && !revealedNodes.has(item.node) ? (
                        <BlockedNodeNotice
                            reason={item.blockedReason}
                            onReveal={() =>
                                setRevealedNodes(
                                    (current) =>
                                        new Set([...current, item.node]),
                                )
                            }
                        />
                    ) : (
                        <NodeRow node={item} onPress={() => openNode(item)} />
                    )
                }
            />

            <ComposeSheet
                visible={isComposeOpen}
                title="新增文章"
                contextLabel="討論板"
                contextValue={boardTitle}
                submitLabel="送出文章"
                isSubmitting={createPost.isPending}
                error={validationError ?? createPost.error?.message ?? null}
                onClose={closeCompose}
                onSubmit={submitNewPost}
            >
                <TextInput
                    accessibilityLabel="主題"
                    value={subject}
                    onChangeText={setSubject}
                    placeholder="主題（選填）"
                    placeholderTextColor="#9ca3af"
                    className="rounded-xl border border-theme-300 bg-white px-3 py-2 text-sm text-theme-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
                />
                <TextInput
                    accessibilityLabel="內容"
                    value={content}
                    onChangeText={setContent}
                    placeholder="內容"
                    placeholderTextColor="#9ca3af"
                    multiline
                    textAlignVertical="top"
                    className="h-36 rounded-xl border border-theme-300 bg-white px-3 py-2 text-sm text-theme-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
                />
            </ComposeSheet>
        </View>
    );
}

function NodeRow({
    node,
    onPress,
}: {
    node: NodeViewModel;
    onPress: () => void;
}) {
    return (
        <Pressable
            accessibilityRole="button"
            onPress={onPress}
            className="rounded-xl border border-theme-200 bg-white px-3 py-2 active:border-theme-400 dark:border-zinc-700 dark:bg-zinc-900"
        >
            <View className="flex-row items-start justify-between gap-3">
                <View className="min-w-0 flex-1">
                    <View className="flex-row flex-wrap items-center gap-2">
                        <Text
                            numberOfLines={1}
                            className="shrink font-medium text-theme-700 dark:text-zinc-300"
                        >
                            {node.subject || '未命名主題'}
                        </Text>
                        {node.isRead === false ? (
                            <Text className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-600/95 dark:text-amber-50">
                                未讀
                            </Text>
                        ) : null}
                    </View>
                    <Text className="text-sm text-theme-700 dark:text-zinc-400">
                        {node.poster ?? '匿名'} · {node.repliesCount ?? ''}{' '}
                        則回覆
                    </Text>
                </View>

                {node.likesCount && node.likesCount > 0 ? (
                    <View className="flex-row items-center gap-1">
                        <GlyphIcon
                            name="thumb-up"
                            size={16}
                            className="text-theme-700 dark:text-zinc-400"
                        />
                        <Text className="text-sm text-theme-700 dark:text-zinc-400">
                            {node.likesCount}
                        </Text>
                    </View>
                ) : null}
            </View>
        </Pressable>
    );
}

function BlockedNodeNotice({
    reason,
    onReveal,
}: {
    reason: string | null;
    onReveal: () => void;
}) {
    return (
        <View className="rounded-xl border border-dashed border-amber-300 bg-amber-50 px-3 py-2 dark:border-amber-700 dark:bg-amber-950">
            <Text className="text-sm text-amber-800 dark:text-amber-200">
                本內容經檢舉已在 Alt UU
                中隱藏，若有需要請前往其他平台檢視。原因：
                {getReasonLabel(reason)}。
            </Text>
            <Pressable accessibilityRole="button" onPress={onReveal}>
                <Text className="mt-1 text-xs font-medium text-amber-700 underline dark:text-amber-400">
                    仍要檢視
                </Text>
            </Pressable>
        </View>
    );
}

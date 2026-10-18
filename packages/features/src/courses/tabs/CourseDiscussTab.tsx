import type { BoardViewModel } from '@altuu/core';
import { Text, Icon } from '@altuu/ui';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { Card, EmptyNotice, Skeleton } from '../components/primitives';
import { useCourseBoards } from '../courseQueries';
import { ErrorRetry } from '../../shell/ErrorRetry';

interface BoardSection {
  courseId: string;
  title: string;
  boardsQuery: ReturnType<typeof useCourseBoards>;
}

function boardHref(cid: string, boardCid: string, bid: string): string {
  return `/courses/${encodeURIComponent(cid)}/discuss/${encodeURIComponent(boardCid)}/${encodeURIComponent(bid)}`;
}

function BoardRow({
  board,
  onPress,
}: {
  board: BoardViewModel;
  onPress: () => void;
}) {
  return (
    <Pressable
      testID="discuss-board-row"
      accessibilityRole="link"
      onPress={onPress}
      className="rounded-xl border border-theme-200 bg-white px-3 py-2 active:border-theme-400 dark:border-zinc-700 dark:bg-zinc-800 dark:active:border-zinc-500"
    >
      <View className="flex-row items-center justify-between gap-2">
        <Text
          numberOfLines={1}
          className="min-w-0 flex-1 text-base font-medium text-theme-700 dark:text-zinc-300"
        >
          {board.boardName || '未命名看板'}
        </Text>
        {board.hasNewPost ? (
          <View className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 dark:bg-amber-600/95">
            <Text className="text-xs font-semibold text-amber-700 dark:text-amber-50">
              新文章
            </Text>
          </View>
        ) : null}
      </View>
      <Text className="text-sm text-theme-700 dark:text-zinc-300">
        主題數：{board.subjectCount ?? 0}
      </Text>
    </Pressable>
  );
}

export interface CourseDiscussTabProps {
  cid: string;
  /** `className` of the course, used as the first section's title. */
  className: string | null;
  commonCourseId: string | null;
}

/**
 * 討論板: board list of the course (and its 共用版). Boards link to
 * `/courses/[cid]/discuss/[boardCid]/[bid]`.
 */
export function CourseDiscussTab({
  cid,
  className,
  commonCourseId,
}: CourseDiscussTabProps) {
  const current = useCourseBoards(cid);
  const common = useCourseBoards(commonCourseId);
  const sections: BoardSection[] = [
    {
      courseId: cid,
      title: className?.trim() || `課程 ${cid}`,
      boardsQuery: current,
    },
  ];

  if (commonCourseId) {
    sections.push({
      courseId: commonCourseId,
      title: '共用版',
      boardsQuery: common,
    });
  }

  const loadError = current.error ?? common.error;
  const isLoading = current.isFetching || common.isFetching;
  const allEmpty = sections.every(
    (section) => (section.boardsQuery.data?.boards.length ?? 0) === 0,
  );
  const retry = () => {
    void current.refetch();

    if (commonCourseId) {
      void common.refetch();
    }
  };

  return (
    <Card className="p-4">
      <View className="mb-3 flex-row items-center gap-2">
        <Icon
          name="chat-bubble-left-right"
          size={20}
          className="text-theme-900 dark:text-zinc-100"
        />
        <Text accessibilityRole="header" className="font-semibold">
          看板列表
        </Text>
      </View>

      {loadError ? (
        <ErrorRetry error={loadError} retrying={isLoading} onRetry={retry} />
      ) : isLoading && allEmpty ? (
        <View className="gap-4" accessibilityLabel="載入討論板中">
          {[0, 1].map((section) => (
            <View key={section} className="gap-2">
              <Skeleton className="h-4 w-24" />
              {[0, 1, 2].map((row) => (
                <Skeleton key={row} className="h-14 rounded-xl" />
              ))}
            </View>
          ))}
        </View>
      ) : (
        <View className="gap-5">
          {sections.map((section) => {
            const boards = section.boardsQuery.data?.boards ?? [];

            return (
              <View key={section.courseId} className="gap-2">
                <View className="border-b border-theme-200 pb-2 dark:border-zinc-700">
                  <Text className="text-sm font-semibold text-theme-900 dark:text-zinc-100">
                    {section.title}
                  </Text>
                </View>
                {boards.length > 0 ? (
                  boards.map((board) => (
                    <BoardRow
                      key={`${section.courseId}-${board.boardId}`}
                      board={board}
                      onPress={() =>
                        router.push(
                          boardHref(cid, section.courseId, board.boardId),
                        )
                      }
                    />
                  ))
                ) : (
                  <EmptyNotice>目前沒有可顯示的討論板。</EmptyNotice>
                )}
              </View>
            );
          })}
        </View>
      )}
    </Card>
  );
}

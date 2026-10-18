import type {
  BlockedUserViewModel,
  BoardListViewModel,
  NodeListViewModel,
  PostListViewModel,
  ReportType,
} from '@altuu/core';
import { useQueryClient } from '@tanstack/react-query';

import { useCourses } from '../courses/courseQueries';
import { useServiceMutation, useServiceQuery } from '../services';
import { discussQueryKeys } from './queryKeys';

export { discussQueryKeys };

export function useDiscussBoards(boardCid: string) {
  return useServiceQuery<BoardListViewModel>({
    op: 'discuss.boards',
    queryKey: discussQueryKeys.boards(boardCid),
    queryFn: (services) => services.discuss.listBoards(boardCid),
  });
}

export function useDiscussNodes(
  boardCid: string,
  bid: string,
  keyword: string,
) {
  return useServiceQuery<NodeListViewModel>({
    op: 'discuss.nodes',
    queryKey: discussQueryKeys.nodes(boardCid, bid, keyword),
    queryFn: (services) => services.discuss.listNodes(boardCid, bid, keyword),
    // Legacy forced a reload on every visit; unread badges change often.
    staleTime: 0,
  });
}

export function useDiscussPosts(boardCid: string, bid: string, nid: string) {
  return useServiceQuery<PostListViewModel>({
    op: 'discuss.posts',
    queryKey: discussQueryKeys.posts(boardCid, bid, nid),
    queryFn: (services) => services.discuss.listPosts(boardCid, bid, nid),
    staleTime: 0,
  });
}

/** The legacy header title: the course name, falling back to 課程 {cid}. */
export function useCourseTitle(cid: string): {
  title: string;
  isLoading: boolean;
} {
  const courses = useCourses();
  const course = courses.data?.find((item) => item.courseId === cid);

  return {
    title: course?.name || `課程 ${cid}`,
    isLoading: courses.isPending,
  };
}

export function useBlockedUsers() {
  return useServiceQuery<BlockedUserViewModel[]>({
    op: 'moderation.block',
    queryKey: discussQueryKeys.blockedUsers,
    queryFn: (services) => services.moderation.getBlockedUsers(),
  });
}

export function useBlockUser() {
  const queryClient = useQueryClient();

  return useServiceMutation<void, BlockedUserViewModel>({
    op: 'moderation.block',
    mutationFn: ({ poster, realname }, services) =>
      services.moderation.blockUser(poster, realname),
    onSuccess: (_data, blocked) => {
      queryClient.setQueryData<BlockedUserViewModel[]>(
        discussQueryKeys.blockedUsers,
        (current = []) =>
          current.some(
            (item) =>
              item.poster === blocked.poster &&
              item.realname === blocked.realname,
          )
            ? current
            : [...current, blocked],
      );
    },
  });
}

export function useUnblockUser() {
  const queryClient = useQueryClient();

  return useServiceMutation<void, BlockedUserViewModel>({
    op: 'moderation.block',
    mutationFn: ({ poster, realname }, services) =>
      services.moderation.unblockUser(poster, realname),
    onSuccess: (_data, blocked) => {
      queryClient.setQueryData<BlockedUserViewModel[]>(
        discussQueryKeys.blockedUsers,
        (current = []) =>
          current.filter(
            (item) =>
              !(
                item.poster === blocked.poster &&
                item.realname === blocked.realname
              ),
          ),
      );
    },
  });
}

export interface ReportVariables {
  boardId: string;
  nodeId: string;
  content: string;
  type: ReportType;
}

export function useReportContent() {
  return useServiceMutation<boolean, ReportVariables>({
    op: 'moderation.report',
    mutationFn: (variables, services) =>
      services.moderation.reportContent(variables),
  });
}

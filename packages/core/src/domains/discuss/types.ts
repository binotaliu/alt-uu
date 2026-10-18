/** Field names mirror the legacy generated.d.ts (App.Domains.Discuss.ViewModels). */
export interface AttachmentViewModel {
  filename: string | null;
  href: string | null;
}

export interface BoardViewModel {
  boardId: string;
  boardName: string;
  allowPost: boolean;
  hasNewPost: boolean;
  subjectCount: number | null;
}

export interface BoardListViewModel {
  courseId: string;
  boards: BoardViewModel[];
}

export interface NodeViewModel {
  node: string;
  subject: string;
  isRead: boolean;
  poster: string | null;
  repliesCount: number | null;
  likesCount: number | null;
  isBlocked: boolean;
  blockedReason: string | null;
}

export interface NodeListViewModel {
  courseId: string;
  boardId: string;
  nodes: NodeViewModel[];
}

export interface WhisperViewModel {
  wid: string | null;
  sid: string | null;
  creator: string | null;
  realname: string | null;
  content: string | null;
  createTime: string | null;
  createTimeDescription: string | null;
  canDelete: boolean | null;
}

export interface PostViewModel {
  floor: number;
  node: string | null;
  subject: string | null;
  content: string | null;
  poster: string | null;
  realname: string | null;
  postDate: string | null;
  push: number;
  liked: boolean;
  whisperCount: number;
  whispers: WhisperViewModel[];
  attachments: AttachmentViewModel[];
  isBlocked: boolean;
  blockedReason: string | null;
}

export interface PostListViewModel {
  courseId: string;
  boardId: string;
  nodeId: string;
  posts: PostViewModel[];
}

/** Upstream xmlapi payload of a mutation, returned as is (legacy `$result['payload']`). */
export type DiscussMutationPayload = Record<string, unknown>;

/** Reply-to fields and attachments come straight from the compose screen. */
export interface CreatePostInput {
  boardId: string;
  subject: string;
  content: string;
  replyContent?: string | null;
  replyPostId?: string | null;
  attaches?: unknown[];
}

export interface UpdatePostInput {
  subject?: string | null;
  content?: string | null;
  attaches?: unknown[];
}

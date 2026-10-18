import { UserFacingHttpError } from '../../errors/errors';
import { dataGet, isRecord } from '../../http/encoding';
import type { HunguDiscussClient } from '../../hungu/hunguApis';
import type { AltUUDatabase } from '../../db/types';
import { findBlockedReasons } from './blockedContents';
import {
  htmlSpecialChars,
  isSet,
  nl2br,
  normalizeInput,
  phpBool,
  phpInt,
  phpString,
} from './php';
import type {
  AttachmentViewModel,
  BoardListViewModel,
  CreatePostInput,
  DiscussMutationPayload,
  NodeListViewModel,
  PostListViewModel,
  PostViewModel,
  UpdatePostInput,
  WhisperViewModel,
} from './types';

export interface DiscussServicesDeps {
  client: HunguDiscussClient;
  db: AltUUDatabase;
  /**
   * Legacy `Purifier::clean` (config/purifier.php, `default` profile) for post
   * bodies. Injected so core does not depend on the course domain's sanitizer.
   */
  sanitizeHtml: (html: string) => string;
}

type Row = Record<string, unknown>;

function bad(message: string): never {
  throw new UserFacingHttpError(400, message);
}

/** `Arr::get($payload, 'data.list', Arr::get($payload, 'data', []))` as rows. */
function payloadRows(payload: Record<string, unknown>): unknown[] {
  const list = dataGet(payload, 'data.list');
  const rows = list !== undefined ? list : (dataGet(payload, 'data') ?? []);

  return Array.isArray(rows) ? rows : [];
}

function optionalString(value: unknown): string | null {
  return value === null || value === undefined ? null : phpString(value);
}

/**
 * Discuss forum operations: ports of the legacy Discuss actions plus the
 * validation of the Discuss*Controller classes.
 */
export function createDiscussServices(deps: DiscussServicesDeps) {
  const { client, db, sanitizeHtml } = deps;

  async function fetchWhispers(
    boardId: string,
    postNode: string,
  ): Promise<WhisperViewModel[]> {
    const { payload } = await client.fetchWhispers(boardId, postNode);

    return payloadRows(payload).map((entry): WhisperViewModel => {
      const whisper = (isRecord(entry) ? entry : {}) as Row;

      return {
        wid: isSet(whisper, 'wid') ? phpString(whisper.wid) : null,
        sid: isSet(whisper, 'sid') ? phpString(whisper.sid) : null,
        creator: isSet(whisper, 'creator') ? phpString(whisper.creator) : null,
        realname: isSet(whisper, 'realname')
          ? phpString(whisper.realname)
          : null,
        content: (whisper.content as string | undefined) ?? null,
        createTime: isSet(whisper, 'create_time')
          ? phpString(whisper.create_time)
          : null,
        createTimeDescription: isSet(whisper, 'create_time_description')
          ? phpString(whisper.create_time_description)
          : null,
        canDelete: isSet(whisper, 'can_delete')
          ? phpBool(whisper.can_delete)
          : null,
      };
    });
  }

  function mapAttachments(post: Row): AttachmentViewModel[] {
    const attachments =
      post.attachment !== undefined
        ? post.attachment
        : (post.attachments ?? []);

    if (!Array.isArray(attachments)) {
      return [];
    }

    const result: AttachmentViewModel[] = [];

    for (const attachment of attachments) {
      if (!isRecord(attachment) || Array.isArray(attachment)) {
        continue;
      }

      const item = attachment as Row;

      result.push({
        filename: isSet(item, 'filename')
          ? phpString(item.filename)
          : isSet(item, 'name')
            ? phpString(item.name)
            : null,
        href: isSet(item, 'href')
          ? phpString(item.href)
          : isSet(item, 'url')
            ? phpString(item.url)
            : null,
      });
    }

    return result;
  }

  return {
    async listBoards(courseId: string): Promise<BoardListViewModel> {
      if (courseId === '') {
        bad('Course ID is required');
      }

      const { payload } = await client.fetchBoardList(courseId);

      return {
        courseId,
        boards: payloadRows(payload).map((entry) => {
          const board = (isRecord(entry) ? entry : {}) as Row;

          return {
            boardId: phpString(board.board_id),
            boardName: phpString(board.board_name ?? board.title),
            allowPost: isSet(board, 'is_bulletin')
              ? !phpBool(board.is_bulletin)
              : false,
            hasNewPost: isSet(board, 'read_flag')
              ? !phpBool(board.read_flag)
              : false,
            subjectCount: isSet(board, 'subject_cnt')
              ? phpInt(board.subject_cnt)
              : null,
          };
        }),
      };
    },

    async listNodes(
      courseId: string,
      boardId: string,
      keyword = '',
    ): Promise<NodeListViewModel> {
      if (courseId === '' || boardId === '') {
        bad('Course ID and Board ID are required');
      }

      const { payload } = await client.fetchBoardNodeList(boardId, keyword);
      const rows = payloadRows(payload).map(
        (entry) => (isRecord(entry) ? entry : {}) as Row,
      );
      const blocked = await findBlockedReasons(
        db,
        boardId,
        rows
          .map((node) => phpString(node.node))
          .filter((nodeId) => nodeId !== ''),
      );

      return {
        courseId,
        boardId,
        nodes: rows.map((node) => {
          const nodeId = phpString(node.node);
          const blockedReason = blocked.get(nodeId) ?? null;

          return {
            node: nodeId,
            subject: phpString(node.subject),
            isRead: phpBool(node.read),
            poster: isSet(node, 'realname') ? phpString(node.realname) : null,
            repliesCount: isSet(node, 'reply') ? phpInt(node.reply) : null,
            likesCount: isSet(node, 'push') ? phpInt(node.push) : null,
            isBlocked: blockedReason !== null,
            blockedReason,
          };
        }),
      };
    },

    async listPosts(
      courseId: string,
      boardId: string,
      nodeId: string,
    ): Promise<PostListViewModel> {
      if (courseId === '' || boardId === '' || nodeId === '') {
        bad('Course ID, Board ID, and Node ID are required');
      }

      const { payload } = await client.fetchBoardReplyList(boardId, nodeId);
      const rows = payloadRows(payload).map(
        (entry) => (isRecord(entry) ? entry : {}) as Row,
      );
      const nodeOf = (post: Row): string | null =>
        typeof post.node === 'string' && post.node !== '' ? post.node : null;
      const blocked = await findBlockedReasons(
        db,
        boardId,
        rows.map(nodeOf).filter((id): id is string => id !== null),
      );
      const posts: PostViewModel[] = [];

      for (const [index, post] of rows.entries()) {
        const postNode = nodeOf(post);
        const whisperCount = isSet(post, 'whispercnt')
          ? phpInt(post.whispercnt)
          : 0;
        const whispers =
          whisperCount > 0 && postNode !== null
            ? await fetchWhispers(boardId, postNode)
            : [];
        const blockedReason =
          postNode !== null ? (blocked.get(postNode) ?? null) : null;

        posts.push({
          floor: phpInt(post.floor ?? index + 1),
          node: postNode,
          subject: typeof post.subject === 'string' ? post.subject : null,
          content:
            typeof post.content === 'string'
              ? sanitizeHtml(post.content)
              : null,
          poster: optionalString(post.poster),
          realname: optionalString(post.realname),
          postDate: optionalString(post.post_date),
          push: isSet(post, 'push') ? phpInt(post.push) : 0,
          liked: isSet(post, 'i_pushed') ? phpBool(post.i_pushed) : false,
          whisperCount,
          whispers,
          attachments: mapAttachments(post),
          isBlocked: blockedReason !== null,
          blockedReason,
        });
      }

      return { courseId, boardId, nodeId, posts };
    },

    async createPost(input: CreatePostInput): Promise<DiscussMutationPayload> {
      const boardId = normalizeInput(input.boardId) ?? '';
      const subject = normalizeInput(input.subject) ?? '';
      const content = normalizeInput(input.content) ?? '';

      if (boardId === '' || subject === '' || content === '') {
        bad('bid, subject and content are required');
      }

      const result = await client.createPost({
        boardId,
        subject,
        content: nl2br(htmlSpecialChars(content)),
        replyContent: normalizeInput(input.replyContent),
        replyPostId: normalizeInput(input.replyPostId),
        attaches: (input.attaches ?? []) as never[],
      });

      return result.payload;
    },

    async updatePost(
      postId: string,
      input: UpdatePostInput,
    ): Promise<DiscussMutationPayload> {
      if (postId === '') {
        bad('postId is required');
      }

      const subject = normalizeInput(input.subject);
      const content = normalizeInput(input.content);

      if (subject === null && content === null) {
        bad('subject or content is required');
      }

      const result = await client.updatePost({
        postId,
        subject,
        content,
        attaches: (input.attaches ?? []) as never[],
      });

      return result.payload;
    },

    async deletePost(postId: string): Promise<DiscussMutationPayload> {
      if (postId === '') {
        bad('postId is required');
      }

      return (await client.deletePost(postId)).payload;
    },

    async likePost(
      boardId: string,
      nodeId: string,
    ): Promise<DiscussMutationPayload> {
      if (boardId === '' || nodeId === '') {
        bad('bid and nodeId are required');
      }

      return (await client.likePost(boardId, nodeId)).payload;
    },

    async unlikePost(
      boardId: string,
      nodeId: string,
    ): Promise<DiscussMutationPayload> {
      if (boardId === '' || nodeId === '') {
        bad('bid and nodeId are required');
      }

      return (await client.unlikePost(boardId, nodeId)).payload;
    },

    async createWhisper(
      boardId: string,
      nodeId: string,
      content: string,
    ): Promise<DiscussMutationPayload> {
      const cleaned = normalizeInput(content) ?? '';

      if (boardId === '' || nodeId === '' || cleaned === '') {
        bad('bid, nid and content are required');
      }

      return (
        await client.createWhisper(
          boardId,
          nodeId,
          nl2br(htmlSpecialChars(cleaned)),
        )
      ).payload;
    },

    async updateWhisper(
      boardId: string,
      nodeId: string,
      whisperId: string,
      content: string,
    ): Promise<DiscussMutationPayload> {
      const cleaned = normalizeInput(content) ?? '';

      if (
        boardId === '' ||
        nodeId === '' ||
        whisperId === '' ||
        cleaned === ''
      ) {
        bad('bid, nid, wid and content are required');
      }

      return (
        await client.updateWhisper(
          boardId,
          nodeId,
          whisperId,
          nl2br(htmlSpecialChars(cleaned)),
        )
      ).payload;
    },

    async deleteWhisper(
      boardId: string,
      nodeId: string,
      whisperId: string,
    ): Promise<DiscussMutationPayload> {
      if (boardId === '' || nodeId === '' || whisperId === '') {
        bad('bid, nid and wid are required');
      }

      return (await client.deleteWhisper(boardId, nodeId, whisperId)).payload;
    },

    async setForumRead(postId: string): Promise<DiscussMutationPayload> {
      if (postId === '') {
        bad('postId is required');
      }

      return (await client.setForumRead(postId)).payload;
    },
  };
}

export type DiscussServices = ReturnType<typeof createDiscussServices>;

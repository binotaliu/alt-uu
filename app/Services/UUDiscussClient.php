<?php

declare(strict_types=1);

namespace App\Services;

final class UUDiscussClient
{
    public function __construct(private readonly UUProxyClient $proxyClient) {}

    /**
     * @return array{payload: array<string, mixed>}
     */
    public function fetchBoardList(string $courseId): array
    {
        return $this->proxyClient->request('get-board-list', 'GET', [
            'cid' => $courseId,
            'include' => 1,
        ]);
    }

    /**
     * @return array{payload: array<string, mixed>}
     */
    public function fetchBoardNodeList(string $boardId, string $keyword = ''): array
    {
        return $this->proxyClient->request('get-board-node-list', 'GET', [
            'offset' => 0,
            'size' => 50,
            'bid' => $boardId,
            'keyword' => $keyword,
        ]);
    }

    /**
     * @return array{payload: array<string, mixed>}
     */
    public function fetchBoardReplyList(string $boardId, string $nodeId): array
    {
        return $this->proxyClient->request('get-board-reply-list', 'GET', [
            'offset' => 0,
            'size' => 50,
            'bid' => $boardId,
            'nid' => $nodeId,
        ]);
    }

    /**
     * @return array{payload: array<string, mixed>}
     */
    public function fetchWhispers(string $boardId, string $nodeId): array
    {
        return $this->proxyClient->request('board-whisper-handler', 'GET', [
            'bid' => $boardId,
            'nid' => $nodeId,
            'act' => 'get',
        ]);
    }

    /**
     * @param  array<mixed>  $attaches
     * @return array{payload: array<string, mixed>}
     */
    public function createPost(
        string $boardId,
        string $subject,
        string $content,
        ?string $replyContent = null,
        ?string $replyPostId = null,
        array $attaches = [],
    ): array {
        $body = array_filter(
            [
                'board_id' => $boardId,
                'subject' => $subject,
                'content' => $content,
                'reply_content' => $replyContent,
                'reply_post_id' => "{$boardId}_{$replyPostId}",
                'attaches' => $attaches,
            ],
            static fn ($value) => $value !== null,
        );

        return $this->proxyClient->request('add-course-post', 'POST', [], $body, 'json');
    }

    /**
     * @param  array<mixed>  $attaches
     * @return array{payload: array<string, mixed>}
     */
    public function updatePost(
        string $postId,
        ?string $subject = null,
        ?string $content = null,
        array $attaches = [],
    ): array {
        $body = array_filter(
            [
                'post_id' => $postId,
                'subject' => $subject,
                'content' => $content,
                'attaches' => $attaches,
            ],
            static fn ($value) => $value !== null,
        );

        return $this->proxyClient->request('mod-course-post', 'POST', [], $body, 'json');
    }

    /**
     * @return array{payload: array<string, mixed>}
     */
    public function deletePost(string $postId): array
    {
        return $this->proxyClient->request('del-course-post', 'GET', ['post_id' => $postId]);
    }

    /**
     * @return array{payload: array<string, mixed>}
     */
    public function createWhisper(string $boardId, string $nodeId, string $content): array
    {
        return $this->proxyClient->request('board-whisper-handler', 'POST', ['act' => 'set'], [
            'bid' => $boardId,
            'nid' => $nodeId,
            'content' => $content,
        ], 'json');
    }

    /**
     * @return array{payload: array<string, mixed>}
     */
    public function updateWhisper(string $boardId, string $nodeId, string $whisperId, string $content): array
    {
        return $this->proxyClient->request('board-whisper-handler', 'POST', ['act' => 'mod'], [
            'bid' => $boardId,
            'nid' => $nodeId,
            'wid' => $whisperId,
            'content' => $content,
        ], 'json');
    }

    /**
     * @return array{payload: array<string, mixed>}
     */
    public function deleteWhisper(string $boardId, string $nodeId, string $whisperId): array
    {
        return $this->proxyClient->request('board-whisper-handler', 'POST', ['act' => 'del'], [
            'bid' => $boardId,
            'nid' => $nodeId,
            'wid' => $whisperId,
        ], 'json');
    }

    /**
     * @return array{payload: array<string, mixed>}
     */
    public function likePost(string $boardId, string $nodeId): array
    {
        return $this->proxyClient->requestOnPath('/mooc/controllers/forum_ajax.php', 'POST', [], [
            'bid' => $boardId,
            'nid' => $nodeId,
            'sid' => 1000110001,
            'action' => 'setPush',
            'firstPush' => 1,
        ], 'form');
    }

    /**
     * @return array{payload: array<string, mixed>}
     */
    public function unlikePost(string $boardId, string $nodeId): array
    {
        return $this->proxyClient->requestOnPath('/mooc/controllers/forum_ajax.php', 'POST', [], [
            'bid' => $boardId,
            'nid' => $nodeId,
            'sid' => 1000110001,
            'action' => 'setPush',
            'firstPush' => 0,
        ], 'form');
    }

    /**
     * @return array{payload: array<string, mixed>}
     */
    public function setForumRead(string $postId): array
    {
        return $this->proxyClient->request('set-forum-read', 'GET', ['postid' => $postId]);
    }
}

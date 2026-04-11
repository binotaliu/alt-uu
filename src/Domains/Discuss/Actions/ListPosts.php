<?php

declare(strict_types=1);

namespace AltUU\Domains\Discuss\Actions;

use AltUU\Domains\Discuss\ViewModels\AttachmentViewModel;
use AltUU\Domains\Discuss\ViewModels\PostListViewModel;
use AltUU\Domains\Discuss\ViewModels\PostViewModel;
use AltUU\Domains\Discuss\ViewModels\WhisperViewModel;
use App\Services\UUDiscussClient;
use Illuminate\Support\Arr;
use Mews\Purifier\Facades\Purifier;

final readonly class ListPosts
{
    public function __construct(private UUDiscussClient $discussClient) {}

    public function __invoke(string $courseId, string $boardId, string $nodeId): PostListViewModel
    {
        $postsResult = $this->discussClient->fetchBoardReplyList($boardId, $nodeId);

        $postsList = Arr::get($postsResult['payload'], 'data.list', Arr::get($postsResult['payload'], 'data', []));

        if (! is_array($postsList)) {
            $postsList = [];
        }

        $posts = array_map(
            function (array $post, int $index) use ($boardId): PostViewModel {
                $postNode = isset($post['node']) && is_string($post['node']) ? $post['node'] : null;
                $whisperCount = isset($post['whispercnt']) ? (int) $post['whispercnt'] : 0;

                $whispers = [];
                if ($whisperCount > 0 && $postNode !== null) {
                    $whispers = $this->fetchWhispers($boardId, $postNode);
                }

                return new PostViewModel(
                    floor: (int) ($post['floor'] ?? $index + 1),
                    node: $postNode,
                    subject: isset($post['subject']) && is_string($post['subject']) ? $post['subject'] : null,
                    content: $this->sanitizeContent($post['content'] ?? null),
                    poster: $post['poster'] ?? null,
                    realname: $post['realname'] ?? null,
                    postDate: $post['post_date'] ?? null,
                    push: isset($post['push']) ? (int) $post['push'] : 0,
                    liked: isset($post['i_pushed']) ? (bool) $post['i_pushed'] : false,
                    whisperCount: $whisperCount,
                    whispers: $whispers,
                    attachments: $this->mapAttachments($post),
                );
            },
            $postsList,
            array_keys($postsList),
        );

        return new PostListViewModel(
            courseId: $courseId,
            boardId: $boardId,
            nodeId: $nodeId,
            posts: array_values($posts),
        );
    }

    /** @return WhisperViewModel[] */
    private function fetchWhispers(string $boardId, string $postNode): array
    {
        $whispersResult = $this->discussClient->fetchWhispers($boardId, $postNode);

        $whispersList = Arr::get($whispersResult['payload'], 'data.list', Arr::get($whispersResult['payload'], 'data', []));

        if (! is_array($whispersList)) {
            return [];
        }

        return array_values(array_map(
            fn (array $whisper): WhisperViewModel => new WhisperViewModel(
                wid: isset($whisper['wid']) ? (string) $whisper['wid'] : null,
                sid: isset($whisper['sid']) ? (string) $whisper['sid'] : null,
                creator: isset($whisper['creator']) ? (string) $whisper['creator'] : null,
                realname: isset($whisper['realname']) ? (string) $whisper['realname'] : null,
                content: $whisper['content'] ?? null,
                createTime: isset($whisper['create_time']) ? (string) $whisper['create_time'] : null,
                createTimeDescription: isset($whisper['create_time_description']) ? (string) $whisper['create_time_description'] : null,
                canDelete: isset($whisper['can_delete']) ? (bool) $whisper['can_delete'] : null,
            ),
            $whispersList,
        ));
    }

    private function sanitizeContent(?string $content): ?string
    {
        if (! is_string($content)) {
            return null;
        }

        return Purifier::clean($content);
    }

    /**
     * Discussion post attachments are optional and can be returned as a single field or nested array.
     *
     * @return AttachmentViewModel[]
     */
    private function mapAttachments(array $post): array
    {
        $attachments = Arr::get($post, 'attachment', Arr::get($post, 'attachments', []));

        if (! is_array($attachments)) {
            return [];
        }

        return array_values(array_filter(array_map(
            function ($attachment): ?AttachmentViewModel {
                if (! is_array($attachment)) {
                    return null;
                }

                $href = isset($attachment['href']) ? (string) $attachment['href'] : (isset($attachment['url']) ? (string) $attachment['url'] : null);

                return new AttachmentViewModel(
                    filename: isset($attachment['filename']) ? (string) $attachment['filename'] : (isset($attachment['name']) ? (string) $attachment['name'] : null),
                    href: $href,
                );
            },
            $attachments,
        )));
    }
}

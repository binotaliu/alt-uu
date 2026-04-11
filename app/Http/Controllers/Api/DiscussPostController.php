<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use AltUU\Domains\Discuss\Actions\CreatePost;
use AltUU\Domains\Discuss\Actions\DeletePost;
use AltUU\Domains\Discuss\Actions\ListPosts;
use AltUU\Domains\Discuss\Actions\UpdatePost;
use AltUU\Domains\Discuss\ViewModels\PostListViewModel;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

final class DiscussPostController
{
    public function index(
        Request $request,
        ListPosts $list,
    ): Response|PostListViewModel {
        $courseId = (string) $request->query('cid');
        $boardId = (string) $request->query('bid');
        $nodeId = (string) $request->query('nid');

        if ($courseId === '' || $boardId === '' || $nodeId === '') {
            return response(['error' => 'Course ID, Board ID, and Node ID are required'], 400);
        }

        return $list($courseId, $boardId, $nodeId);
    }

    /**
     * @return array<string, mixed>|Response
     */
    public function store(Request $request, CreatePost $createPost): array|Response
    {
        $boardId = (string) $request->input('bid');
        $subject = (string) $request->input('subject');
        $content = (string) $request->input('content');

        if ($boardId === '' || $subject === '' || $content === '') {
            return response(['error' => 'bid, subject and content are required'], 400);
        }

        $replyContent = $request->input('reply_content');
        $replyPostId = $request->input('reply_post_id');
        $attaches = $request->input('attaches', []);

        $result = $createPost(
            $boardId,
            $subject,
            $content,
            $replyContent,
            $replyPostId,
            is_array($attaches) ? $attaches : [],
        );

        return $result['payload'];
    }

    /**
     * @return array<string, mixed>|Response
     */
    public function update(Request $request, UpdatePost $updatePost, string $postId): array|Response
    {
        if ($postId === '') {
            return response(['error' => 'postId is required'], 400);
        }

        $subject = $request->input('subject');
        $content = $request->input('content');
        $attaches = $request->input('attaches', []);

        if ($subject === null && $content === null) {
            return response(['error' => 'subject or content is required'], 400);
        }

        $result = $updatePost(
            $postId,
            $subject !== null ? (string) $subject : null,
            $content !== null ? (string) $content : null,
            is_array($attaches) ? $attaches : [],
        );

        return $result['payload'];
    }

    /**
     * @return array<string, mixed>|Response
     */
    public function destroy(DeletePost $deletePost, string $postId): array|Response
    {
        if ($postId === '') {
            return response(['error' => 'postId is required'], 400);
        }

        $result = $deletePost($postId);

        return $result['payload'];
    }
}

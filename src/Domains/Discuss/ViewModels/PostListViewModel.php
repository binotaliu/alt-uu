<?php

declare(strict_types=1);

namespace AltUU\Domains\Discuss\ViewModels;

use Spatie\LaravelData\Resource;
use Spatie\TypeScriptTransformer\Attributes\TypeScript;

#[TypeScript]
final class PostListViewModel extends Resource
{
    /**
     * @param  PostViewModel[]  $posts
     */
    public function __construct(
        public string $courseId,
        public string $boardId,
        public string $nodeId,
        public array $posts,
    ) {}
}

<?php

declare(strict_types=1);

namespace AltUU\Domains\Discuss\ViewModels;

use Spatie\LaravelData\Resource;
use Spatie\TypeScriptTransformer\Attributes\TypeScript;

#[TypeScript]
final class PostViewModel extends Resource
{
    /**
     * @param  WhisperViewModel[]  $whispers
     * @param  AttachmentViewModel[]  $attachments
     */
    public function __construct(
        public int $floor,
        public ?string $node = null,
        public ?string $subject = null,
        public ?string $content = null,
        public ?string $poster = null,
        public ?string $realname = null,
        public ?string $postDate = null,
        public int $push = 0,
        public bool $liked = false,
        public int $whisperCount = 0,
        public array $whispers = [],
        public array $attachments = [],
    ) {}
}

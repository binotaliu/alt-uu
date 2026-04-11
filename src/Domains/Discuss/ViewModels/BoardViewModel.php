<?php

declare(strict_types=1);

namespace AltUU\Domains\Discuss\ViewModels;

use Spatie\LaravelData\Resource;
use Spatie\TypeScriptTransformer\Attributes\TypeScript;

#[TypeScript]
final class BoardViewModel extends Resource
{
    public function __construct(
        public string $boardId,
        public string $boardName,
        public bool $allowPost,
        public bool $hasNewPost,
        public ?int $subjectCount = null,
    ) {}
}

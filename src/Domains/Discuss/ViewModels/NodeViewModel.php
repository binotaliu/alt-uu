<?php

declare(strict_types=1);

namespace AltUU\Domains\Discuss\ViewModels;

use Spatie\LaravelData\Resource;
use Spatie\TypeScriptTransformer\Attributes\TypeScript;

#[TypeScript]
final class NodeViewModel extends Resource
{
    public function __construct(
        public string $node,
        public string $subject,
        public bool $isRead = false,
        public ?string $poster = null,
        public ?int $repliesCount = null,
        public ?int $likesCount = null,
    ) {}
}

<?php

declare(strict_types=1);

namespace AltUU\Domains\Discuss\ViewModels;

use Spatie\LaravelData\Resource;
use Spatie\TypeScriptTransformer\Attributes\TypeScript;

#[TypeScript]
final class WhisperViewModel extends Resource
{
    public function __construct(
        public ?string $wid = null,
        public ?string $sid = null,
        public ?string $creator = null,
        public ?string $realname = null,
        public ?string $content = null,
        public ?string $createTime = null,
        public ?string $createTimeDescription = null,
        public ?bool $canDelete = null,
    ) {}
}

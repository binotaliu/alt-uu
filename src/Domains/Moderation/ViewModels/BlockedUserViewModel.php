<?php

declare(strict_types=1);

namespace AltUU\Domains\Moderation\ViewModels;

use Spatie\LaravelData\Resource;
use Spatie\TypeScriptTransformer\Attributes\TypeScript;

#[TypeScript]
final class BlockedUserViewModel extends Resource
{
    public function __construct(
        public string $poster,
        public string $realname,
    ) {}
}

<?php

declare(strict_types=1);

namespace AltUU\Domains\Auth\ViewModels;

use Spatie\LaravelData\Resource;
use Spatie\TypeScriptTransformer\Attributes\TypeScript;

#[TypeScript]
final class SessionProfileViewModel extends Resource
{
    public function __construct(
        public ?string $displayName,
        public ?string $nickname,
        public ?string $picture,
        public ?string $username,
    ) {}
}

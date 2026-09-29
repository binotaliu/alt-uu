<?php

declare(strict_types=1);

namespace AltUU\Domains\AppStatus\ViewModels;

use Spatie\LaravelData\Resource;
use Spatie\TypeScriptTransformer\Attributes\TypeScript;

#[TypeScript]
final class AnnouncementViewModel extends Resource
{
    public function __construct(
        public string $dismissKey,
        public string $severity,
        public string $title,
        public string $body,
        public ?string $url,
        public bool $dismissible,
    ) {}
}

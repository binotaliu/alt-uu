<?php

declare(strict_types=1);

namespace AltUU\Domains\Discuss\ViewModels;

use Spatie\LaravelData\Resource;
use Spatie\TypeScriptTransformer\Attributes\TypeScript;

#[TypeScript]
final class AttachmentViewModel extends Resource
{
    public function __construct(
        public ?string $filename = null,
        public ?string $href = null,
    ) {}
}

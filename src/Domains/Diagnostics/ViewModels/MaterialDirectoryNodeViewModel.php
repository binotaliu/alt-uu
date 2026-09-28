<?php

declare(strict_types=1);

namespace AltUU\Domains\Diagnostics\ViewModels;

use Spatie\LaravelData\Resource;
use Spatie\TypeScriptTransformer\Attributes\TypeScript;

#[TypeScript]
final class MaterialDirectoryNodeViewModel extends Resource
{
    public function __construct(
        public string $identifier,
        public string $text,
        public int $level,
        public ?string $href,
        public bool $leaf,
        public bool $itemDisabled,
        public bool $isInspectable,
    ) {}
}

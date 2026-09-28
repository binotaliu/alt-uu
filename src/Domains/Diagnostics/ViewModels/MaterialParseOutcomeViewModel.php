<?php

declare(strict_types=1);

namespace AltUU\Domains\Diagnostics\ViewModels;

use Spatie\LaravelData\Resource;
use Spatie\TypeScriptTransformer\Attributes\TypeScript;

/**
 * What ParseMaterialContent made of a page. `kind` says which of the outputs
 * the viewer would have shown, and `empty` is the one that renders the
 * 「此節點沒有可顯示的教材內容」 message.
 */
#[TypeScript]
final class MaterialParseOutcomeViewModel extends Resource
{
    public function __construct(
        public bool $succeeded,
        public string $kind,
        public ?string $videoUrl,
        public int $htmlLength,
        public ?string $downloadFileName,
        public ?string $errorClass,
        public ?string $errorMessage,
        public ?string $errorLocation,
    ) {}
}

<?php

declare(strict_types=1);

namespace AltUU\Domains\Diagnostics\ViewModels;

use Spatie\LaravelData\Resource;
use Spatie\TypeScriptTransformer\Attributes\TypeScript;

#[TypeScript]
final class MaterialSourceInspectionViewModel extends Resource
{
    public function __construct(
        public string $cid,
        public string $scoid,
        public string $nodeText,
        public string $url,
        public ?int $fetchStatus,
        public ?string $contentType,
        public int $bodyBytes,
        public bool $isText,
        public ?string $body,
        public bool $bodyTruncated,
        public ?string $fetchError,
        public MaterialParseOutcomeViewModel $parse,
    ) {}
}

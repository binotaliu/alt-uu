<?php

declare(strict_types=1);

namespace AltUU\Domains\AttachmentDownload\DataTransferObjects;

use Spatie\LaravelData\Attributes\Validation\Max;
use Spatie\LaravelData\Attributes\Validation\Nullable;
use Spatie\LaravelData\Attributes\Validation\Required;
use Spatie\LaravelData\Attributes\Validation\Url;
use Spatie\LaravelData\Data;
use Spatie\TypeScriptTransformer\Attributes\TypeScript;

#[TypeScript]
final class QueueAttachmentDownloadInputData extends Data
{
    public function __construct(
        #[Required, Max(64)]
        public string $cid,
        #[Required, Url, Max(2000)]
        public string $sourceUrl,
        #[Nullable, Max(255)]
        public ?string $filename = null,
    ) {}
}

<?php

declare(strict_types=1);

namespace AltUU\Domains\Course\DataTransferObjects;

use Spatie\LaravelData\Attributes\Validation\Max;
use Spatie\LaravelData\Attributes\Validation\Required;
use Spatie\LaravelData\Attributes\Validation\Url;
use Spatie\LaravelData\Data;
use Spatie\TypeScriptTransformer\Attributes\TypeScript;

#[TypeScript]
final class MaterialContentInputData extends Data
{
    public function __construct(
        #[Required, Url, Max(2000)]
        public string $url,
    ) {}
}

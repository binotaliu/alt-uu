<?php

declare(strict_types=1);

namespace AltUU\Domains\Course\Actions\Results;

final readonly class ParsedMaterialContentResult
{
    public function __construct(
        public ?string $videoUrl,
        public ?string $subtitleUrl,
        public ?string $pdfUrl,
        public string $htmlContent,
    ) {}
}

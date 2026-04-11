<?php

declare(strict_types=1);

namespace AltUU\Domains\Course\ViewModels;

use AltUU\Domains\Course\Actions\Results\ParsedMaterialContentResult;
use Spatie\LaravelData\Resource;
use Spatie\TypeScriptTransformer\Attributes\TypeScript;

#[TypeScript]
final class ParsedMaterialContentViewModel extends Resource
{
    public function __construct(
        public ?string $videoUrl,
        public ?string $subtitleUrl,
        public ?string $pdfUrl,
        public ?string $htmlContent,
    ) {}

    public static function fromResult(ParsedMaterialContentResult $result): self
    {
        return new self(
            videoUrl: $result->videoUrl,
            subtitleUrl: $result->subtitleUrl,
            pdfUrl: $result->pdfUrl,
            htmlContent: $result->htmlContent,
        );
    }

    public static function emptyContent(): self
    {
        return new self(
            videoUrl: null,
            subtitleUrl: null,
            pdfUrl: null,
            htmlContent: null,
        );
    }
}

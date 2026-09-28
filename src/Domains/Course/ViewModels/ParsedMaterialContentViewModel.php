<?php

declare(strict_types=1);

namespace AltUU\Domains\Course\ViewModels;

use AltUU\Domains\Course\Actions\Results\ParsedMaterialContentResult;
use AltUU\Domains\Course\Enums\VideoProvider;
use Spatie\LaravelData\Resource;
use Spatie\TypeScriptTransformer\Attributes\TypeScript;

#[TypeScript]
final class ParsedMaterialContentViewModel extends Resource
{
    public function __construct(
        public ?string $videoUrl,
        public ?string $subtitleUrl,
        public ?string $downloadUrl,
        public ?string $downloadProxyUrl,
        public ?string $downloadFileName,
        public ?string $downloadFileExtension,
        public bool $isPdf,
        public ?string $htmlContent,
        public VideoProvider $videoProvider,
        public ?string $embedVideoUrl,
    ) {}

    public static function fromResult(ParsedMaterialContentResult $result): self
    {
        return new self(
            videoUrl: $result->videoUrl,
            subtitleUrl: $result->subtitleUrl,
            downloadUrl: $result->downloadUrl,
            downloadProxyUrl: $result->downloadProxyUrl,
            downloadFileName: $result->downloadFileName,
            downloadFileExtension: $result->downloadFileExtension,
            isPdf: $result->isPdf,
            htmlContent: $result->htmlContent,
            videoProvider: $result->videoProvider,
            embedVideoUrl: $result->embedVideoUrl,
        );
    }

    public static function emptyContent(): self
    {
        return new self(
            videoUrl: null,
            subtitleUrl: null,
            downloadUrl: null,
            downloadProxyUrl: null,
            downloadFileName: null,
            downloadFileExtension: null,
            isPdf: false,
            htmlContent: null,
            videoProvider: VideoProvider::Native,
            embedVideoUrl: null,
        );
    }
}

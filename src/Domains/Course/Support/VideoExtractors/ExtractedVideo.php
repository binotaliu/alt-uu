<?php

declare(strict_types=1);

namespace AltUU\Domains\Course\Support\VideoExtractors;

final readonly class ExtractedVideo
{
    public function __construct(
        public ?string $videoUrl,
        public ?string $subtitleUrl = null,
    ) {}

    public static function none(): self
    {
        return new self(videoUrl: null);
    }
}

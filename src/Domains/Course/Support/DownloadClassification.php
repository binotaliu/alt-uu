<?php

declare(strict_types=1);

namespace AltUU\Domains\Course\Support;

final readonly class DownloadClassification
{
    public function __construct(
        public string $extension,
        public bool $isPdf,
    ) {}

    public static function pdf(string $extension): self
    {
        return new self(extension: $extension !== '' ? $extension : 'pdf', isPdf: true);
    }

    public static function binary(string $extension): self
    {
        return new self(extension: $extension, isPdf: false);
    }
}

<?php

declare(strict_types=1);

namespace AltUU\Domains\Course\ViewModels;

use Spatie\LaravelData\Resource;
use Spatie\TypeScriptTransformer\Attributes\TypeScript;

#[TypeScript]
final class CourseMaterialResourceViewModel extends Resource
{
    public function __construct(
        public ?string $downloadPath = null,
        public ?string $relativePath = null,
        public int $updateDatetime = 0,
        public int $size = 0,
        public string $metadata = '',
        public ?string $filename = null,
        public ?string $title = null,
        public ?string $href = null,
    ) {}

    /**
     * @param  array<string, mixed>  $payload
     */
    public static function fromPayload(array $payload): self
    {
        return new self(
            downloadPath: is_string($payload['download_path'] ?? null) ? $payload['download_path'] : null,
            relativePath: is_string($payload['relative_path'] ?? null) ? $payload['relative_path'] : null,
            updateDatetime: (int) ($payload['update_datetime'] ?? 0),
            size: (int) ($payload['size'] ?? 0),
            metadata: is_string($payload['metadata'] ?? null) ? $payload['metadata'] : '',
            filename: is_string($payload['filename'] ?? null) ? $payload['filename'] : null,
            title: is_string($payload['title'] ?? null) ? $payload['title'] : null,
            href: is_string($payload['href'] ?? null) ? $payload['href'] : null,
        );
    }
}

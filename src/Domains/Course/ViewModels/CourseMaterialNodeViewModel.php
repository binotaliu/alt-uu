<?php

declare(strict_types=1);

namespace AltUU\Domains\Course\ViewModels;

use Spatie\LaravelData\Resource;
use Spatie\TypeScriptTransformer\Attributes\TypeScript;

#[TypeScript]
final class CourseMaterialNodeViewModel extends Resource
{
    public function __construct(
        public string $identifier = '',
        public ?string $href = null,
        public string $text = '',
        public bool $readed = false,
        public int $level = 0,
        public bool $leaf = false,
        public bool $itemDisabled = false,
    ) {}

    /**
     * @param  array<string, mixed>  $payload
     */
    public static function fromPayload(array $payload): self
    {
        $href = is_string($payload['href'] ?? null) ? trim($payload['href']) : null;

        // Some nodes may include placeholder URLs like "about:blank".
        // Treat them as folder/group nodes rather than navigable content.
        $isDisabled = (bool) ($payload['itemDisabled'] ?? false);

        if ($href !== null && str_starts_with(strtolower($href), 'about:blank')) {
            $href = null;
            $isDisabled = true;
        }

        return new self(
            identifier: (string) ($payload['identifier'] ?? ''),
            href: $href,
            text: is_string($payload['text'] ?? null) ? $payload['text'] : '',
            readed: (bool) ($payload['readed'] ?? false),
            level: (int) ($payload['level'] ?? 0),
            leaf: (bool) ($payload['leaf'] ?? false),
            itemDisabled: $isDisabled,
        );
    }
}

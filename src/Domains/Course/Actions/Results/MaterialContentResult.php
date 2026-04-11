<?php

declare(strict_types=1);

namespace AltUU\Domains\Course\Actions\Results;

final readonly class MaterialContentResult
{
    /**
     * @param  array<string, string>  $headers
     */
    public function __construct(
        public int $status,
        public string $body,
        public array $headers,
    ) {}
}

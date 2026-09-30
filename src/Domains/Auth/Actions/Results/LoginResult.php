<?php

declare(strict_types=1);

namespace AltUU\Domains\Auth\Actions\Results;

final readonly class LoginResult
{
    /**
     * @param  array<string, mixed>|null  $raw
     */
    public function __construct(
        public bool $ok,
        public string $message = '',
        public ?array $raw = null,
    ) {}
}

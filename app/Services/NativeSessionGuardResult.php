<?php

declare(strict_types=1);

namespace App\Services;

final readonly class NativeSessionGuardResult
{
    /**
     * @param  array<string, mixed>|null  $session
     * @param  array<string, mixed>  $redirectParameters
     */
    private function __construct(
        public bool $proceeds,
        public ?array $session = null,
        public ?string $redirectRoute = null,
        public array $redirectParameters = [],
        public ?int $failedAccountId = null,
    ) {}

    /**
     * @param  array<string, mixed>  $session
     */
    public static function proceed(array $session): self
    {
        return new self(proceeds: true, session: $session);
    }

    /**
     * @param  array<string, mixed>  $parameters
     */
    public static function redirect(string $route, array $parameters = [], ?int $failedAccountId = null): self
    {
        return new self(
            proceeds: false,
            redirectRoute: $route,
            redirectParameters: $parameters,
            failedAccountId: $failedAccountId,
        );
    }
}

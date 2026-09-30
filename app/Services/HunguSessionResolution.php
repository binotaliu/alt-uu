<?php

declare(strict_types=1);

namespace App\Services;

final readonly class HunguSessionResolution
{
    /**
     * @param  array<string, mixed>|null  $session  The active account's Hungu session, or null when none could be established.
     * @param  int|null  $attemptedAccountId  The account that was active before resolving; it is the one that just
     *                                        failed when $session is null.
     */
    public function __construct(
        public ?array $session,
        public ?int $attemptedAccountId,
    ) {}

    public function isAuthenticated(): bool
    {
        return $this->session !== null;
    }
}

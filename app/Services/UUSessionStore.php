<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\Account;

class UUSessionStore
{
    public function __construct(
        private readonly AccountActiveProfile $activeProfile,
    ) {}

    /**
     * @return array<string, mixed>|null
     */
    public function get(?int $accountId = null): ?array
    {
        return $this->resolveAccount($accountId)?->hungu_session;
    }

    /**
     * @param  array<string, mixed>  $session
     */
    public function put(array $session, ?int $accountId = null): void
    {
        $this->resolveAccount($accountId)?->update(['hungu_session' => $session]);
    }

    public function forget(?int $accountId = null): void
    {
        $this->resolveAccount($accountId)?->update(['hungu_session' => null]);
    }

    public function has(?int $accountId = null): bool
    {
        return $this->get($accountId) !== null;
    }

    private function resolveAccount(?int $accountId): ?Account
    {
        $accountId ??= $this->activeProfile->get();

        return $accountId !== null ? Account::find($accountId) : null;
    }
}

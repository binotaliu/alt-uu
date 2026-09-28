<?php

declare(strict_types=1);

namespace App\Services;

final class AccountContext
{
    public function __construct(private readonly AccountActiveProfile $activeProfile) {}

    public function currentAccountId(): ?int
    {
        return $this->activeProfile->get();
    }
}

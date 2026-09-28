<?php

declare(strict_types=1);

namespace AltUU\Domains\Account\Actions;

use App\Services\AccountManager;

final readonly class HasAnyAccounts
{
    public function __construct(private AccountManager $accounts) {}

    public function __invoke(): bool
    {
        return $this->accounts->count() > 0;
    }
}

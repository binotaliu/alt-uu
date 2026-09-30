<?php

declare(strict_types=1);

namespace AltUU\Domains\Account\Actions\Results;

use AltUU\Domains\Account\ViewModels\AccountViewModel;

final readonly class AccountSessionResult
{
    /**
     * @param  array<int, AccountViewModel>  $accounts  Empty when the login failed and the action does not list accounts.
     * @param  array<string, mixed>|null  $raw  Upstream payload of a rejected login, when available.
     */
    public function __construct(
        public bool $ok,
        public string $message = '',
        public array $accounts = [],
        public ?array $raw = null,
    ) {}
}

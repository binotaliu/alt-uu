<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\Account;
use Illuminate\Database\Eloquent\Collection;

class AccountCredentialsStore
{
    public function __construct(
        private readonly AccountActiveProfile $activeProfile,
    ) {}

    /**
     * @return array{username: string, password: string}|null
     */
    public function get(?int $accountId = null): ?array
    {
        $account = $this->resolveAccount($accountId);

        if ($account === null) {
            return null;
        }

        return [
            'username' => $account->username,
            'password' => $account->password,
        ];
    }

    public function put(string $username, string $password): void
    {
        $username = trim($username);

        $account = Account::withTrashed()->firstOrNew(['username' => $username]);
        $account->password = $password;

        if ($account->trashed()) {
            $account->restore();
        } else {
            $account->save();
        }

        $this->activeProfile->set($account->id);
    }

    public function forget(?int $accountId = null, bool $clearActiveProfile = true): void
    {
        $account = $this->resolveAccount($accountId);

        if ($account === null) {
            return;
        }

        $wasActive = $this->activeProfile->get() === $account->id;

        $account->forceFill([
            'password' => null,
            'hungu_session' => null,
            'school_portal_session' => null,
        ])->save();

        $account->delete();

        if ($wasActive && $clearActiveProfile) {
            $this->activeProfile->clear();
        }
    }

    public function has(?int $accountId = null): bool
    {
        return $this->get($accountId) !== null;
    }

    /**
     * @return Collection<int, Account>
     */
    public function all(): Collection
    {
        return Account::all();
    }

    private function resolveAccount(?int $accountId): ?Account
    {
        $accountId ??= $this->activeProfile->get();

        return $accountId !== null ? Account::find($accountId) : null;
    }
}

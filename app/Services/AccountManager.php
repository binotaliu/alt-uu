<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\Account;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Arr;

final class AccountManager
{
    public function __construct(
        private readonly AccountCredentialsStore $credentialsStore,
        private readonly AccountActiveProfile $activeProfile,
        private readonly UUSessionAuthenticator $authenticator,
        private readonly UUSessionStore $sessionStore,
        private readonly UUProfileSession $profileSession,
    ) {}

    /**
     * @return Collection<int, Account>
     */
    public function all(): Collection
    {
        return $this->credentialsStore->all();
    }

    public function count(): int
    {
        return $this->credentialsStore->all()->count();
    }

    public function activeId(): ?int
    {
        return $this->activeProfile->get();
    }

    /**
     * @return array{ok: bool, message: string}
     */
    public function attemptLogin(string $username, string $password): array
    {
        return $this->authenticator->attemptLogin($username, $password);
    }

    /**
     * Profile stored on the active account's Hungu session, if any.
     *
     * @return array<string, mixed>|null
     */
    public function activeProfile(): ?array
    {
        $profile = Arr::get($this->sessionStore->get(), 'profile');

        return is_array($profile) ? $profile : null;
    }

    public function forget(int $accountId): void
    {
        $this->credentialsStore->forget($accountId);
    }

    /**
     * Makes the given account the active profile and ensures its Hungu
     * session is valid, refreshing the Laravel session's displayed profile.
     */
    public function activate(Account $account): bool
    {
        $this->activeProfile->set($account->id);

        $session = $this->sessionStore->get();

        if (! is_array($session) && $this->authenticator->attemptRememberedLogin()) {
            $session = $this->sessionStore->get();
        }

        if (! is_array($session)) {
            $this->profileSession->forget();

            return false;
        }

        $profile = Arr::get($session, 'profile');

        if (is_array($profile)) {
            $this->profileSession->put($profile);
        }

        return true;
    }
}

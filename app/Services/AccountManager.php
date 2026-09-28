<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\Account;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\Request;
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
    public function attemptLogin(Request $request, string $username, string $password): array
    {
        return $this->authenticator->attemptLogin($request, $username, $password);
    }

    public function forget(int $accountId): void
    {
        $this->credentialsStore->forget($accountId);
    }

    /**
     * Makes the given account the active profile and ensures its Hungu
     * session is valid, refreshing the Laravel session's displayed profile.
     */
    public function activate(Request $request, Account $account): bool
    {
        $this->activeProfile->set($account->id);

        $session = $this->sessionStore->get();

        if (! is_array($session) && $this->authenticator->attemptRememberedLogin($request)) {
            $session = $this->sessionStore->get();
        }

        if (! is_array($session)) {
            $this->profileSession->forget($request);

            return false;
        }

        $profile = Arr::get($session, 'profile');

        if (is_array($profile)) {
            $this->profileSession->put($request, $profile);
        }

        return true;
    }
}

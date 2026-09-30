<?php

declare(strict_types=1);

namespace App\Services;

use Illuminate\Support\Arr;

/**
 * Request-independent core of the "is there a usable Hungu session" check,
 * shared by the EnsureHunguSession middleware and the native session guard.
 */
final class HunguSessionResolver
{
    public function __construct(
        private readonly UUSessionStore $sessionStore,
        private readonly UUSessionAuthenticator $authenticator,
        private readonly UUProfileSession $profileSession,
        private readonly AccountActiveProfile $activeProfile,
    ) {}

    /**
     * Loads the active account's session, falling back to a remembered login.
     * On failure the displayed profile is dropped from the Laravel session.
     */
    public function resolve(): HunguSessionResolution
    {
        // Captured before attemptRememberedLogin runs: a failed remembered
        // login soft-deletes the active account and clears this pointer, so
        // reading it afterwards would lose track of which account just died.
        $attemptedAccountId = $this->activeProfile->get();

        $session = $this->sessionStore->get();

        if (! is_array($session) && $this->authenticator->attemptRememberedLogin()) {
            $session = $this->sessionStore->get();
        }

        if (! is_array($session)) {
            $this->profileSession->forget();

            return new HunguSessionResolution(null, $attemptedAccountId);
        }

        return new HunguSessionResolution($session, $attemptedAccountId);
    }

    /**
     * Mirrors the session's profile into the Laravel session so the
     * per-user caches keyed on `hungu.profile.username` resolve correctly.
     *
     * @param  array<string, mixed>  $session
     */
    public function primeProfile(array $session): void
    {
        $profile = Arr::get($session, 'profile');

        if (is_array($profile)) {
            $this->profileSession->put($profile);
        }
    }
}

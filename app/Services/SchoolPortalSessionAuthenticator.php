<?php

declare(strict_types=1);

namespace App\Services;

class SchoolPortalSessionAuthenticator
{
    public function __construct(
        private readonly SchoolPortalProxyClient $proxyClient,
        private readonly AccountCredentialsStore $accountCredentialsStore,
    ) {}

    /**
     * Silently logs into the school portal using the credentials already
     * saved for Hongu auto re-login (same student ID/password, per the
     * NOU school system's shared credential model).
     */
    public function attemptRememberedLogin(): bool
    {
        $credentials = $this->accountCredentialsStore->get();

        if (! is_array($credentials)) {
            return false;
        }

        return $this->proxyClient->login($credentials['username'], $credentials['password']);
    }
}

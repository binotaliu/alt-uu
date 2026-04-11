<?php

declare(strict_types=1);

namespace App\Services;

use Illuminate\Http\Request;

final class UUAuthClient
{
    public function __construct(
        private readonly UUSessionAuthenticator $authenticator,
        private readonly UUProxyClient $proxyClient,
        private readonly UUSessionStore $sessionStore,
        private readonly UUProfileSession $profileSession,
        private readonly UURememberedCredentialsStore $rememberedCredentialsStore,
    ) {}

    /**
     * @return array{ok: bool, message: string}
     */
    public function attemptLogin(Request $request, string $username, string $password): array
    {
        return $this->authenticator->attemptLogin($request, $username, $password);
    }

    public function logout(Request $request): void
    {
        $this->proxyClient->request('logout', 'POST');
        $this->sessionStore->forget();
        $this->rememberedCredentialsStore->forget();
        $this->profileSession->forget($request);
    }
}

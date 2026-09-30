<?php

declare(strict_types=1);

namespace App\Services;

/**
 * Native counterpart of the EnsureHunguSession middleware: no Request, no
 * boot-validation cookie. Native components call it (usually through
 * App\NativeComponents\Concerns\GuardsHunguSession) before touching any
 * course data.
 */
final class NativeSessionGuard
{
    public const LOGIN_ROUTE = 'native.login';

    public const REAUTH_ROUTE = 'native.reauth';

    public function __construct(
        private readonly HunguSessionResolver $resolver,
        private readonly UUSessionStore $sessionStore,
        private readonly UUSessionAuthenticator $authenticator,
    ) {}

    /**
     * @param  bool  $validateRemotely  Also ask the upstream platform whether the stored session is still alive
     *                                  (the equivalent of the SPA's /api/bootstrap-session boot check). Use it once
     *                                  at app start, not on every screen.
     */
    public function check(bool $validateRemotely = false): NativeSessionGuardResult
    {
        if ($validateRemotely && $this->sessionStore->has()) {
            $this->authenticator->validateCurrentSession();
        }

        $resolution = $this->resolver->resolve();

        if (! $resolution->isAuthenticated()) {
            return $this->redirectFor($resolution->attemptedAccountId);
        }

        $this->resolver->primeProfile($resolution->session);

        return NativeSessionGuardResult::proceed($resolution->session);
    }

    private function redirectFor(?int $failedAccountId): NativeSessionGuardResult
    {
        if ($failedAccountId === null) {
            return NativeSessionGuardResult::redirect(self::LOGIN_ROUTE);
        }

        return NativeSessionGuardResult::redirect(
            self::REAUTH_ROUTE,
            ['accountId' => $failedAccountId],
            $failedAccountId,
        );
    }
}

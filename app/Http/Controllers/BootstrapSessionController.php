<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use AltUU\Domains\AppPreference\Actions\GetNouToolsIntegrationEnabled;
use App\Services\UUSessionAuthenticator;
use App\Services\UUSessionStore;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

final class BootstrapSessionController
{
    /**
     * @return array{ok: bool, redirect: string, showOnboarding: bool, nouToolsIntegrationEnabled: bool}|Response
     */
    public function __invoke(
        Request $request,
        UUSessionStore $sessionStore,
        UUSessionAuthenticator $authenticator,
        GetNouToolsIntegrationEnabled $getNouToolsEnabled,
    ): array|Response {
        $sessionIsValid = false;

        if ($sessionStore->has()) {
            $sessionIsValid = $authenticator->validateCurrentSession($request);
        }

        if (! $sessionIsValid) {
            $sessionIsValid = $authenticator->attemptRememberedLogin($request);
        }

        if (! $sessionIsValid) {
            return [
                'ok' => true,
                'redirect' => '/login',
                'nouToolsIntegrationEnabled' => $getNouToolsEnabled(),
            ];
        }

        $this->queueAppBootCookie();

        return [
            'ok' => true,
            'redirect' => '/courses',
            'nouToolsIntegrationEnabled' => $getNouToolsEnabled(),
        ];
    }

    private function queueAppBootCookie(): void
    {
        cookie()->queue(cookie(
            $this->appBootCookieName(),
            '1',
            (int) config('hungu.cookie_minutes', 720),
        ));
    }

    private function appBootCookieName(): string
    {
        return (string) config('hungu.app_boot_cookie_name', 'hungu_app_boot');
    }
}

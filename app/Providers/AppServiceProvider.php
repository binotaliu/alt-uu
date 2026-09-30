<?php

declare(strict_types=1);

namespace App\Providers;

use App\Http\Middleware\EnsureHunguSession;
use App\Services\Diagnostics\DiagnosticRecorder;
use App\Services\Diagnostics\DiagnosticRedactor;
use App\Services\Diagnostics\DiagnosticSalt;
use App\Services\Diagnostics\UpstreamCallSubscriber;
use App\Services\Diagnostics\UpstreamRecordingSwitch;
use App\Services\SchoolPortalProxyClient;
use App\Services\SchoolPortalSessionAuthenticator;
use App\Services\UUProxyClient;
use App\Services\UUSessionAuthenticator;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Date;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\ServiceProvider;
use Illuminate\Validation\Rules\Password;
use JsonException;

final class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->singleton(DiagnosticSalt::class);

        $this->app->singleton(
            DiagnosticRedactor::class,
            fn ($app): DiagnosticRedactor => new DiagnosticRedactor(
                $app->make(DiagnosticSalt::class)->value(),
            ),
        );

        // Both hold state across events: the switch spans a closure, and the
        // listener correlates RequestSending with ResponseReceived. Laravel
        // registers subscribers by class name and re-resolves on every
        // dispatch, so without these they would lose that state.
        $this->app->singleton(UpstreamRecordingSwitch::class);
        $this->app->singleton(UpstreamCallSubscriber::class);

        // Shared so its per-request "is recording on?" memo is resolved once
        // rather than once per injection site.
        $this->app->singleton(DiagnosticRecorder::class);
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        $this->configureDefaults();

        $this->app->resolving(UUProxyClient::class, function (UUProxyClient $proxyClient, $app): void {
            $proxyClient->setReauthenticationHandler(function () use ($app): bool {
                $authenticator = $app->make(UUSessionAuthenticator::class);

                return $authenticator->attemptRememberedLogin();
            });
        });

        $this->app->resolving(SchoolPortalProxyClient::class, function (SchoolPortalProxyClient $proxyClient, $app): void {
            $proxyClient->setReauthenticationHandler(function () use ($app): bool {
                $authenticator = $app->make(SchoolPortalSessionAuthenticator::class);

                return $authenticator->attemptRememberedLogin();
            });
        });
    }

    /**
     * Configure default behaviors for production-ready applications.
     */
    private function configureDefaults(): void
    {
        Request::macro('hunguSession', function (): array {
            /** @var Request $this */
            $attributeSession = $this->attributes->get(EnsureHunguSession::REQUEST_ATTRIBUTE);
            if (is_array($attributeSession)) {
                return $attributeSession;
            }

            $json = $this->cookie(config('hungu.cookie_name', 'hungu_session'), default: 'null');

            try {
                $session = json_decode($json, true, 512, JSON_THROW_ON_ERROR);
            } catch (JsonException) {
                return [];
            }

            if (! is_array($session)) {
                return [];
            }

            $this->attributes->set(EnsureHunguSession::REQUEST_ATTRIBUTE, $session);

            return $session;
        });

        Date::use(CarbonImmutable::class);

        DB::prohibitDestructiveCommands(
            app()->isProduction(),
        );

        Password::defaults(fn (): ?Password => app()->isProduction()
            ? Password::min(12)
                ->mixedCase()
                ->letters()
                ->numbers()
                ->symbols()
                ->uncompromised()
            : null,
        );
    }
}

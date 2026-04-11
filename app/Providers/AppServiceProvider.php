<?php

declare(strict_types=1);

namespace App\Providers;

use AltUU\Domains\AppPreference\Actions\GetAppearance;
use AltUU\Domains\AppPreference\Actions\GetOnboardingCompleted;
use App\Http\Middleware\EnsureHunguSession;
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
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        $this->configureDefaults();

        view()->composer('app', function ($view): void {
            $view->with('appearance', app(GetAppearance::class)());
            $view->with('showOnboarding', ! app(GetOnboardingCompleted::class)());
        });

        $this->app->resolving(UUProxyClient::class, function (UUProxyClient $proxyClient, $app): void {
            $proxyClient->setReauthenticationHandler(function () use ($app): bool {
                $request = $app->make(Request::class);
                $authenticator = $app->make(UUSessionAuthenticator::class);

                return $authenticator->attemptRememberedLogin($request);
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

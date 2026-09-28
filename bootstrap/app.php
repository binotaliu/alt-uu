<?php

use AltUU\Domains\Diagnostics\Enums\DiagnosticEventTypeEnum;
use AltUU\Domains\Diagnostics\Enums\DiagnosticLevelEnum;
use App\Exceptions\ExternalServiceUnavailableException;
use App\Http\Middleware\RecordDiagnostics;
use App\Services\Diagnostics\DiagnosticRecorder;
use App\Services\Diagnostics\JsonExceptionRenderer;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Foundation\Http\Middleware\ValidateCsrfToken;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Middleware\AddLinkHeadersForPreloadedAssets;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->web(remove: [
            ValidateCsrfToken::class,
        ]);

        $middleware->encryptCookies(except: ['appearance', 'sidebar_state']);

        $middleware->web(append: [
            AddLinkHeadersForPreloadedAssets::class,
        ]);

        // Outermost, so a request that fails inside another middleware still
        // gets a correlation id and still lands in the diagnostic log.
        $middleware->prepend(RecordDiagnostics::class);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->report(function (Throwable $e): void {
            app(DiagnosticRecorder::class)->record(
                DiagnosticEventTypeEnum::Exception,
                $e::class.': '.$e->getMessage(),
                DiagnosticLevelEnum::Error,
                [
                    'class' => $e::class,
                    'file' => $e->getFile(),
                    'line' => $e->getLine(),
                ],
            );
        });

        $exceptions->render(function (ConnectionException $e, Request $request) {
            return (new ExternalServiceUnavailableException($e))->render($request);
        });

        // Runs after an exception's own render() method, so the hand-written
        // contracts (503 external_service_unavailable, 402, 422) are
        // untouched. This only replaces Laravel's default, which would
        // otherwise flatten everything to {"message": "Server Error"} in a
        // production build. Validation keeps Laravel's {message, errors}.
        $exceptions->render(function (Throwable $e, Request $request) {
            if ($e instanceof ValidationException) {
                return null;
            }

            return app(JsonExceptionRenderer::class)($e, $request);
        });
    })->create();

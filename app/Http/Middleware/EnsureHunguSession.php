<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use App\Services\HunguSessionResolver;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use Symfony\Component\HttpFoundation\Response;

final class EnsureHunguSession
{
    public const REQUEST_ATTRIBUTE = 'hungu.session';

    public function __construct(
        private readonly HunguSessionResolver $resolver,
    ) {}

    /**
     * Handle an incoming request.
     *
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $resolution = $this->resolver->resolve();

        if (! $resolution->isAuthenticated()) {
            return $this->unauthenticatedResponse($request, $resolution->attemptedAccountId);
        }

        if ($this->shouldDeferBootValidation($request)) {
            return $this->bootValidationResponse($request);
        }

        $this->resolver->primeProfile($resolution->session);

        $request->attributes->set(self::REQUEST_ATTRIBUTE, $resolution->session);

        $response = $next($request);

        $this->queueAppBootCookie();

        return $response;
    }

    private function shouldDeferBootValidation(Request $request): bool
    {
        if (! (bool) config('hungu.check_session_on_boot', true)) {
            return false;
        }

        if ($request->cookies->has($this->appBootCookieName())) {
            return false;
        }

        return true;
    }

    private function bootValidationResponse(Request $request): Response
    {
        if ($request->expectsJson()) {
            return response([
                'code' => 'boot_validation_required',
                'message' => '請先完成啟動驗證。',
            ], 409);
        }

        return redirect('/courses');
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

    private function unauthenticatedResponse(Request $request, ?int $failedAccountId): Response
    {
        if ($request->expectsJson()) {
            return response([
                'message' => '請先登入課程平台。',
                'code' => 'session_invalid',
                'accountId' => $failedAccountId,
            ], 401);
        }

        if (! Route::is('login')) {
            return redirect()
                ->route('login')
                ->with('error', '登入資訊已失效，請重新登入。');
        }

        return response()->noContent(401);
    }
}

<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use App\Services\UUProfileSession;
use App\Services\UUSessionAuthenticator;
use App\Services\UUSessionStore;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Route;
use Symfony\Component\HttpFoundation\Response;

final class EnsureHunguSession
{
    public const REQUEST_ATTRIBUTE = 'hungu.session';

    public function __construct(
        private readonly UUSessionStore $sessionStore,
        private readonly UUSessionAuthenticator $authenticator,
        private readonly UUProfileSession $profileSession,
    ) {}

    /**
     * Handle an incoming request.
     *
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $session = $this->sessionStore->get();

        if (! is_array($session) && $this->authenticator->attemptRememberedLogin($request)) {
            $session = $this->sessionStore->get();
        }

        if (! is_array($session)) {
            $this->profileSession->forget($request);

            return $this->unauthenticatedResponse($request);
        }

        if ($this->shouldDeferBootValidation($request)) {
            return $this->bootValidationResponse($request);
        }

        $profile = Arr::get($session, 'profile');
        if (is_array($profile)) {
            $this->profileSession->put($request, $profile);
        }

        $request->attributes->set(self::REQUEST_ATTRIBUTE, $session);

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
                'redirect' => route('auth.booting'),
            ], 409);
        }

        return redirect()->route('auth.booting');
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

    private function unauthenticatedResponse(Request $request): Response
    {
        if ($request->expectsJson()) {
            return response([
                'message' => '請先登入課程平台。',
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

<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use App\Services\HunguSessionResolver;
use Closure;
use Illuminate\Http\Request;
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
            return $this->unauthenticatedResponse($resolution->attemptedAccountId);
        }

        $this->resolver->primeProfile($resolution->session);

        $request->attributes->set(self::REQUEST_ATTRIBUTE, $resolution->session);

        return $next($request);
    }

    private function unauthenticatedResponse(?int $failedAccountId): Response
    {
        return response([
            'message' => '請先登入課程平台。',
            'code' => 'session_invalid',
            'accountId' => $failedAccountId,
        ], 401);
    }
}

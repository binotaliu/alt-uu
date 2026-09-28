<?php

declare(strict_types=1);

namespace App\Services\Diagnostics;

use Illuminate\Contracts\Config\Repository as ConfigRepository;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Throwable;

/**
 * Renders a JSON error that is actually diagnosable.
 *
 * Laravel's default handler calls convertExceptionToArray(), which throws
 * away everything when app.debug is false:
 *
 *     'message' => $this->isHttpException($e) ? $e->getMessage() : 'Server Error'
 *
 * Production builds ship with APP_DEBUG=false, so a DomCrawler failure inside
 * ParseMaterialContent reaches the user as the literal string "Server Error"
 * — the exact case we most need to tell apart from an upstream outage. This
 * renderer is gated on diagnostics.expose_exceptions rather than app.debug so
 * the detail survives into a shipped build. Alt UU is open source, so a PHP
 * stack trace costs us nothing and makes a bug report far more useful.
 *
 * The user still sees a friendly message: the technical detail goes in a
 * separate `exception` block that the frontend only shows when the detail
 * panel is expanded.
 */
final readonly class JsonExceptionRenderer
{
    /** A trace long enough to diagnose, short enough to store and paste. */
    private const MAX_TRACE_FRAMES = 30;

    public function __construct(
        private DiagnosticRedactor $redactor,
        private ConfigRepository $config,
    ) {}

    public function __invoke(Throwable $e, Request $request): ?JsonResponse
    {
        if (! $request->expectsJson() && ! $request->is('api/*')) {
            return null;
        }

        $isHttpException = $e instanceof HttpExceptionInterface;
        $status = $isHttpException ? $e->getStatusCode() : 500;

        $payload = [
            'message' => $this->userFacingMessage($e, $isHttpException),
            'code' => $isHttpException ? 'http_error' : 'server_error',
            'requestId' => $this->requestId(),
        ];

        if ($this->shouldExposeDetail()) {
            $payload['exception'] = $this->describe($e);
        }

        return new JsonResponse($payload, $status);
    }

    /**
     * An HTTP exception's message was written for the user — `abort(403,
     * '不允許存取外部資源')` — so keep it. Anything else is a PHP message that
     * would only confuse, so substitute friendly copy and leave the original
     * in the exception block.
     */
    private function userFacingMessage(Throwable $e, bool $isHttpException): string
    {
        if ($isHttpException && trim($e->getMessage()) !== '') {
            return $e->getMessage();
        }

        return 'App 發生未預期的錯誤，請稍後再試。';
    }

    /**
     * @return array{class: string, message: string, file: string, line: int, trace: list<string>}
     */
    private function describe(Throwable $e): array
    {
        return [
            'class' => $e::class,
            'message' => $this->redactor->redactText($e->getMessage()),
            'file' => $this->relativePath($e->getFile()),
            'line' => $e->getLine(),
            'trace' => $this->trace($e),
        ];
    }

    /**
     * @return list<string>
     */
    private function trace(Throwable $e): array
    {
        $frames = [];

        foreach (array_slice($e->getTrace(), 0, self::MAX_TRACE_FRAMES) as $frame) {
            $location = isset($frame['file'])
                ? $this->relativePath((string) $frame['file']).':'.($frame['line'] ?? 0)
                : '[internal]';

            $call = ($frame['class'] ?? '').($frame['type'] ?? '').($frame['function'] ?? '');

            // Arguments are deliberately dropped: they routinely hold
            // passwords and session tickets.
            $frames[] = $this->redactor->redactText($location.' '.$call);
        }

        return $frames;
    }

    private function relativePath(string $path): string
    {
        $base = base_path().DIRECTORY_SEPARATOR;

        return str_starts_with($path, $base) ? substr($path, strlen($base)) : $path;
    }

    private function shouldExposeDetail(): bool
    {
        return (bool) $this->config->get('diagnostics.expose_exceptions', true);
    }

    private function requestId(): ?string
    {
        return DiagnosticContext::requestId();
    }
}

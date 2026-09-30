<?php

declare(strict_types=1);

namespace App\NativeComponents\Courses\Support;

use App\Exceptions\ExternalServiceUnavailableException;
use App\Services\Diagnostics\DiagnosticRedactor;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Throwable;

/**
 * Turns a failed Action call into the message and detail array that
 * `<native:error-retry>` shows, mirroring what JsonExceptionRenderer sent to
 * the SPA (friendly text up front, technical detail behind the toggle).
 */
final class LoadFailure
{
    public const string GENERIC_MESSAGE = 'App 發生未預期的錯誤，請稍後再試。';

    /**
     * @return array{message: string, detail: array<string, mixed>}
     */
    public static function describe(Throwable $exception): array
    {
        $detail = [];

        if (config('diagnostics.expose_exceptions', true)) {
            $redactor = app(DiagnosticRedactor::class);

            $detail['exception'] = [
                'class' => $exception::class,
                'message' => $redactor->redactText($exception->getMessage()),
                'file' => str_replace(base_path().DIRECTORY_SEPARATOR, '', $exception->getFile()),
                'line' => $exception->getLine(),
            ];
        }

        return ['message' => self::messageFor($exception), 'detail' => $detail];
    }

    private static function messageFor(Throwable $exception): string
    {
        $isUserFacing = $exception instanceof ExternalServiceUnavailableException
            || ($exception instanceof HttpExceptionInterface && trim($exception->getMessage()) !== '');

        return $isUserFacing ? $exception->getMessage() : self::GENERIC_MESSAGE;
    }
}

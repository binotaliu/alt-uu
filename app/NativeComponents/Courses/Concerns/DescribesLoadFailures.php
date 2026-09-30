<?php

declare(strict_types=1);

namespace App\NativeComponents\Courses\Concerns;

use App\Exceptions\ExternalServiceUnavailableException;
use Illuminate\Http\Client\ConnectionException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Throwable;

/**
 * Turns an exception thrown by an Action into the message and the detail
 * array `<native:error-retry>` expects (the native counterpart of the SPA's
 * `ApiError` friendly message plus its expandable detail).
 */
trait DescribesLoadFailures
{
    protected function failureMessage(Throwable $exception, string $fallback): string
    {
        if ($exception instanceof ExternalServiceUnavailableException) {
            return $exception->getMessage();
        }

        if ($exception instanceof ConnectionException) {
            return (new ExternalServiceUnavailableException($exception))->getMessage();
        }

        if ($exception instanceof HttpExceptionInterface && trim($exception->getMessage()) !== '') {
            return $exception->getMessage();
        }

        return $fallback;
    }

    /**
     * @return array<string, mixed>
     */
    protected function failureDetail(Throwable $exception, string $operationLabel): array
    {
        $isNetwork = $exception instanceof ConnectionException
            || $exception instanceof ExternalServiceUnavailableException;

        $detail = [
            'stageLabel' => $isNetwork ? '無法連線到學校系統' : 'App 發生未預期的錯誤',
            'operationLabel' => $operationLabel,
        ];

        if ($exception instanceof HttpExceptionInterface) {
            $detail['status'] = $exception->getStatusCode();
        }

        if (config('diagnostics.expose_exceptions')) {
            $detail['exception'] = [
                'class' => $exception::class,
                'message' => $exception->getMessage(),
                'file' => $exception->getFile(),
                'line' => $exception->getLine(),
            ];
        }

        return $detail;
    }
}

<?php

declare(strict_types=1);

namespace App\Services\Diagnostics;

use Illuminate\Support\Facades\Context;

/**
 * The correlation identifiers published for the duration of a request.
 *
 * Held here rather than on the middleware so the exception renderer and the
 * recorder can read them without the HTTP layer leaking into the service
 * layer.
 */
final class DiagnosticContext
{
    public const REQUEST_ID = 'altuu.requestId';

    public const OPERATION = 'altuu.op';

    public static function putRequestId(string $requestId): void
    {
        Context::add(self::REQUEST_ID, $requestId);
    }

    public static function putOperation(string $operation): void
    {
        Context::add(self::OPERATION, $operation);
    }

    public static function requestId(): ?string
    {
        return self::string(self::REQUEST_ID);
    }

    public static function operation(): ?string
    {
        return self::string(self::OPERATION);
    }

    private static function string(string $key): ?string
    {
        $value = Context::get($key);

        return is_string($value) && $value !== '' ? $value : null;
    }
}

<?php

declare(strict_types=1);

namespace AltUU\Domains\Auth\Support;

/**
 * Maps the upstream login failure message to the Chinese text shown to users.
 */
final class LoginFailureMessage
{
    public static function localize(?string $sourceMessage): string
    {
        $message = (string) $sourceMessage;

        if (str_starts_with($message, 'Auth fail')) {
            return '登入失敗，請確認帳號密碼。';
        }

        if (preg_match('/\p{Han}/u', $message) === 1) {
            return $message;
        }

        return '登入失敗，請稍後再試。';
    }
}

<?php

declare(strict_types=1);

namespace AltUU\Domains\Course\Support;

final class MaterialProxyUrl
{
    public static function encode(string $url): string
    {
        $encoded = base64_encode($url);
        $encoded = rtrim(strtr($encoded, '+/', '-_'), '=');

        return $encoded;
    }

    public static function decode(string $encoded): ?string
    {
        $decoded = strtr($encoded, '-_', '+/');
        $mod = strlen($decoded) % 4;

        if ($mod !== 0) {
            $decoded .= str_repeat('=', 4 - $mod);
        }

        $url = base64_decode($decoded, true);

        return is_string($url) ? $url : null;
    }
}

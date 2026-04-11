<?php

declare(strict_types=1);

namespace App\Services;

class UUCrypto
{
    private const APP_AES_STRING_B64 = 'd2lzZG9tbWFzdGVycHJvZmVzc2lvbmFsYXBw';

    private const APP_AES_IV_B64 = 'U3VuQXBwRW5OZVBwYU51cw==';

    private static function getAppAesString(): string
    {
        return base64_decode(self::APP_AES_STRING_B64, true) ?: '';
    }

    private static function getAppAesIv(): string
    {
        return base64_decode(self::APP_AES_IV_B64, true) ?: '';
    }

    public function encryptImmediately(string $input): string
    {
        $code = random_int(8, strlen(self::getAppAesString()));
        $encrypted = $this->encryptRaw($input, $code);
        $merged = $encrypted.'@!!@'.$code;

        return $this->encryptRaw($merged, strlen(self::getAppAesString()));
    }

    private function encryptRaw(string $input, int $code): string
    {
        $plain = trim($input);
        if ($plain === '') {
            return $input;
        }

        $key = $this->makeAesKey($code);
        $base64 = base64_encode($input);
        $padded = $this->zeroPad($base64);
        $cipher = openssl_encrypt(
            $padded,
            'aes-256-cbc',
            $key,
            OPENSSL_RAW_DATA | OPENSSL_ZERO_PADDING,
            self::getAppAesIv(),
        );

        return base64_encode($cipher ?: '');
    }

    private function makeAesKey(int $code): string
    {
        $a = md5(substr(self::getAppAesString(), 0, $code));

        return md5(substr($a, 0, 4).substr($a, -4));
    }

    private function zeroPad(string $input): string
    {
        $remainder = strlen($input) % 16;
        if ($remainder === 0) {
            return $input;
        }

        return $input.str_repeat("\0", 16 - $remainder);
    }
}

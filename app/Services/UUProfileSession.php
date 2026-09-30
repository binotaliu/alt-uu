<?php

declare(strict_types=1);

namespace App\Services;

use Illuminate\Contracts\Session\Session;
use Illuminate\Support\Arr;

class UUProfileSession
{
    private const SESSION_KEY = 'hungu.profile';

    public function __construct(private readonly Session $session) {}

    /**
     * @return array<string, string>|null
     */
    public function normalize(mixed $profile, ?string $fallbackUsername = null): ?array
    {
        if (! is_array($profile)) {
            return null;
        }

        $username = trim((string) Arr::get($profile, 'username', $fallbackUsername ?? ''));
        $realName = trim((string) Arr::get($profile, 'realname', Arr::get($profile, 'name', '')));
        $displayName = $realName !== '' ? $realName : $username;
        $picture = trim((string) Arr::get($profile, 'picture', ''));

        if ($displayName === '' && $username === '') {
            return null;
        }

        return [
            'display_name' => $displayName,
            'username' => $username,
            'picture' => $picture,
            'realname' => $realName,
        ];
    }

    /**
     * @param  array<string, string>  $profile
     */
    public function put(array $profile): void
    {
        $this->session->put(self::SESSION_KEY, $profile);
    }

    public function forget(): void
    {
        $this->session->forget(self::SESSION_KEY);
    }
}

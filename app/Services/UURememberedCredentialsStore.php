<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\KeyValueStore;
use Illuminate\Support\Facades\Crypt;

class UURememberedCredentialsStore
{
    /**
     * @return array{username: string, password: string}|null
     */
    public function get(): ?array
    {
        $record = KeyValueStore::query()->find($this->storageKey());
        if (! $record instanceof KeyValueStore) {
            return null;
        }

        try {
            $decrypted = Crypt::decryptString($record->value);
            $decoded = json_decode($decrypted, true, flags: JSON_THROW_ON_ERROR);
        } catch (\Exception) {
            return null;
        }

        if (! is_array($decoded)) {
            return null;
        }

        $username = trim((string) ($decoded['username'] ?? ''));
        $password = (string) ($decoded['password'] ?? '');

        if ($username === '' || $password === '') {
            return null;
        }

        return [
            'username' => $username,
            'password' => $password,
        ];
    }

    public function put(string $username, string $password): void
    {
        $payload = json_encode([
            'username' => trim($username),
            'password' => $password,
        ], JSON_THROW_ON_ERROR);

        KeyValueStore::query()->updateOrCreate(
            ['key' => $this->storageKey()],
            ['value' => Crypt::encryptString($payload)],
        );
    }

    public function forget(): void
    {
        KeyValueStore::query()->where('key', $this->storageKey())->delete();
    }

    public function has(): bool
    {
        return $this->get() !== null;
    }

    public function storageKey(): string
    {
        return (string) config('hungu.remember_credentials_key', 'hungu_remembered_credentials');
    }
}

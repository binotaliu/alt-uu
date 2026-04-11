<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\KeyValueStore;
use Illuminate\Support\Facades\Crypt;

class UUSessionStore
{
    /**
     * @return array<string, mixed>|null
     */
    public function get(): ?array
    {
        $record = KeyValueStore::query()->find($this->storageKey());
        if (! $record instanceof KeyValueStore) {
            return null;
        }

        try {
            $decrypted = Crypt::decryptString($record->value);
            $decoded = json_decode($decrypted, true);

            return is_array($decoded) ? $decoded : null;
        } catch (\Exception) {
            return null;
        }
    }

    /**
     * @param  array<string, mixed>  $session
     */
    public function put(array $session): void
    {
        $json = json_encode($session, JSON_THROW_ON_ERROR);

        KeyValueStore::query()->updateOrCreate(
            ['key' => $this->storageKey()],
            ['value' => Crypt::encryptString($json)],
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
        return (string) config('hungu.cookie_name', 'hungu_session');
    }
}

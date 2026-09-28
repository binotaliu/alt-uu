<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\KeyValueStore;

final class AccountActiveProfile
{
    public function get(): ?int
    {
        $record = KeyValueStore::query()->find($this->storageKey());
        if (! $record instanceof KeyValueStore) {
            return null;
        }

        return $record->value !== '' ? (int) $record->value : null;
    }

    public function set(int $accountId): void
    {
        KeyValueStore::query()->updateOrCreate(
            ['key' => $this->storageKey()],
            ['value' => (string) $accountId],
        );
    }

    public function clear(): void
    {
        KeyValueStore::query()->where('key', $this->storageKey())->delete();
    }

    private function storageKey(): string
    {
        return (string) config('account.active_profile_key', 'account.active_profile');
    }
}

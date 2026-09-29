<?php

declare(strict_types=1);

namespace AltUU\Domains\AppStatus;

use App\Models\KeyValueStore;
use Illuminate\Support\Arr;
use JsonException;

/**
 * Remembers which update banners and announcements the user has closed.
 *
 * Keys look like "update:1.2.0" or "announcement:<id>", so a dismissed
 * update stays hidden only until the next release.
 */
final readonly class DismissedAppStatusStore
{
    private const KEY = 'app-status:dismissed';

    private const MAX_REMEMBERED = 50;

    /**
     * @return array<int, string>
     */
    public function all(): array
    {
        $record = KeyValueStore::query()->find(self::KEY);

        if (! $record) {
            return [];
        }

        try {
            $decoded = json_decode($record->value, true, 512, JSON_THROW_ON_ERROR);
        } catch (JsonException) {
            return [];
        }

        $keys = Arr::get($decoded, 'keys');

        if (! is_array($keys)) {
            return [];
        }

        return array_values(array_filter($keys, is_string(...)));
    }

    public function dismiss(string $key): void
    {
        $keys = array_values(array_unique([...$this->all(), $key]));
        $keys = array_slice($keys, -self::MAX_REMEMBERED);

        KeyValueStore::query()->updateOrCreate(
            ['key' => self::KEY],
            ['value' => json_encode(['keys' => $keys], JSON_THROW_ON_ERROR)],
        );
    }
}

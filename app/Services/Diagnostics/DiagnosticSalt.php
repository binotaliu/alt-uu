<?php

declare(strict_types=1);

namespace App\Services\Diagnostics;

use App\Models\KeyValueStore;
use Illuminate\Support\Str;
use Throwable;

/**
 * Supplies the per-install salt used to pseudonymize identifiers in the
 * diagnostic log.
 *
 * Generated once and persisted, so a handle stays stable for the lifetime of
 * the install. Because it never leaves the device, two users' exported
 * bundles cannot be cross-referenced against each other.
 */
final class DiagnosticSalt
{
    public const STORAGE_KEY = 'diagnostics.salt';

    private ?string $cached = null;

    public function value(): string
    {
        if ($this->cached !== null) {
            return $this->cached;
        }

        try {
            $record = KeyValueStore::query()->find(self::STORAGE_KEY);

            if ($record !== null && is_string($record->value) && $record->value !== '') {
                return $this->cached = $record->value;
            }

            $salt = Str::random(40);

            KeyValueStore::query()->updateOrCreate(
                ['key' => self::STORAGE_KEY],
                ['value' => $salt],
            );

            return $this->cached = $salt;
        } catch (Throwable) {
            // No database yet (early boot, mid-migration). Fall back to a
            // process-lifetime salt: handles stay consistent within this run,
            // which is enough to keep a single report readable.
            return $this->cached = Str::random(40);
        }
    }
}

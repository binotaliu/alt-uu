<?php

declare(strict_types=1);

namespace AltUU\Domains\MaterialPreference;

use App\Models\KeyValueStore;
use Illuminate\Support\Arr;
use JsonException;

final readonly class MaterialPreferenceStore
{
    private const STORAGE_KEY = 'preference:material-html-scale';

    private const DEFAULT_SCALE = 1.0;

    private const MIN_SCALE = 0.7;

    private const MAX_SCALE = 1.6;

    public function getScale(): float
    {
        $record = KeyValueStore::query()->find(self::STORAGE_KEY);

        if (! $record) {
            return self::DEFAULT_SCALE;
        }

        try {
            $decoded = json_decode($record->value, true, 512, JSON_THROW_ON_ERROR);
        } catch (JsonException) {
            return self::DEFAULT_SCALE;
        }

        $scale = Arr::get($decoded, 'scale');

        if (! is_numeric($scale)) {
            return self::DEFAULT_SCALE;
        }

        return $this->clamp((float) $scale);
    }

    public function setScale(float $scale): float
    {
        $clamped = $this->clamp($scale);

        KeyValueStore::query()->updateOrCreate(
            ['key' => self::STORAGE_KEY],
            ['value' => json_encode(['scale' => $clamped], JSON_THROW_ON_ERROR)],
        );

        return $clamped;
    }

    private function clamp(float $value): float
    {
        return min(self::MAX_SCALE, max(self::MIN_SCALE, $value));
    }
}

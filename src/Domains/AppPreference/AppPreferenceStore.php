<?php

declare(strict_types=1);

namespace AltUU\Domains\AppPreference;

use App\Models\KeyValueStore;
use Illuminate\Support\Arr;
use JsonException;

final readonly class AppPreferenceStore
{
    private const APPEARANCE_KEY = 'preference:appearance';

    private const NOU_TOOLS_INTEGRATION_KEY = 'preference:nou-tools-integration';

    private const SCREEN_READER_ENHANCED_SUPPORT_KEY = 'preference:screen-reader-enhanced-support';

    private const ONBOARDING_COMPLETED_KEY = 'preference:onboarding-completed';

    private const LIVE_SESSIONS_TIMEZONE_KEY = 'preference:live-sessions-timezone';

    private const DEFAULT_APPEARANCE = 'system';

    private const DEFAULT_LIVE_SESSIONS_TIMEZONE = 'taiwan';

    /** @var string[] */
    private const ALLOWED_APPEARANCES = ['system', 'light', 'dark'];

    /** @var string[] */
    private const ALLOWED_LIVE_SESSIONS_TIMEZONES = ['taiwan', 'local'];

    private const DEFAULT_NOU_TOOLS_INTEGRATION_ENABLED = false;

    private const DEFAULT_SCREEN_READER_ENHANCED_SUPPORT_ENABLED = false;

    private const DEFAULT_ONBOARDING_COMPLETED = false;

    public function getAppearance(): string
    {
        $record = KeyValueStore::query()->find(self::APPEARANCE_KEY);

        if (! $record) {
            return self::DEFAULT_APPEARANCE;
        }

        try {
            $decoded = json_decode($record->value, true, 512, JSON_THROW_ON_ERROR);
        } catch (JsonException) {
            return self::DEFAULT_APPEARANCE;
        }

        $appearance = Arr::get($decoded, 'appearance');

        if (! is_string($appearance) || ! in_array($appearance, self::ALLOWED_APPEARANCES, true)) {
            return self::DEFAULT_APPEARANCE;
        }

        return $appearance;
    }

    public function setAppearance(string $appearance): string
    {
        if (! in_array($appearance, self::ALLOWED_APPEARANCES, true)) {
            $appearance = self::DEFAULT_APPEARANCE;
        }

        KeyValueStore::query()->updateOrCreate(
            ['key' => self::APPEARANCE_KEY],
            ['value' => json_encode(['appearance' => $appearance], JSON_THROW_ON_ERROR)],
        );

        return $appearance;
    }

    public function getNouToolsIntegrationEnabled(): bool
    {
        $record = KeyValueStore::query()->find(self::NOU_TOOLS_INTEGRATION_KEY);

        if (! $record) {
            return self::DEFAULT_NOU_TOOLS_INTEGRATION_ENABLED;
        }

        try {
            $decoded = json_decode($record->value, true, 512, JSON_THROW_ON_ERROR);
        } catch (JsonException) {
            return self::DEFAULT_NOU_TOOLS_INTEGRATION_ENABLED;
        }

        $enabled = Arr::get($decoded, 'enabled');

        return is_bool($enabled) ? $enabled : self::DEFAULT_NOU_TOOLS_INTEGRATION_ENABLED;
    }

    public function setNouToolsIntegrationEnabled(bool $enabled): bool
    {
        KeyValueStore::query()->updateOrCreate(
            ['key' => self::NOU_TOOLS_INTEGRATION_KEY],
            ['value' => json_encode(['enabled' => $enabled], JSON_THROW_ON_ERROR)],
        );

        return $enabled;
    }

    public function getScreenReaderEnhancedSupportEnabled(): bool
    {
        $record = KeyValueStore::query()->find(self::SCREEN_READER_ENHANCED_SUPPORT_KEY);

        if (! $record) {
            return self::DEFAULT_SCREEN_READER_ENHANCED_SUPPORT_ENABLED;
        }

        try {
            $decoded = json_decode($record->value, true, 512, JSON_THROW_ON_ERROR);
        } catch (JsonException) {
            return self::DEFAULT_SCREEN_READER_ENHANCED_SUPPORT_ENABLED;
        }

        $enabled = Arr::get($decoded, 'enabled');

        return is_bool($enabled) ? $enabled : self::DEFAULT_SCREEN_READER_ENHANCED_SUPPORT_ENABLED;
    }

    public function setScreenReaderEnhancedSupportEnabled(bool $enabled): bool
    {
        KeyValueStore::query()->updateOrCreate(
            ['key' => self::SCREEN_READER_ENHANCED_SUPPORT_KEY],
            ['value' => json_encode(['enabled' => $enabled], JSON_THROW_ON_ERROR)],
        );

        return $enabled;
    }

    public function getOnboardingCompleted(): bool
    {
        $record = KeyValueStore::query()->find(self::ONBOARDING_COMPLETED_KEY);

        if (! $record) {
            return self::DEFAULT_ONBOARDING_COMPLETED;
        }

        try {
            $decoded = json_decode($record->value, true, 512, JSON_THROW_ON_ERROR);
        } catch (JsonException) {
            return self::DEFAULT_ONBOARDING_COMPLETED;
        }

        $completed = Arr::get($decoded, 'completed');

        return is_bool($completed) ? $completed : self::DEFAULT_ONBOARDING_COMPLETED;
    }

    public function setOnboardingCompleted(bool $completed): bool
    {
        KeyValueStore::query()->updateOrCreate(
            ['key' => self::ONBOARDING_COMPLETED_KEY],
            ['value' => json_encode(['completed' => $completed], JSON_THROW_ON_ERROR)],
        );

        return $completed;
    }

    public function getLiveSessionsTimezone(): string
    {
        $record = KeyValueStore::query()->find(self::LIVE_SESSIONS_TIMEZONE_KEY);

        if (! $record) {
            return self::DEFAULT_LIVE_SESSIONS_TIMEZONE;
        }

        try {
            $decoded = json_decode($record->value, true, 512, JSON_THROW_ON_ERROR);
        } catch (JsonException) {
            return self::DEFAULT_LIVE_SESSIONS_TIMEZONE;
        }

        $timezone = Arr::get($decoded, 'timezone');

        if (! is_string($timezone) || ! in_array($timezone, self::ALLOWED_LIVE_SESSIONS_TIMEZONES, true)) {
            return self::DEFAULT_LIVE_SESSIONS_TIMEZONE;
        }

        return $timezone;
    }

    public function setLiveSessionsTimezone(string $timezone): string
    {
        if (! in_array($timezone, self::ALLOWED_LIVE_SESSIONS_TIMEZONES, true)) {
            $timezone = self::DEFAULT_LIVE_SESSIONS_TIMEZONE;
        }

        KeyValueStore::query()->updateOrCreate(
            ['key' => self::LIVE_SESSIONS_TIMEZONE_KEY],
            ['value' => json_encode(['timezone' => $timezone], JSON_THROW_ON_ERROR)],
        );

        return $timezone;
    }
}

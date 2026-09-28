<?php

declare(strict_types=1);

namespace AltUU\Domains\AppPreference;

use App\Models\KeyValueStore;
use DateTimeInterface;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Date;
use JsonException;
use Throwable;

final readonly class AppPreferenceStore
{
    private const APPEARANCE_KEY = 'preference:appearance';

    private const ACCENT_COLOR_KEY = 'preference:accent-color';

    private const NOU_TOOLS_INTEGRATION_KEY = 'preference:nou-tools-integration';

    private const SCREEN_READER_ENHANCED_SUPPORT_KEY = 'preference:screen-reader-enhanced-support';

    private const ALT_UU_PLUS_DISABLED_KEY = 'preference:alt-uu-plus-disabled';

    private const ONBOARDING_COMPLETED_KEY = 'preference:onboarding-completed';

    private const LIVE_SESSIONS_TIMEZONE_KEY = 'preference:live-sessions-timezone';

    private const LIVE_SESSION_NICKNAME_MODAL_ENABLED_KEY = 'preference:live-session-nickname-modal-enabled';

    private const CELLULAR_PLAYBACK_WARNING_ENABLED_KEY = 'preference:cellular-playback-warning-enabled';

    private const WHATS_NEW_SEEN_VERSION_KEY = 'preference:whats-new-seen-version';

    private const DIAGNOSTICS_RECORDING_UNTIL_KEY = 'preference:diagnostics-recording-until';

    private const DEFAULT_APPEARANCE = 'system';

    public const DEFAULT_ACCENT_COLOR = 'warm';

    private const DEFAULT_LIVE_SESSIONS_TIMEZONE = 'taiwan';

    /** @var string[] */
    private const ALLOWED_APPEARANCES = ['system', 'light', 'dark'];

    /** @var string[] */
    public const ALLOWED_ACCENT_COLORS = ['warm', 'ocean', 'forest', 'purple', 'pink', 'red', 'grey'];

    /** @var string[] */
    private const ALLOWED_LIVE_SESSIONS_TIMEZONES = ['taiwan', 'local'];

    private const DEFAULT_NOU_TOOLS_INTEGRATION_ENABLED = false;

    private const DEFAULT_SCREEN_READER_ENHANCED_SUPPORT_ENABLED = false;

    private const DEFAULT_ALT_UU_PLUS_DISABLED = false;

    private const DEFAULT_ONBOARDING_COMPLETED = false;

    private const DEFAULT_LIVE_SESSION_NICKNAME_MODAL_ENABLED = true;

    private const DEFAULT_CELLULAR_PLAYBACK_WARNING_ENABLED = true;

    /**
     * When diagnostic recording should stop, or null if it is not running.
     *
     * Stored as an expiry rather than a boolean so the window enforces
     * itself against the clock. Nothing needs to be scheduled to turn it
     * back off, which matters because no scheduler runs on a device.
     */
    public function getDiagnosticsRecordingUntil(): ?DateTimeInterface
    {
        $record = KeyValueStore::query()->find(self::DIAGNOSTICS_RECORDING_UNTIL_KEY);

        if (! $record) {
            return null;
        }

        try {
            $decoded = json_decode($record->value, true, 512, JSON_THROW_ON_ERROR);
        } catch (JsonException) {
            return null;
        }

        $until = Arr::get($decoded, 'until');

        if (! is_string($until) || $until === '') {
            return null;
        }

        try {
            return Date::parse($until);
        } catch (Throwable) {
            return null;
        }
    }

    public function setDiagnosticsRecordingUntil(?DateTimeInterface $until): ?DateTimeInterface
    {
        KeyValueStore::query()->updateOrCreate(
            ['key' => self::DIAGNOSTICS_RECORDING_UNTIL_KEY],
            ['value' => json_encode(
                ['until' => $until?->format(DateTimeInterface::ATOM)],
                JSON_THROW_ON_ERROR,
            )],
        );

        return $until;
    }

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

    public function getAccentColor(): string
    {
        $record = KeyValueStore::query()->find(self::ACCENT_COLOR_KEY);

        if (! $record) {
            return self::DEFAULT_ACCENT_COLOR;
        }

        try {
            $decoded = json_decode($record->value, true, 512, JSON_THROW_ON_ERROR);
        } catch (JsonException) {
            return self::DEFAULT_ACCENT_COLOR;
        }

        $accentColor = Arr::get($decoded, 'accentColor');

        if (! is_string($accentColor) || ! in_array($accentColor, self::ALLOWED_ACCENT_COLORS, true)) {
            return self::DEFAULT_ACCENT_COLOR;
        }

        return $accentColor;
    }

    public function setAccentColor(string $accentColor): string
    {
        if (! in_array($accentColor, self::ALLOWED_ACCENT_COLORS, true)) {
            $accentColor = self::DEFAULT_ACCENT_COLOR;
        }

        KeyValueStore::query()->updateOrCreate(
            ['key' => self::ACCENT_COLOR_KEY],
            ['value' => json_encode(['accentColor' => $accentColor], JSON_THROW_ON_ERROR)],
        );

        return $accentColor;
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

    public function getAltUuPlusDisabled(): bool
    {
        $record = KeyValueStore::query()->find(self::ALT_UU_PLUS_DISABLED_KEY);

        if (! $record) {
            return self::DEFAULT_ALT_UU_PLUS_DISABLED;
        }

        try {
            $decoded = json_decode($record->value, true, 512, JSON_THROW_ON_ERROR);
        } catch (JsonException) {
            return self::DEFAULT_ALT_UU_PLUS_DISABLED;
        }

        $disabled = Arr::get($decoded, 'disabled');

        return is_bool($disabled) ? $disabled : self::DEFAULT_ALT_UU_PLUS_DISABLED;
    }

    public function setAltUuPlusDisabled(bool $disabled): bool
    {
        KeyValueStore::query()->updateOrCreate(
            ['key' => self::ALT_UU_PLUS_DISABLED_KEY],
            ['value' => json_encode(['disabled' => $disabled], JSON_THROW_ON_ERROR)],
        );

        return $disabled;
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

    public function getLiveSessionNicknameModalEnabled(): bool
    {
        $record = KeyValueStore::query()->find(self::LIVE_SESSION_NICKNAME_MODAL_ENABLED_KEY);

        if (! $record) {
            return self::DEFAULT_LIVE_SESSION_NICKNAME_MODAL_ENABLED;
        }

        try {
            $decoded = json_decode($record->value, true, 512, JSON_THROW_ON_ERROR);
        } catch (JsonException) {
            return self::DEFAULT_LIVE_SESSION_NICKNAME_MODAL_ENABLED;
        }

        $enabled = Arr::get($decoded, 'enabled');

        return is_bool($enabled) ? $enabled : self::DEFAULT_LIVE_SESSION_NICKNAME_MODAL_ENABLED;
    }

    public function setLiveSessionNicknameModalEnabled(bool $enabled): bool
    {
        KeyValueStore::query()->updateOrCreate(
            ['key' => self::LIVE_SESSION_NICKNAME_MODAL_ENABLED_KEY],
            ['value' => json_encode(['enabled' => $enabled], JSON_THROW_ON_ERROR)],
        );

        return $enabled;
    }

    public function getCellularPlaybackWarningEnabled(): bool
    {
        $record = KeyValueStore::query()->find(self::CELLULAR_PLAYBACK_WARNING_ENABLED_KEY);

        if (! $record) {
            return self::DEFAULT_CELLULAR_PLAYBACK_WARNING_ENABLED;
        }

        try {
            $decoded = json_decode($record->value, true, 512, JSON_THROW_ON_ERROR);
        } catch (JsonException) {
            return self::DEFAULT_CELLULAR_PLAYBACK_WARNING_ENABLED;
        }

        $enabled = Arr::get($decoded, 'enabled');

        return is_bool($enabled) ? $enabled : self::DEFAULT_CELLULAR_PLAYBACK_WARNING_ENABLED;
    }

    public function setCellularPlaybackWarningEnabled(bool $enabled): bool
    {
        KeyValueStore::query()->updateOrCreate(
            ['key' => self::CELLULAR_PLAYBACK_WARNING_ENABLED_KEY],
            ['value' => json_encode(['enabled' => $enabled], JSON_THROW_ON_ERROR)],
        );

        return $enabled;
    }

    /**
     * The app version whose release notes the user last saw, or an empty string if none yet.
     */
    public function getWhatsNewSeenVersion(): string
    {
        $record = KeyValueStore::query()->find(self::WHATS_NEW_SEEN_VERSION_KEY);

        if (! $record) {
            return '';
        }

        try {
            $decoded = json_decode($record->value, true, 512, JSON_THROW_ON_ERROR);
        } catch (JsonException) {
            return '';
        }

        $version = Arr::get($decoded, 'version');

        return is_string($version) ? $version : '';
    }

    public function setWhatsNewSeenVersion(string $version): string
    {
        KeyValueStore::query()->updateOrCreate(
            ['key' => self::WHATS_NEW_SEEN_VERSION_KEY],
            ['value' => json_encode(['version' => $version], JSON_THROW_ON_ERROR)],
        );

        return $version;
    }
}

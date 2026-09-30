<?php

declare(strict_types=1);

namespace App\NativeComponents\Courses\Support;

use AltUU\Domains\AppPreference\Actions\GetNouToolsIntegrationEnabled;
use AltUU\Domains\AppPreference\Actions\UpdateAppPreferences;
use AltUU\Domains\AppPreference\DataTransferObjects\UpdateAppPreferencesInputData;
use Throwable;

/**
 * NOU Tools gating for the live sessions and school calendar tabs
 * (CoursesBottomNav.vue `onTabClick` / `enableNouTools`).
 */
final class NouToolsGate
{
    public static function isEnabled(): bool
    {
        return (bool) app(GetNouToolsIntegrationEnabled::class)();
    }

    /**
     * Persist the preference. Returns false when saving failed, so the screen
     * can show 啟用失敗，請稍後重試.
     */
    public static function enable(): bool
    {
        try {
            app(UpdateAppPreferences::class)(UpdateAppPreferencesInputData::from(['nouToolsIntegrationEnabled' => true]));
        } catch (Throwable) {
            return false;
        }

        return true;
    }
}

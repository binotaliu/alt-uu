<?php

declare(strict_types=1);

namespace App\NativeComponents\Shared;

use AltUU\Domains\AppPreference\Actions\GetAppPreferences;
use AltUU\Domains\AppPreference\Actions\UpdateAppPreferences;
use AltUU\Domains\AppPreference\DataTransferObjects\UpdateAppPreferencesInputData;
use App\NativeComponents\Support\ReleaseNotes;
use Illuminate\View\View;
use Native\Mobile\Edge\NativeComponent;
use Native\Mobile\Facades\Browser;
use Throwable;

/**
 * Release highlights sheet shown once per version (WhatsNewSheet.vue).
 *
 * Tag: `<native:whats-new-sheet key="whats-new" :visible="$whatsNewVisible" @close="closeWhatsNew" />`
 * Decide when to show it with `ReleaseNotes::shouldShowNow()` (usually in the
 * first screen's `mount()`).
 *
 * Props: `visible`.
 * Events: `close` (button, swipe-down or tap-outside).
 * When the sheet opens for a version that has release notes, the seen version
 * is persisted (`whatsNewSeenVersion`) so it is not shown again; a failed save
 * only means it shows again next launch. Development builds fall back to the
 * newest release.
 *
 * REQUIRED host action: set `visible` false on `close`.
 */
final class WhatsNewSheet extends NativeComponent
{
    public bool $visible = false;

    private bool $wasVisible = false;

    public function close(): void
    {
        $this->emit('close');
    }

    public function openChangelog(): void
    {
        $release = ReleaseNotes::forVersionOrLatest($this->currentVersion());

        Browser::inApp(ReleaseNotes::changelogUrl($release['version'] ?? null));
    }

    public function render(): View
    {
        if ($this->visible && ! $this->wasVisible) {
            $this->markSeen();
        }

        $this->wasVisible = $this->visible;

        return view('native.shared.whats-new-sheet', [
            'release' => ReleaseNotes::forVersionOrLatest($this->currentVersion()),
        ]);
    }

    private function currentVersion(): string
    {
        return (string) config('nativephp.version');
    }

    private function markSeen(): void
    {
        $version = $this->currentVersion();

        try {
            $seen = app(GetAppPreferences::class)()->whatsNewSeenVersion;

            if (ReleaseNotes::find($version) !== null && $seen !== $version) {
                app(UpdateAppPreferences::class)(UpdateAppPreferencesInputData::from(['whatsNewSeenVersion' => $version]));
            }
        } catch (Throwable) {
            // Only means the sheet shows again next launch.
        }
    }
}

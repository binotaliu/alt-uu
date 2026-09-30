<?php

declare(strict_types=1);

namespace App\NativeComponents\Shared;

use AltUU\Domains\AppStatus\Actions\DismissAppStatusItem;
use AltUU\Domains\AppStatus\Actions\GetAppStatus;
use AltUU\Domains\AppStatus\DataTransferObjects\DismissAppStatusItemInputData;
use AltUU\Domains\AppStatus\ViewModels\AnnouncementViewModel;
use AltUU\Domains\AppStatus\ViewModels\AppUpdateViewModel;
use Illuminate\View\View;
use Native\Mobile\Edge\NativeComponent;
use Native\Mobile\Facades\Browser;
use Throwable;

/**
 * Update notice and announcement banners (AppStatusBanners.vue).
 *
 * Tag: `<native:app-status-banners key="app-status" />` (no props, no events).
 * Loads the status once on mount; a failed load shows nothing. Renders
 * nothing (no node) when there is neither an update nor an announcement, so it
 * is safe to place at the top of any screen. Dismissing removes the banner at
 * once and persists it in the background. A required update has no close
 * button. Store and announcement links open in the system / in-app browser.
 *
 * Severity styling: `info` uses the primary-container tokens (there is no
 * dedicated info token in config/native-ui.php), `warning` and `critical` use
 * the warning and destructive containers.
 */
final class AppStatusBanners extends NativeComponent
{
    public ?AppUpdateViewModel $update = null;

    /** @var array<int, AnnouncementViewModel> */
    public array $announcements = [];

    public function mount(): void
    {
        try {
            $status = app(GetAppStatus::class)();
            $this->update = $status->update;
            $this->announcements = $status->announcements;
        } catch (Throwable) {
            // Purely informational: a failed check must never get in the way.
        }
    }

    public function dismiss(string $dismissKey): void
    {
        if ($this->update?->dismissKey === $dismissKey) {
            $this->update = null;
        }

        $this->announcements = array_values(array_filter(
            $this->announcements,
            fn (AnnouncementViewModel $announcement): bool => $announcement->dismissKey !== $dismissKey,
        ));

        try {
            app(DismissAppStatusItem::class)(new DismissAppStatusItemInputData($dismissKey));
        } catch (Throwable) {
            // Worst case it comes back on the next launch.
        }
    }

    public function openStore(): void
    {
        if ($this->update?->storeUrl !== null) {
            Browser::open($this->update->storeUrl);
        }
    }

    public function openAnnouncement(string $dismissKey): void
    {
        $announcement = collect($this->announcements)
            ->first(fn (AnnouncementViewModel $item): bool => $item->dismissKey === $dismissKey);

        if ($announcement?->url !== null) {
            Browser::inApp($announcement->url);
        }
    }

    public function render(): View
    {
        return view('native.shared.app-status-banners');
    }
}

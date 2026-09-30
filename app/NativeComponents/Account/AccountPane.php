<?php

declare(strict_types=1);

namespace App\NativeComponents\Account;

use AltUU\Domains\Activity\Actions\GetActivityHeatmap;
use AltUU\Domains\Activity\ViewModels\ActivityHeatmapViewModel;
use AltUU\Domains\AppPreference\Actions\GetAltUuPlusDisabled;
use AltUU\Domains\Auth\Actions\GetSessionProfile;
use AltUU\Domains\Auth\ViewModels\SessionProfileViewModel;
use AltUU\Domains\Subscription\Actions\GetCachedEntitlement;
use AltUU\Domains\Subscription\Actions\GetEntitlementStatus;
use App\NativeComponents\Account\Support\SampleActivity;
use App\NativeComponents\Concerns\GuardsHunguSession;
use App\NativeComponents\Concerns\ShowsSessionExpiredPicker;
use Illuminate\Support\Facades\Date;
use Illuminate\View\View;
use Native\Mobile\Edge\NativeComponent;
use Throwable;

/**
 * "我的帳號" tab (AccountPane.vue + AccountActivityWidget.vue +
 * DataImportExportWidget.vue): profile card, links to grades and exam info,
 * the Alt UU+ card, the learning activity heatmap (real data for subscribers,
 * sample data behind an upsell otherwise) and the data import/export link.
 */
final class AccountPane extends NativeComponent
{
    use GuardsHunguSession;
    use ShowsSessionExpiredPicker;

    public ?SessionProfileViewModel $profile = null;

    public bool $altUuPlusDisabled = false;

    public bool $subscribed = false;

    public ?string $expiresAt = null;

    public ?ActivityHeatmapViewModel $activity = null;

    public bool $activityLoading = false;

    public bool $activityFailed = false;

    public bool $showAllAccountsActivity = false;

    public function navTitle(): string
    {
        return '我的帳號';
    }

    public function mount(): void
    {
        if (! $this->ensureHunguSession()) {
            return;
        }

        $this->load();
    }

    public function onResume(): void
    {
        if ($this->handleSessionExpired()) {
            return;
        }

        $this->load();
    }

    public function refresh(): void
    {
        $this->load();
    }

    public function openSettings(): void
    {
        $this->navigate($this->route('native.settings'));
    }

    public function openAccounts(): void
    {
        $this->navigate($this->route('native.courses.account.accounts'));
    }

    public function openGrades(): void
    {
        $this->navigate($this->route('native.courses.account.grades'));
    }

    public function openExamInfo(): void
    {
        $this->navigate($this->route('native.courses.account.exam-info'));
    }

    public function openSubscription(): void
    {
        $this->navigate($this->route('native.courses.account.subscription'));
    }

    public function openDataExport(): void
    {
        $this->navigate($this->route('native.courses.account.data-export'));
    }

    public function setActivityScope(bool $allAccounts): void
    {
        $this->showAllAccountsActivity = $allAccounts;
        $this->loadActivity();
    }

    public function onAccountSwitched(int $accountId): void
    {
        $this->activity = null;
        $this->showAllAccountsActivity = false;
        $this->load();
    }

    private function load(): void
    {
        try {
            $this->profile = app(GetSessionProfile::class)();
            $this->altUuPlusDisabled = (bool) app(GetAltUuPlusDisabled::class)();
        } catch (Throwable) {
            // The card falls back to the generic name.
        }

        $this->loadSubscription();

        if ($this->subscribed) {
            $this->loadActivity();
        } else {
            $this->activity = null;
        }
    }

    private function loadSubscription(): void
    {
        try {
            $entitlement = app(GetEntitlementStatus::class)();
        } catch (Throwable) {
            $entitlement = app(GetCachedEntitlement::class)();
        }

        $this->subscribed = $entitlement->active;
        $this->expiresAt = $entitlement->expiresAt;
    }

    private function loadActivity(): void
    {
        $this->activityLoading = true;
        $this->activityFailed = false;

        try {
            $this->activity = app(GetActivityHeatmap::class)($this->showAllAccountsActivity);
        } catch (Throwable) {
            $this->activity = null;
            $this->activityFailed = true;
        }

        $this->activityLoading = false;
    }

    public function render(): View
    {
        $expiry = $this->expiresAt !== null && $this->expiresAt !== ''
            ? Date::parse($this->expiresAt)->format('Y年n月j日')
            : '';

        return view('native.account.account-pane', [
            'plusSubtitle' => $this->subscribed
                ? '已訂閱'.($expiry !== '' ? '・下次續訂 '.$expiry : '')
                : '解鎖主題色、學習統計等更多功能',
            'sample' => $this->subscribed ? null : SampleActivity::build(),
        ]);
    }
}

<?php

declare(strict_types=1);

namespace App\NativeComponents\Settings;

use AltUU\Domains\Account\Actions\HasAnyAccounts;
use AltUU\Domains\Account\Exceptions\PremiumRequiredException;
use AltUU\Domains\AppConfig\Actions\GetAppConfig;
use AltUU\Domains\AppPreference\Actions\GetAppPreferences;
use AltUU\Domains\AppPreference\Actions\UpdateAppPreferences;
use AltUU\Domains\AppPreference\AppPreferenceStore;
use AltUU\Domains\AppPreference\DataTransferObjects\UpdateAppPreferencesInputData;
use AltUU\Domains\AttachmentDownload\Actions\CleanupAttachmentDownloads;
use AltUU\Domains\Subscription\Actions\GetCachedEntitlement;
use AltUU\Domains\Subscription\Actions\GetEntitlementStatus;
use App\NativeComponents\Concerns\ShowsToasts;
use App\NativeComponents\Concerns\UsesNativeDialogs;
use App\Services\NativeAccent;
use Illuminate\View\View;
use Native\Mobile\Edge\NativeComponent;
use Native\Mobile\Facades\Browser;
use Throwable;

/**
 * Settings (Settings/Index.vue + ThemeSettings.vue).
 *
 * Reachable before login, so it deliberately does NOT use the session guard:
 * every Action here works without a Hungu session. Appearance and accent are
 * stored; the accent is also pushed to the native theme through
 * `NativeAccent::apply()` on mount and whenever it changes. There is no native
 * API to force light/dark, so `appearance` is only persisted (the device
 * scheme is followed) and consumed by `html-content` hosts.
 */
final class SettingsIndex extends NativeComponent
{
    use ManagesDiagnosticRecording;
    use ShowsToasts;
    use UsesNativeDialogs;

    public const int BUILD_NUMBER_REVEAL_TAPS = 5;

    public const float BUILD_NUMBER_TAP_WINDOW_SECONDS = 2.0;

    private const string SAVE_FAILURE_MESSAGE = '儲存設定失敗，請稍後再試。';

    /** Preference property => DTO key, the only keys `savePreference()` accepts. */
    private const array TOGGLES = [
        'nouToolsIntegrationEnabled' => 'nouToolsIntegrationEnabled',
        'screenReaderEnhancedSupportEnabled' => 'screenReaderEnhancedSupportEnabled',
        'liveSessionNicknameModalEnabled' => 'liveSessionNicknameModalEnabled',
        'cellularPlaybackWarningEnabled' => 'cellularPlaybackWarningEnabled',
        'altUuPlusDisabled' => 'altUuPlusDisabled',
    ];

    public bool $nouToolsIntegrationEnabled = false;

    public bool $screenReaderEnhancedSupportEnabled = false;

    public bool $liveSessionNicknameModalEnabled = true;

    public bool $cellularPlaybackWarningEnabled = true;

    public bool $altUuPlusDisabled = false;

    public string $appearance = 'system';

    public string $accentColor = AppPreferenceStore::DEFAULT_ACCENT_COLOR;

    public string $savingKey = '';

    public bool $subscriptionActive = false;

    public bool $hasAccounts = false;

    public bool $materialSourceViewerEnabled = false;

    public string $appDisplayVersion = '';

    public string $appVersionCode = '';

    public bool $buildNumberRevealed = false;

    public int $versionTapCount = 0;

    public float $versionLastTapAt = 0.0;

    public bool $clearingAttachments = false;

    public ?string $attachmentCleanupSummary = null;

    public ?string $attachmentCleanupError = null;

    public bool $whatsNewVisible = false;

    public function mount(): void
    {
        $this->loadPreferences();
        $this->loadRecordingStatus();
        $this->loadContext();

        app(NativeAccent::class)->apply($this->accentColor);
    }

    public function onResume(): void
    {
        $this->loadRecordingStatus();
        $this->loadContext();
    }

    public function navTitle(): string
    {
        return '設定';
    }

    public function savePreference(string $key, bool $value): void
    {
        if (! array_key_exists($key, self::TOGGLES) || $this->savingKey !== '') {
            return;
        }

        $this->savingKey = $key;

        try {
            app(UpdateAppPreferences::class)(UpdateAppPreferencesInputData::from([self::TOGGLES[$key] => $value]));

            $this->{$key} = $value;
        } catch (Throwable) {
            $this->toastError(self::SAVE_FAILURE_MESSAGE);
        } finally {
            $this->savingKey = '';
        }
    }

    public function selectAppearance(string $appearance): void
    {
        if ($this->savingKey !== '' || ! in_array($appearance, ['system', 'light', 'dark'], true)) {
            return;
        }

        $this->savingKey = 'appearance';

        try {
            app(UpdateAppPreferences::class)(UpdateAppPreferencesInputData::from(['appearance' => $appearance]));

            $this->appearance = $appearance;
        } catch (Throwable) {
            $this->toastError(self::SAVE_FAILURE_MESSAGE);
        } finally {
            $this->savingKey = '';
        }
    }

    /**
     * Non-default accents are an Alt UU+ feature: without accounts there is
     * nothing to subscribe with, without an active subscription the user is
     * sent to the subscription screen (also when the backend answers 402).
     */
    public function selectAccent(string $accent): void
    {
        $nativeAccent = app(NativeAccent::class);

        if ($accent === $this->accentColor || $this->savingKey !== '' || ! array_key_exists($accent, $nativeAccent->options())) {
            return;
        }

        if ($accent !== NativeAccent::DEFAULT) {
            if (! $this->hasAccounts) {
                $this->toastError('登入並訂閱 Alt UU+ 後即可更換主題色。');

                return;
            }

            $this->subscriptionActive = $this->refreshEntitlement();

            if (! $this->subscriptionActive) {
                $this->openSubscription();

                return;
            }
        }

        $this->savingKey = 'accent';

        try {
            app(UpdateAppPreferences::class)(UpdateAppPreferencesInputData::from(['accentColor' => $accent]));

            $this->accentColor = $accent;
            $nativeAccent->apply($accent);
        } catch (PremiumRequiredException) {
            $this->subscriptionActive = false;
            $this->openSubscription();
        } catch (Throwable) {
            $this->toastError(self::SAVE_FAILURE_MESSAGE);
        } finally {
            $this->savingKey = '';
        }
    }

    public function registerVersionTap(): void
    {
        if ($this->buildNumberRevealed) {
            return;
        }

        $now = microtime(true);

        $this->versionTapCount = ($now - $this->versionLastTapAt) > self::BUILD_NUMBER_TAP_WINDOW_SECONDS
            ? 1
            : $this->versionTapCount + 1;
        $this->versionLastTapAt = $now;

        if ($this->versionTapCount >= self::BUILD_NUMBER_REVEAL_TAPS) {
            $this->buildNumberRevealed = true;
            $this->versionTapCount = 0;
        }
    }

    public function confirmClearAttachments(): void
    {
        if ($this->clearingAttachments) {
            return;
        }

        $this->confirmWithDialog(
            'clear-attachments',
            '清除已下載附件',
            '這會清除目前裝置中 Alt UU 已下載的所有附件檔案。確定要繼續嗎？',
            '清除',
            destructive: true,
        );
    }

    protected function onDialogConfirmed(string $action, ?string $argument): void
    {
        if ($action === 'clear-attachments') {
            $this->clearAttachments();
        }
    }

    public function openWhatsNew(): void
    {
        $this->whatsNewVisible = true;
    }

    public function closeWhatsNew(): void
    {
        $this->whatsNewVisible = false;
    }

    public function openTerms(): void
    {
        Browser::inApp('https://alt-uu-statics.wcsvdzeimhwq.workers.dev/usage-policy');
    }

    public function openPrivacyPolicy(): void
    {
        Browser::inApp('https://alt-uu-statics.wcsvdzeimhwq.workers.dev/privacy-policy');
    }

    public function openSourceCode(): void
    {
        Browser::inApp('https://github.com/binotaliu/alt-uu');
    }

    public function contactAuthor(): void
    {
        Browser::open('mailto:alt-uu-contact@binota.org');
    }

    public function openDiagnostics(): void
    {
        $this->navigate($this->route('native.settings.diagnostics'));
    }

    public function openDiagnosticLog(): void
    {
        $this->navigate($this->route('native.settings.diagnostics-log'));
    }

    public function openMaterialSource(): void
    {
        $this->navigate($this->route('native.settings.material-source'));
    }

    public function openSubscription(): void
    {
        $this->navigate($this->route('native.courses.account.subscription'));
    }

    public function render(): View
    {
        return view('native.settings.index', [
            'accents' => $this->accentOptions(),
            'recordingNow' => $this->isRecordingNow(),
            'minutesRemaining' => $this->recordingMinutesRemaining(),
        ]);
    }

    /**
     * Swatch colours are data-driven identity colours, taken from each accent's
     * own `accent` token so the config stays the only home for them.
     *
     * @return list<array{id: string, label: string, swatch: string}>
     */
    private function accentOptions(): array
    {
        $options = [];

        foreach (app(NativeAccent::class)->options() as $id => $label) {
            $options[] = [
                'id' => $id,
                'label' => $label,
                'swatch' => (string) config("native-ui.accents.{$id}.light.accent", config('native-ui.theme.light.accent')),
            ];
        }

        return $options;
    }

    private function loadPreferences(): void
    {
        try {
            $preferences = app(GetAppPreferences::class)();

            $this->nouToolsIntegrationEnabled = $preferences->nouToolsIntegrationEnabled;
            $this->screenReaderEnhancedSupportEnabled = $preferences->screenReaderEnhancedSupportEnabled;
            $this->liveSessionNicknameModalEnabled = $preferences->liveSessionNicknameModalEnabled;
            $this->cellularPlaybackWarningEnabled = $preferences->cellularPlaybackWarningEnabled;
            $this->altUuPlusDisabled = $preferences->altUuPlusDisabled;
            $this->appearance = $preferences->appearance;
            $this->accentColor = $preferences->accentColor;
        } catch (Throwable) {
            $this->toastError('無法載入設定，請稍後再試。');
        }
    }

    private function loadContext(): void
    {
        try {
            $config = app(GetAppConfig::class)();

            $this->appDisplayVersion = $config->appDisplayVersion;
            $this->appVersionCode = $config->appVersionCode;
            $this->materialSourceViewerEnabled = $config->materialSourceViewerEnabled;
            $this->hasAccounts = app(HasAnyAccounts::class)();
            $this->subscriptionActive = $this->hasAccounts && app(GetCachedEntitlement::class)()->active;
        } catch (Throwable) {
            // Version text and the subscription hint are cosmetic.
        }
    }

    /**
     * Asks the backend, falling back to the cached entitlement when offline.
     */
    private function refreshEntitlement(): bool
    {
        try {
            return app(GetEntitlementStatus::class)()->active;
        } catch (Throwable) {
            return app(GetCachedEntitlement::class)()->active;
        }
    }

    private function clearAttachments(): void
    {
        $this->clearingAttachments = true;
        $this->attachmentCleanupSummary = null;
        $this->attachmentCleanupError = null;

        try {
            $result = app(CleanupAttachmentDownloads::class)();

            $this->attachmentCleanupSummary = "已清除 {$result['deletedFiles']} 個檔案（共更新 {$result['clearedTasks']} 筆下載紀錄）。";
        } catch (Throwable) {
            $this->attachmentCleanupError = '清除附件失敗，請稍後再試。';
        } finally {
            $this->clearingAttachments = false;
        }
    }
}

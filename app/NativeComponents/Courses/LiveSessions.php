<?php

declare(strict_types=1);

namespace App\NativeComponents\Courses;

use AltUU\Domains\Account\Actions\ListAccounts;
use AltUU\Domains\AppPreference\Actions\GetAppPreferences;
use AltUU\Domains\AppPreference\Actions\UpdateAppPreferences;
use AltUU\Domains\AppPreference\DataTransferObjects\UpdateAppPreferencesInputData;
use AltUU\Domains\Auth\Actions\GetSessionProfile;
use AltUU\Domains\NouTools\Actions\ListLiveSessions;
use App\NativeComponents\Concerns\GuardsHunguSession;
use App\NativeComponents\Concerns\ShowsSessionExpiredPicker;
use App\NativeComponents\Concerns\ShowsToasts;
use App\NativeComponents\Courses\Support\LiveSessionPresenter;
use App\NativeComponents\Courses\Support\LoadFailure;
use App\NativeComponents\Courses\Support\NouToolsGate;
use Illuminate\View\View;
use Native\Mobile\Attributes\Lazy;
use Native\Mobile\Edge\NativeComponent;
use Native\Mobile\Facades\Browser;
use Throwable;

/**
 * "視訊面授" tab (LiveSessionsPane.vue + LiveSessionsTab.vue): NOU Tools live
 * sessions split into upcoming/ongoing and ended, grouped by month, with an
 * all-accounts scope, a display time zone toggle and the nickname reminder
 * shown before opening a classroom.
 *
 * The tab is gated on the NOU Tools preference. A native tab bar cannot
 * intercept a tap, so the gate lives here: while the preference is off the
 * screen shows the confirm sheet (CoursesBottomNav.vue `enableNouTools`) and a
 * button to reopen it; enabling loads the data in place instead of reloading
 * the page.
 *
 * Time zone: PHP cannot ask the device for its zone, so the selector only
 * appears when PHP's default zone is a real non-UTC zone (see
 * LiveSessionPresenter::detectedTimezone()).
 */
#[Lazy]
final class LiveSessions extends NativeComponent
{
    use GuardsHunguSession;
    use ShowsSessionExpiredPicker;
    use ShowsToasts;

    /** @var array<int, array<string, mixed>> */
    public array $items = [];

    public bool $loading = true;

    public string $error = '';

    /** @var array<string, mixed> */
    public array $errorDetail = [];

    public bool $nouToolsEnabled = true;

    public bool $gateVisible = false;

    public bool $showAllAccounts = false;

    public bool $hasMultipleAccounts = false;

    public string $displayTimezone = 'taiwan';

    public bool $savingTimezone = false;

    public bool $nicknameModalEnabled = true;

    public bool $nicknameSheetVisible = false;

    public string $pendingUrl = '';

    public string $pendingNickname = '';

    public string $pendingEmail = '';

    public function navTitle(): string
    {
        return '視訊面授';
    }

    public function placeholder(): View
    {
        return view('native.courses.live-sessions-placeholder');
    }

    public function mount(): void
    {
        if (! $this->ensureHunguSession()) {
            return;
        }

        $this->loadPreferences();
        $this->applyGate();

        if ($this->nouToolsEnabled) {
            $this->loadSessions();
        }
    }

    public function onResume(): void
    {
        if ($this->handleSessionExpired()) {
            return;
        }

        $this->loadPreferences();
        $this->applyGate();

        if ($this->nouToolsEnabled) {
            $this->loadSessions();
        }
    }

    public function refresh(): void
    {
        $this->loadPreferences();

        if ($this->nouToolsEnabled) {
            $this->loadSessions();
        }
    }

    public function retry(): void
    {
        $this->loadSessions();
    }

    public function setAllAccounts(bool $value): void
    {
        if ($this->showAllAccounts === $value) {
            return;
        }

        $this->showAllAccounts = $value;
        $this->loadSessions();
    }

    public function setDisplayTimezone(string $value): void
    {
        if (! in_array($value, ['taiwan', 'local'], true) || $this->savingTimezone || $value === $this->displayTimezone) {
            return;
        }

        $previous = $this->displayTimezone;
        $this->displayTimezone = $value;
        $this->savingTimezone = true;

        try {
            app(UpdateAppPreferences::class)(UpdateAppPreferencesInputData::from(['liveSessionsTimezone' => $value]));
        } catch (Throwable) {
            $this->displayTimezone = $previous;
            $this->toastError('儲存時區失敗，請稍後重試');
        }

        $this->savingTimezone = false;
    }

    public function openGate(): void
    {
        $this->gateVisible = true;
    }

    public function closeGate(): void
    {
        $this->gateVisible = false;
    }

    public function enableNouTools(): void
    {
        if (! NouToolsGate::enable()) {
            $this->toastError('啟用失敗，請稍後重試');

            return;
        }

        $this->gateVisible = false;
        $this->nouToolsEnabled = true;
        $this->loadSessions();
    }

    public function enterClassroom(string $tapKey, string $which): void
    {
        $session = $this->findSession($tapKey);

        if ($session === null) {
            return;
        }

        $url = $which === 'backup' ? $session['backupClassroomUrl'] : $session['link'];

        if (! is_string($url) || $url === '') {
            return;
        }

        if (! $this->nicknameModalEnabled) {
            $this->openUrl($url);

            return;
        }

        $identity = $this->resolveIdentity($session['accountId']);

        $this->pendingUrl = $url;
        $this->pendingNickname = $identity === null ? '' : $identity['username'].' '.$identity['displayName'];
        $this->pendingEmail = $identity === null ? '' : $identity['username'].'@webmail.nou.edu.tw';
        $this->nicknameSheetVisible = true;
    }

    public function closeNicknameSheet(): void
    {
        $this->nicknameSheetVisible = false;
    }

    public function confirmNickname(): void
    {
        if ($this->pendingUrl !== '') {
            $this->openUrl($this->pendingUrl);
        }

        $this->nicknameSheetVisible = false;
    }

    public function onAccountSwitched(int $accountId): void
    {
        $this->items = [];
        $this->showAllAccounts = false;
        $this->loadPreferences();
        $this->applyGate();

        if ($this->nouToolsEnabled) {
            $this->loadSessions();
        }
    }

    private function loadPreferences(): void
    {
        try {
            $preferences = app(GetAppPreferences::class)();

            $this->displayTimezone = $preferences->liveSessionsTimezone === 'local' ? 'local' : 'taiwan';
            $this->nicknameModalEnabled = $preferences->liveSessionNicknameModalEnabled;
            $this->hasMultipleAccounts = count(app(ListAccounts::class)()) > 1;
        } catch (Throwable) {
            // Defaults are fine: Taiwan time and the nickname reminder on.
        }

        if (! $this->hasMultipleAccounts) {
            $this->showAllAccounts = false;
        }
    }

    private function applyGate(): void
    {
        $enabled = NouToolsGate::isEnabled();

        if (! $enabled && $this->nouToolsEnabled) {
            $this->gateVisible = true;
        }

        $this->nouToolsEnabled = $enabled;
    }

    private function loadSessions(): void
    {
        // Only the first load blanks the screen; refreshes keep the list.
        $this->loading = $this->items === [];
        $this->error = '';
        $this->errorDetail = [];

        try {
            $this->items = app(ListLiveSessions::class)($this->showAllAccounts);
        } catch (Throwable $exception) {
            $this->items = [];

            if ($this->handleSessionExpired()) {
                $this->loading = false;

                return;
            }

            ['message' => $this->error, 'detail' => $this->errorDetail] = LoadFailure::describe($exception);
        }

        $this->loading = false;
    }

    /**
     * @return array<string, mixed>|null
     */
    private function findSession(string $tapKey): ?array
    {
        $presented = $this->presented();

        foreach (['upcoming', 'ended'] as $group) {
            foreach ($presented[$group] as $month) {
                foreach ($month['sessions'] as $session) {
                    if ($session['tapKey'] === $tapKey) {
                        return $session;
                    }
                }
            }
        }

        return null;
    }

    /**
     * @return array{username: string, displayName: string}|null
     */
    private function resolveIdentity(mixed $accountId): ?array
    {
        foreach (app(ListAccounts::class)() as $account) {
            if ($account->id === $accountId) {
                return ['username' => $account->username, 'displayName' => $account->displayName];
            }
        }

        $profile = app(GetSessionProfile::class)();

        if ($profile->username !== null && $profile->displayName !== null) {
            return ['username' => $profile->username, 'displayName' => $profile->displayName];
        }

        return null;
    }

    private function openUrl(string $url): void
    {
        if (! Browser::open($url)) {
            Browser::inApp($url);
        }
    }

    /**
     * @return array<string, mixed>
     */
    private function presented(): array
    {
        return LiveSessionPresenter::present($this->items, $this->displayTimezone, $this->systemTimezone());
    }

    private function systemTimezone(): string
    {
        return LiveSessionPresenter::detectedTimezone() ?? LiveSessionPresenter::TAIWAN_TIMEZONE;
    }

    public function render(): View
    {
        $detected = LiveSessionPresenter::detectedTimezone();
        $showTimezoneSelector = $detected !== null && LiveSessionPresenter::offsetMinutes($detected) !== 8 * 60;

        return view('native.courses.live-sessions', [
            'presented' => $this->presented(),
            'showTimezoneSelector' => $showTimezoneSelector,
            'detectedTimezoneLabel' => $detected === null ? '' : $detected.' ('.LiveSessionPresenter::formatUtcOffset(LiveSessionPresenter::offsetMinutes($detected)).')',
            'showAccountLabel' => $this->hasMultipleAccounts && $this->showAllAccounts,
        ]);
    }
}

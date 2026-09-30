<?php

declare(strict_types=1);

use App\Models\Account;
use App\Services\AccountActiveProfile;
use App\Services\UUSessionStore;
use Illuminate\Support\Facades\Http;
use Native\Mobile\Testing\Native;
use Tests\Feature\Native\Fixtures\AccountSeeding;
use Tests\Feature\Native\Fixtures\RecordingHost;
use Tests\Feature\Native\Fixtures\SessionExpiryHost;

beforeEach(function (): void {
    $this->first = AccountSeeding::seed('s1111111', nickname: '小明');
    $this->second = AccountSeeding::seed('s2222222');
    AccountSeeding::activate($this->first);
});

it('lists accounts in the sheet with the active one marked', function (): void {
    RecordingHost::mountView('account-switcher-sheet', ['visible' => true])
        ->assertSee('切換帳號')
        ->assertSee('小明')
        ->assertSee('目前帳號')
        ->assertSee('s2222222')
        ->assertSee('管理帳號');
});

it('switches to another account, toasts and emits switched', function (): void {
    $host = RecordingHost::mountView('account-switcher-sheet', ['visible' => true])
        ->tap('account-'.$this->second->id);

    expect($host->get('events'))->toBe([['switched', $this->second->id]])
        ->and(app(AccountActiveProfile::class)->get())->toBe($this->second->id);

    $host->assertNativeCalled('Dialog.Toast', fn (array $params): bool => $params['message'] === '已切換帳號');
});

it('just closes when the active account is picked', function (): void {
    $host = RecordingHost::mountView('account-switcher-sheet', ['visible' => true])
        ->tap('account-'.$this->first->id);

    expect($host->get('events'))->toBe([['cancel']]);
});

it('sends a stale target account to the reauth screen', function (): void {
    $stale = AccountSeeding::seed('s3333333', withSession: false);
    AccountSeeding::activate($this->first);
    Http::fake([
        'https://uu.nou.edu.tw/xmlapi/index.php?action=login*' => Http::response(['code' => 403, 'message' => 'Auth fail', 'data' => []]),
    ]);

    $host = RecordingHost::mountView('account-switcher-sheet', ['visible' => true])
        ->tap('account-'.$stale->id);

    $host->assertNavigatedTo('/native/reauth/'.$stale->id);
    expect($host->get('events'))->toBe([]);
});

it('opens the manage screen and closes the sheet', function (): void {
    $host = RecordingHost::mountView('account-switcher-sheet', ['visible' => true])->tap('manage');

    expect($host->get('events'))->toBe([['cancel']]);
    $host->assertNavigatedTo('/native/courses/account');
});

it('shows the picker without the failed account and offers re-login', function (): void {
    $host = RecordingHost::mountView('session-expired-picker', ['visible' => true, 'failed' => $this->first->id])
        ->assertSee('登入已失效')
        ->assertSee('「小明」需要重新登入')
        ->assertSee('s2222222')
        ->assertSee('重新登入「小明」')
        ->tap('reauth');

    expect($host->get('events'))->toBe([['cancel']]);
    $host->assertNavigatedTo('/native/reauth/'.$this->first->id);
});

it('switches away from the expired account through the picker', function (): void {
    $host = RecordingHost::mountView('session-expired-picker', ['visible' => true, 'failed' => $this->first->id])
        ->tap('account-'.$this->second->id);

    expect($host->get('events'))->toBe([['switched', $this->second->id]]);
});

it('hides the re-login link when no account failed', function (): void {
    RecordingHost::mountView('session-expired-picker', ['visible' => true])
        ->assertMissingElement('pressable', fn (array $node): bool => ($node['ref'] ?? null) === 'reauth');
});

it('shows the current profile on the switcher button and opens the menu on long press', function (): void {
    $host = RecordingHost::mountView('account-switcher-button')
        ->assertSee('小明')
        ->longPress('open-account');

    $host->assertElement('bottom_sheet', fn (array $node): bool => $node['props']['visible'] === true);
});

it('opens the account pane on tap', function (): void {
    RecordingHost::mountView('account-switcher-button')
        ->tap('open-account')
        ->assertNavigatedTo('/native/courses/account');
});

it('does not open the menu with a single account', function (): void {
    Account::query()->whereKey($this->second->id)->delete();

    RecordingHost::mountView('account-switcher-button')
        ->longPress('open-account')
        ->assertElement('bottom_sheet', fn (array $node): bool => $node['props']['visible'] === false);
});

it('lets a screen carry on when the session is still valid', function (): void {
    $screen = Native::test(SessionExpiryHost::class)->tap('expire');

    expect($screen->get('diverted'))->toBeFalse()
        ->and($screen->get('sessionPickerVisible'))->toBeFalse();
});

it('opens the picker when the active session died and another account exists', function (): void {
    app(UUSessionStore::class)->forget($this->first->id);
    Http::fake([
        'https://uu.nou.edu.tw/xmlapi/index.php?action=login*' => Http::response(['code' => 403, 'message' => 'Auth fail', 'data' => []]),
    ]);

    $screen = Native::test(SessionExpiryHost::class)->tap('expire');

    expect($screen->get('diverted'))->toBeTrue()
        ->and($screen->get('sessionPickerVisible'))->toBeTrue()
        ->and($screen->get('sessionPickerFailedAccountId'))->toBe($this->first->id);

    $screen->tap('account-'.$this->second->id);

    expect($screen->get('sessionPickerVisible'))->toBeFalse()
        ->and($screen->get('switchedTo'))->toBe($this->second->id);
});

it('replaces the screen with reauth when no other account can take over', function (): void {
    Account::query()->whereKey($this->second->id)->delete();
    app(UUSessionStore::class)->forget($this->first->id);
    Http::fake([
        'https://uu.nou.edu.tw/xmlapi/index.php?action=login*' => Http::response(['code' => 403, 'message' => 'Auth fail', 'data' => []]),
    ]);

    Native::test(SessionExpiryHost::class)
        ->tap('expire')
        ->assertReplacedWith('/native/reauth/'.$this->first->id);
});

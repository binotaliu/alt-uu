<?php

declare(strict_types=1);

use App\Models\Account;
use App\NativeComponents\Account\Accounts;
use App\Services\AccountActiveProfile;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;
use Native\Mobile\Testing\Native;
use Tests\Feature\Native\Fixtures\AccountSeeding;

beforeEach(function (): void {
    $this->first = AccountSeeding::seed('s1111111', nickname: '小明');
    $this->second = AccountSeeding::seed('s2222222');
    AccountSeeding::activate($this->first);
});

function fakeAccountsScreenLogin(string $username): void
{
    Http::fake([
        'https://uu.nou.edu.tw/xmlapi/index.php?action=login*' => Http::response([
            'code' => 0,
            'message' => 'success',
            'data' => [
                'session_data' => ['ticket' => 't'],
                'idx_data' => ['session_idx' => 'i'],
                'login_data' => ['username' => $username, 'realname' => '新帳號'],
            ],
        ]),
        'https://uu.nou.edu.tw/xmlapi/index.php?action=my-profile*' => Http::response([
            'code' => 0,
            'message' => 'success',
            'data' => ['username' => $username, 'realname' => '新帳號'],
        ]),
    ]);
}

it('lists the accounts with the active one marked and the rows collapsed', function (): void {
    Native::test(Accounts::class)
        ->assertSee('帳號')
        ->assertSee('小明')
        ->assertSee('s1111111 · 學生 s1111111')
        ->assertSee('目前帳號')
        ->assertSee('s2222222')
        ->assertSee('新增帳號')
        ->assertMissingElement('button', fn (array $node): bool => ($node['ref'] ?? null) === 'rename-'.$this->first->id);
});

it('expands a row to show its actions, hiding switch for the active account', function (): void {
    Native::test(Accounts::class)
        ->tap('account-'.$this->first->id)
        ->assertSet('expandedAccountId', $this->first->id)
        ->assertSee('修改名稱')
        ->assertSee('登出此帳號')
        ->assertDontSee('切換帳號')
        ->tap('account-'.$this->first->id)
        ->assertSet('expandedAccountId', null);
});

it('switches to another account and goes to the course list', function (): void {
    $screen = Native::test(Accounts::class)
        ->tap('account-'.$this->second->id)
        ->tap('switch-'.$this->second->id)
        ->assertNavigatedTo('/courses');

    expect(app(AccountActiveProfile::class)->get())->toBe($this->second->id);
    $screen->assertNativeCalled('Dialog.Toast', fn (array $params): bool => $params['message'] === '已切換帳號');
});

it('sends a stale target account to reauth instead of switching', function (): void {
    $stale = AccountSeeding::seed('s3333333', withSession: false);
    AccountSeeding::activate($this->first);
    Http::fake([
        'https://uu.nou.edu.tw/xmlapi/index.php?action=login*' => Http::response(['code' => 403, 'message' => 'Auth fail', 'data' => []]),
    ]);

    Native::test(Accounts::class)
        ->tap('account-'.$stale->id)
        ->tap('switch-'.$stale->id)
        ->assertNavigatedTo('/reauth/'.$stale->id);

});

it('adds an account and toasts', function (): void {
    fakeAccountsScreenLogin('s4444444');

    $screen = Native::test(Accounts::class)
        ->tap('add-account')
        ->assertSet('addFormVisible', true)
        ->input('add-username', 's4444444')
        ->input('add-password', 'secret')
        ->tap('add-submit')
        ->assertSet('addFormVisible', false)
        ->assertSet('addError', '');

    expect(Account::query()->where('username', 's4444444')->exists())->toBeTrue()
        ->and($screen->get('accounts'))->toHaveCount(3);
});

it('shows the validation message when the fields are empty', function (): void {
    Native::test(Accounts::class)
        ->tap('add-account')
        ->tap('add-submit')
        ->assertSee('請輸入學號或帳號。')
        ->assertSet('addFormVisible', true);
});

it('shows the upstream message when the login is rejected', function (): void {
    Http::fake([
        'https://uu.nou.edu.tw/xmlapi/index.php?action=login*' => Http::response(['code' => 403, 'message' => 'Auth fail', 'data' => []]),
    ]);

    Native::test(Accounts::class)
        ->tap('add-account')
        ->input('add-username', 's4444444')
        ->input('add-password', 'wrong')
        ->tap('add-submit')
        ->assertSet('addFormVisible', true)
        ->assertElement('text', fn (array $node): bool => ($node['ref'] ?? null) === 'add-error')
        ->assertSee('登入失敗，請確認帳號密碼。')
        ->assertDontSee('Auth fail');

    expect(Account::query()->where('username', 's4444444')->exists())->toBeFalse();
});

it('reports an offline failure while adding an account', function (): void {
    Http::fake(fn () => throw new ConnectionException('offline'));

    Native::test(Accounts::class)
        ->tap('add-account')
        ->input('add-username', 's4444444')
        ->input('add-password', 'secret')
        ->tap('add-submit')
        ->assertSet('addProcessing', false)
        ->assertElement('text', fn (array $node): bool => ($node['ref'] ?? null) === 'add-error');
});

it('stops at five accounts', function (): void {
    foreach (['s3333333', 's4444444', 's5555555'] as $username) {
        AccountSeeding::seed($username);
    }
    AccountSeeding::activate($this->first);

    Native::test(Accounts::class)
        ->assertSee('最多只能新增 5 個帳號。')
        ->assertMissingElement('button', fn (array $node): bool => ($node['ref'] ?? null) === 'add-account');

    Native::test(Accounts::class)->set('addFormVisible', true)
        ->set('addUsername', 's6666666')
        ->set('addPassword', 'secret')
        ->call('submitAddAccount')
        ->assertSee('最多只能新增 5 個帳號。');

    expect(Account::query()->count())->toBe(5);
});

it('renames an account through the text input sheet', function (): void {
    $screen = Native::test(Accounts::class)
        ->tap('account-'.$this->second->id)
        ->tap('rename-'.$this->second->id)
        ->assertSet('renamingAccountId', $this->second->id)
        ->assertElement('bottom_sheet', fn (array $node): bool => ($node['props']['visible'] ?? null) === true)
        ->call('saveRename', '  阿華  ')
        ->assertSet('renamingAccountId', null)
        ->assertSee('阿華');

    expect($this->second->fresh()->nickname)->toBe('阿華');
});

it('clears the nickname with an empty value', function (): void {
    Native::test(Accounts::class)
        ->call('openRename', $this->first->id)
        ->call('saveRename', '   ')
        ->assertSet('renamingAccountId', null);

    expect($this->first->fresh()->nickname)->toBeNull();
});

it('rejects a nickname longer than 30 characters', function (): void {
    Native::test(Accounts::class)
        ->call('openRename', $this->first->id)
        ->call('saveRename', str_repeat('字', 31))
        ->assertSet('renamingAccountId', $this->first->id)
        ->assertSet('renameError', '自訂名稱長度不可超過 30 個字。');

    expect($this->first->fresh()->nickname)->toBe('小明');
});

it('cancels a rename without saving', function (): void {
    Native::test(Accounts::class)
        ->call('openRename', $this->first->id)
        ->dismissSheet('rename-text-input-sheet')
        ->assertSet('renamingAccountId', null);

    expect($this->first->fresh()->nickname)->toBe('小明');
});

it('removes an inactive account after confirmation and stays put', function (): void {
    Native::test(Accounts::class)
        ->tap('account-'.$this->second->id)
        ->tap('remove-'.$this->second->id)
        ->assertSet('pendingRemovalId', $this->second->id)
        ->assertElement('bottom_sheet', fn (array $node): bool => ($node['props']['visible'] ?? null) === true)
        ->tap('remove-confirm')
        ->assertSet('pendingRemovalId', null)
        ->assertNoNavigation()
        ->assertDontSee('s2222222');

    expect(Account::query()->whereKey($this->second->id)->exists())->toBeFalse();
});

it('keeps the account when removal is cancelled', function (): void {
    Native::test(Accounts::class)
        ->call('askRemove', $this->second->id)
        ->tap('remove-cancel')
        ->assertSet('pendingRemovalId', null);

    expect(Account::query()->whereKey($this->second->id)->exists())->toBeTrue();
});

it('removing the active account falls through to the remaining account', function (): void {
    Native::test(Accounts::class)
        ->call('askRemove', $this->first->id)
        ->tap('remove-confirm')
        ->assertNoNavigation();

    expect(app(AccountActiveProfile::class)->get())->toBe($this->second->id);
});

it('lands on login when the next account has a dead session and is dropped', function (): void {
    AccountSeeding::seed('s0000001', withSession: false);
    Account::query()->whereKey($this->second->id)->delete();
    AccountSeeding::activate($this->first);
    Http::fake([
        'https://uu.nou.edu.tw/xmlapi/index.php?action=login*' => Http::response(['code' => 403, 'message' => 'Auth fail', 'data' => []]),
    ]);

    Native::test(Accounts::class)
        ->call('askRemove', $this->first->id)
        ->tap('remove-confirm')
        ->assertReplacedWith('/login');
});

it('goes to the login screen after removing the last account', function (): void {
    Account::query()->whereKey($this->second->id)->delete();

    Native::test(Accounts::class)
        ->call('askRemove', $this->first->id)
        ->tap('remove-confirm')
        ->assertReplacedWith('/login');

    expect(Account::query()->count())->toBe(0);
});

it('toasts when the account to remove is already gone', function (): void {
    $screen = Native::test(Accounts::class)->call('askRemove', $this->second->id);
    Account::query()->whereKey($this->second->id)->forceDelete();

    $screen->tap('remove-confirm')
        ->assertSet('pendingRemovalId', null)
        ->assertNativeCalled('Dialog.Toast', fn (array $params): bool => $params['message'] === '找不到這個帳號。');
});

it('works with no valid session and sends an empty device to login', function (): void {
    Account::query()->delete();

    Native::test(Accounts::class)->assertReplacedWith('/login');
});

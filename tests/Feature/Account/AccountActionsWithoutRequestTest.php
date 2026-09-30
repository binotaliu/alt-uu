<?php

declare(strict_types=1);

use AltUU\Domains\Account\Actions\AddAccount;
use AltUU\Domains\Account\Actions\ReauthenticateAccount;
use AltUU\Domains\Account\Actions\RemoveAccount;
use AltUU\Domains\Account\Actions\SwitchAccount;
use AltUU\Domains\Account\DataTransferObjects\AddAccountInputData;
use AltUU\Domains\Account\DataTransferObjects\ReauthenticateAccountInputData;
use AltUU\Domains\Account\Exceptions\AccountLimitExceededException;
use App\Models\Account;
use App\Services\AccountActiveProfile;
use App\Services\AccountCredentialsStore;
use App\Services\UUSessionStore;
use Illuminate\Support\Facades\Http;

function seedNativeAccount(string $username, string $suffix): Account
{
    app(AccountCredentialsStore::class)->put($username, 'test-password');

    /** @var Account $account */
    $account = Account::query()->where('username', $username)->firstOrFail();

    app(UUSessionStore::class)->put([
        'base_url' => "https://uu-{$suffix}.nou.edu.tw",
        'ua' => 'test-agent',
        'ticket' => "ticket-{$suffix}",
        'session_idx' => "idx-{$suffix}",
        'cookies' => ['WM' => "cookie-{$suffix}"],
        'profile' => [
            'display_name' => "測試學生 {$suffix}",
            'username' => $username,
            'picture' => '',
            'realname' => "測試學生 {$suffix}",
        ],
    ], $account->id);

    return $account;
}

function fakeNativeAccountLogin(int $code): void
{
    Http::fake([
        'https://uu.nou.edu.tw/xmlapi/index.php?action=login*' => Http::response([
            'code' => $code,
            'message' => $code === 0 ? 'success' : 'Auth fail',
            'data' => [
                'session_data' => ['ticket' => 't'],
                'idx_data' => ['session_idx' => 'i'],
                'login_data' => ['username' => 's2222222', 'realname' => '新帳號'],
            ],
        ]),
        'https://uu.nou.edu.tw/xmlapi/index.php?action=my-profile*' => Http::response([
            'code' => 0,
            'message' => 'success',
            'data' => ['username' => 's2222222', 'realname' => '新帳號'],
        ]),
    ]);
}

it('adds an account and lists all accounts in the result', function () {
    seedNativeAccount('s1111111', 'a');
    fakeNativeAccountLogin(0);

    $result = app(AddAccount::class)(new AddAccountInputData('s2222222', 'secret'));

    expect($result->ok)->toBeTrue()
        ->and($result->message)->toBe('')
        ->and($result->accounts)->toHaveCount(2)
        ->and(collect($result->accounts)->pluck('username')->all())->toContain('s1111111', 's2222222');
});

it('returns a failed result without accounts when adding an account is rejected upstream', function () {
    seedNativeAccount('s1111111', 'a');
    fakeNativeAccountLogin(403);

    $result = app(AddAccount::class)(new AddAccountInputData('s2222222', 'wrong'));

    expect($result->ok)->toBeFalse()
        ->and($result->message)->toBe('登入失敗，請確認帳號密碼。')
        ->and($result->accounts)->toBe([])
        ->and($result->raw)->toBeArray();
});

it('throws when adding a sixth account', function () {
    foreach (range(1, 5) as $i) {
        app(AccountCredentialsStore::class)->put("s100000{$i}", 'secret');
    }

    app(AddAccount::class)(new AddAccountInputData('s1000006', 'secret'));
})->throws(AccountLimitExceededException::class);

it('reauthenticates an account with a fresh password', function () {
    $account = seedNativeAccount('s2222222', 'a');
    fakeNativeAccountLogin(0);

    $result = app(ReauthenticateAccount::class)($account, new ReauthenticateAccountInputData('new-secret'));

    expect($result->ok)->toBeTrue()
        ->and($result->accounts)->toHaveCount(1);
});

it('returns a failed result when reauthentication is rejected', function () {
    $account = seedNativeAccount('s2222222', 'a');
    fakeNativeAccountLogin(403);

    $result = app(ReauthenticateAccount::class)($account, new ReauthenticateAccountInputData('bad'));

    expect($result->ok)->toBeFalse()
        ->and($result->accounts)->toBe([]);
});

it('switches accounts and primes the session profile', function () {
    $first = seedNativeAccount('s5555555', 'a');
    $second = seedNativeAccount('s6666666', 'b');
    app(AccountActiveProfile::class)->set($first->id);

    $result = app(SwitchAccount::class)($second);

    expect($result->ok)->toBeTrue()
        ->and($result->message)->toBe('')
        ->and(collect($result->accounts)->firstWhere('isActive', true)->username)->toBe('s6666666')
        ->and(app(AccountActiveProfile::class)->get())->toBe($second->id)
        ->and(session('hungu.profile.username'))->toBe('s6666666');
});

it('reports a stale session with the chinese message when switching to an account that cannot log in', function () {
    $first = seedNativeAccount('s5555555', 'a');
    $second = seedNativeAccount('s6666666', 'b');
    app(UUSessionStore::class)->forget($second->id);
    app(AccountActiveProfile::class)->set($first->id);
    Http::fake([
        'https://uu.nou.edu.tw/xmlapi/index.php?action=login*' => Http::response(['code' => 403, 'message' => 'Auth fail', 'data' => []]),
    ]);

    $result = app(SwitchAccount::class)($second);

    expect($result->ok)->toBeFalse()
        ->and($result->message)->toBe('此帳號的登入已失效，請重新輸入密碼。')
        ->and($result->accounts)->toHaveCount(1);
});

it('removes the active account and activates the next one', function () {
    $first = seedNativeAccount('s9999991', 'a');
    $second = seedNativeAccount('s9999992', 'b');
    app(AccountActiveProfile::class)->set($first->id);

    $accounts = app(RemoveAccount::class)($first);

    expect($accounts)->toHaveCount(1)
        ->and(app(AccountActiveProfile::class)->get())->toBe($second->id)
        ->and(session('hungu.profile.username'))->toBe('s9999992');
});

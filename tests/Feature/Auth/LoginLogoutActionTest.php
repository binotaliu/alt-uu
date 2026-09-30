<?php

declare(strict_types=1);

use AltUU\Domains\Auth\Actions\Login;
use AltUU\Domains\Auth\Actions\Logout;
use AltUU\Domains\Auth\DataTransferObjects\LoginInputData;
use App\Models\Account;
use App\Services\AccountActiveProfile;
use App\Services\AccountCredentialsStore;
use App\Services\UUSessionStore;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

function fakeUuLogin(int $code, string $message = 'success'): void
{
    Http::fake([
        'https://uu.nou.edu.tw/xmlapi/index.php?action=login*' => Http::response([
            'code' => $code,
            'message' => $message,
            'data' => [
                'session_data' => ['ticket' => 'ticket-1'],
                'idx_data' => ['session_idx' => 'idx-1'],
                'login_data' => ['username' => 's1234567', 'realname' => '測試學生'],
            ],
        ]),
        'https://uu.nou.edu.tw/xmlapi/index.php?action=my-profile*' => Http::response([
            'code' => 0,
            'message' => 'success',
            'data' => ['username' => 's1234567', 'realname' => '測試學生'],
        ]),
        'https://uu.nou.edu.tw/xmlapi/index.php?action=logout*' => Http::response(['code' => 0, 'message' => 'success']),
    ]);
}

it('logs in without an http request and returns an ok result', function () {
    fakeUuLogin(0);

    $result = app(Login::class)(new LoginInputData('s1234567', 'secret'));

    expect($result->ok)->toBeTrue()
        ->and($result->message)->toBe('')
        ->and($result->raw)->toBeNull()
        ->and(app(AccountCredentialsStore::class)->has())->toBeTrue()
        ->and(app(UUSessionStore::class)->has())->toBeTrue()
        ->and(session('hungu.profile.username'))->toBe('s1234567');
});

it('maps upstream auth failures to the chinese message and keeps the raw payload', function (string $upstream, string $expected) {
    fakeUuLogin(403, $upstream);

    $result = app(Login::class)(new LoginInputData('s1234567', 'wrong'));

    expect($result->ok)->toBeFalse()
        ->and($result->message)->toBe($expected)
        ->and($result->raw)->toBeArray()->toHaveKey('message', $upstream)
        ->and(app(AccountCredentialsStore::class)->has())->toBeFalse();
})->with([
    'auth fail' => ['Auth fail', '登入失敗，請確認帳號密碼。'],
    'wm auth fail' => ['Auth fail::loginType:wm', '登入失敗，請確認帳號密碼。'],
    'other' => ['boom', '登入失敗，請稍後再試。'],
]);

it('logs out without an http request and wipes credentials, cache and session profile', function () {
    fakeUuLogin(0);
    app(Login::class)(new LoginInputData('s1234567', 'secret'));
    Cache::store('database')->put('alt-uu:courses:list:s1234567', [['course_id' => '1']]);

    app(Logout::class)();

    expect(app(AccountCredentialsStore::class)->has())->toBeFalse()
        ->and(app(UUSessionStore::class)->get())->toBeNull()
        ->and(Cache::store('database')->has('alt-uu:courses:list:s1234567'))->toBeFalse()
        ->and(session('hungu.profile'))->toBeNull()
        ->and(app(AccountActiveProfile::class)->get())->toBeNull();

    expect(Account::query()->count())->toBe(0);
});

it('still wipes local state when the upstream logout call fails', function () {
    fakeUuLogin(0);
    app(Login::class)(new LoginInputData('s1234567', 'secret'));
    Http::fake(['https://uu.nou.edu.tw/xmlapi/index.php?action=logout*' => Http::response('nope', 500)]);
    Cache::store('database')->put('alt-uu:courses:list:s1234567', [['course_id' => '1']]);

    try {
        app(Logout::class)();
    } catch (Throwable) {
        // The upstream failure may surface; the local wipe must still happen.
    }

    expect(Cache::store('database')->has('alt-uu:courses:list:s1234567'))->toBeFalse();
});

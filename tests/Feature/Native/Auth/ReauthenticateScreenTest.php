<?php

declare(strict_types=1);

use App\NativeComponents\Auth\Reauthenticate;
use App\Services\AccountActiveProfile;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;
use Native\Mobile\Testing\Native;
use Tests\Feature\Native\Fixtures\AccountSeeding;

function fakeReauthUpstream(int $code, string $message = 'success'): void
{
    Http::fake([
        'https://uu.nou.edu.tw/xmlapi/index.php?action=login*' => Http::response([
            'code' => $code,
            'message' => $message,
            'data' => [
                'session_data' => ['ticket' => 'ticket-new'],
                'idx_data' => ['session_idx' => 'idx-new'],
                'login_data' => ['username' => 's1234567', 'realname' => '測試學生'],
            ],
        ]),
        'https://uu.nou.edu.tw/xmlapi/index.php?action=my-profile*' => Http::response([
            'code' => 0,
            'message' => 'success',
            'data' => ['username' => 's1234567', 'realname' => '測試學生'],
        ]),
    ]);
}

function reauthScreen(int $accountId, array $data = []): mixed
{
    return Native::test(Reauthenticate::class, params: ['accountId' => $accountId], data: $data);
}

it('shows the account name and a password form', function (): void {
    $account = AccountSeeding::seed('s1234567', nickname: '小明');

    reauthScreen($account->id)
        ->assertSee('重新登入')
        ->assertSee('此帳號的登入已失效，請重新輸入密碼以繼續使用。')
        ->assertSee('小明')
        ->assertElement('outlined_text_input', fn (array $node): bool => ($node['props']['secure'] ?? false) === true
            && ($node['props']['revealable'] ?? false) === true)
        ->assertNoNavigation();
});

it('falls back to the profile name without a nickname', function (): void {
    $account = AccountSeeding::seed('s1234567');

    reauthScreen($account->id)->assertSee('學生 s1234567');
});

it('re-logs in and returns to the courses tab by default', function (): void {
    $account = AccountSeeding::seed('s1234567', withSession: false);
    fakeReauthUpstream(0);

    reauthScreen($account->id)
        ->input('password', 'secret')
        ->tap('submit')
        ->assertReplacedWith('/courses')
        ->assertSet('error', '');

    expect(app(AccountActiveProfile::class)->get())->toBe($account->id);
});

it('returns to the screen the user came from', function (): void {
    $account = AccountSeeding::seed('s1234567', withSession: false);
    fakeReauthUpstream(0);

    reauthScreen($account->id, ['returnTo' => '/courses/42'])
        ->input('password', 'secret')
        ->tap('submit')
        ->assertReplacedWith('/courses/42');
});

it('ignores a returnTo that is not an app path', function (): void {
    $account = AccountSeeding::seed('s1234567', withSession: false);
    fakeReauthUpstream(0);

    reauthScreen($account->id, ['returnTo' => 'https://evil.example/x'])
        ->input('password', 'secret')
        ->tap('submit')
        ->assertReplacedWith('/courses');
});

it('reauthenticates an account the session guard already soft-deleted', function (): void {
    $account = AccountSeeding::seed('s1234567', withSession: false);
    $account->delete();
    fakeReauthUpstream(0);

    reauthScreen($account->id)
        ->assertSee('s1234567')
        ->input('password', 'secret')
        ->tap('submit')
        ->assertReplacedWith('/courses');
});

it('shows the failure message for a wrong password and stays put', function (): void {
    $account = AccountSeeding::seed('s1234567', withSession: false);
    fakeReauthUpstream(403, 'Auth fail');

    reauthScreen($account->id)
        ->input('password', 'wrong')
        ->tap('submit')
        ->assertSee('登入失敗，請確認帳號密碼。')
        ->assertSet('processing', false)
        ->assertNoNavigation();
});

it('validates an empty password without calling upstream', function (): void {
    $account = AccountSeeding::seed('s1234567', withSession: false);
    Http::fake();

    reauthScreen($account->id)
        ->tap('submit')
        ->assertSee('請輸入密碼。')
        ->assertNoNavigation();

    Http::assertNothingSent();
});

it('shows a generic error when the platform is unreachable', function (): void {
    $account = AccountSeeding::seed('s1234567', withSession: false);
    Http::fake(fn () => throw new ConnectionException('offline'));

    reauthScreen($account->id)
        ->input('password', 'secret')
        ->tap('submit')
        ->assertSee('登入失敗，請稍後再試。')
        ->assertSet('processing', false)
        ->assertNoNavigation();
});

it('goes to login when the account no longer exists', function (): void {
    reauthScreen(9999)->assertReplacedWith('/login');
});

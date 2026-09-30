<?php

declare(strict_types=1);

use App\Models\Account;
use App\NativeComponents\Concerns\GuardsHunguSession;
use App\Services\AccountActiveProfile;
use App\Services\AccountCredentialsStore;
use App\Services\NativeSessionGuard;
use App\Services\UUSessionStore;
use Illuminate\Support\Facades\Http;
use Illuminate\View\View;
use Native\Mobile\Edge\NativeComponent;
use Native\Mobile\Testing\Native;

final class GuardedTestScreen extends NativeComponent
{
    use GuardsHunguSession;

    public bool $proceeded = false;

    public function mount(): void
    {
        $this->proceeded = $this->ensureHunguSession();
    }

    public function render(): View
    {
        app('view')->addNamespace('native-fixtures', __DIR__.'/Fixtures/views');

        return view('native-fixtures::guarded-screen');
    }
}

/**
 * @return array<string, mixed>
 */
function nativeGuardSession(string $username = 's1234567'): array
{
    return [
        'base_url' => 'https://uu.nou.edu.tw',
        'ua' => 'test-agent',
        'ticket' => 'ticket-1',
        'session_idx' => 'idx-1',
        'cookies' => ['WM' => 'cookie'],
        'profile' => ['display_name' => '測試學生', 'username' => $username, 'picture' => '', 'realname' => '測試學生'],
    ];
}

function seedNativeGuardAccount(string $username = 's1234567', bool $withSession = true): Account
{
    app(AccountCredentialsStore::class)->put($username, 'secret');
    $account = Account::query()->where('username', $username)->firstOrFail();

    if ($withSession) {
        app(UUSessionStore::class)->put(nativeGuardSession($username), $account->id);
    }

    return $account;
}

function fakeNativeGuardUpstream(int $loginCode, int $profileCode = 0): void
{
    Http::fake([
        'https://uu.nou.edu.tw/xmlapi/index.php?action=login*' => Http::response([
            'code' => $loginCode,
            'message' => $loginCode === 0 ? 'success' : 'Auth fail',
            'data' => [
                'session_data' => ['ticket' => 'fresh-ticket'],
                'idx_data' => ['session_idx' => 'fresh-idx'],
                'login_data' => ['username' => 's1234567', 'realname' => '測試學生'],
            ],
        ]),
        'https://uu.nou.edu.tw/xmlapi/index.php?action=my-profile*' => Http::response([
            'code' => $profileCode,
            'message' => $profileCode === 0 ? 'success' : 'expired',
            'data' => ['username' => 's1234567', 'realname' => '測試學生'],
        ]),
    ]);
}

it('lets the screen proceed and primes the session profile when a session exists', function () {
    seedNativeGuardAccount();

    $result = app(NativeSessionGuard::class)->check();

    expect($result->proceeds)->toBeTrue()
        ->and($result->session['ticket'])->toBe('ticket-1')
        ->and($result->redirectRoute)->toBeNull()
        ->and(session('hungu.profile.username'))->toBe('s1234567');
});

it('redirects to native.login when there is no account at all', function () {
    $result = app(NativeSessionGuard::class)->check();

    expect($result->proceeds)->toBeFalse()
        ->and($result->redirectRoute)->toBe('native.login')
        ->and($result->redirectParameters)->toBe([])
        ->and($result->failedAccountId)->toBeNull();
});

it('re-logs in with the remembered credentials when the stored session is gone', function () {
    $account = seedNativeGuardAccount(withSession: false);
    fakeNativeGuardUpstream(loginCode: 0);

    $result = app(NativeSessionGuard::class)->check();

    expect($result->proceeds)->toBeTrue()
        ->and($result->session['ticket'])->toBe('fresh-ticket')
        ->and(app(UUSessionStore::class)->get($account->id)['ticket'])->toBe('fresh-ticket')
        ->and(session('hungu.profile.username'))->toBe('s1234567');
});

it('redirects to native.reauth with the dead account id when the remembered login fails', function () {
    $account = seedNativeGuardAccount(withSession: false);
    fakeNativeGuardUpstream(loginCode: 403);
    session()->put('hungu.profile', ['username' => 'stale']);

    $result = app(NativeSessionGuard::class)->check();

    expect($result->proceeds)->toBeFalse()
        ->and($result->redirectRoute)->toBe('native.reauth')
        ->and($result->redirectParameters)->toBe(['accountId' => $account->id])
        ->and($result->failedAccountId)->toBe($account->id)
        ->and(session('hungu.profile'))->toBeNull();
});

it('keeps the account pointer after a failed remembered login so later checks still report it', function () {
    $account = seedNativeGuardAccount(withSession: false);
    fakeNativeGuardUpstream(loginCode: 403);

    app(NativeSessionGuard::class)->check();
    $second = app(NativeSessionGuard::class)->check();

    expect($second->redirectRoute)->toBe('native.reauth')
        ->and($second->failedAccountId)->toBe($account->id)
        ->and(app(AccountActiveProfile::class)->get())->toBe($account->id);
});

it('validates the stored session upstream when asked and falls back to the remembered login', function () {
    seedNativeGuardAccount();
    Http::fake([
        'https://uu.nou.edu.tw/xmlapi/index.php?action=my-profile*' => Http::sequence()
            ->push(['code' => 401, 'message' => 'expired', 'data' => []])
            ->push(['code' => 0, 'message' => 'success', 'data' => ['username' => 's1234567', 'realname' => '測試學生']]),
        'https://uu.nou.edu.tw/xmlapi/index.php?action=login*' => Http::response([
            'code' => 0,
            'message' => 'success',
            'data' => [
                'session_data' => ['ticket' => 'fresh-ticket'],
                'idx_data' => ['session_idx' => 'fresh-idx'],
                'login_data' => ['username' => 's1234567', 'realname' => '測試學生'],
            ],
        ]),
    ]);

    $result = app(NativeSessionGuard::class)->check(validateRemotely: true);

    expect($result->proceeds)->toBeTrue()
        ->and($result->session['ticket'])->toBe('fresh-ticket');
});

it('does not hit the network for a plain check when the session exists', function () {
    seedNativeGuardAccount();
    Http::fake();

    app(NativeSessionGuard::class)->check();

    Http::assertNothingSent();
});

it('lets a guarded native screen mount when signed in', function () {
    seedNativeGuardAccount();

    Native::test(GuardedTestScreen::class)
        ->assertSet('proceeded', true)
        ->assertNoNavigation();
});

it('replaces a guarded native screen with the login screen when signed out', function () {
    Native::test(GuardedTestScreen::class)
        ->assertSet('proceeded', false)
        ->assertReplacedWith('/login');
});

it('replaces a guarded native screen with the reauth screen when the account session died', function () {
    $account = seedNativeGuardAccount(withSession: false);
    fakeNativeGuardUpstream(loginCode: 403);

    Native::test(GuardedTestScreen::class)
        ->assertReplacedWith("/reauth/{$account->id}");
});

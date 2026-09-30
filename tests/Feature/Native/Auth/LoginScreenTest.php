<?php

declare(strict_types=1);

use AltUU\Domains\AppPreference\Actions\UpdateAppPreferences;
use AltUU\Domains\AppPreference\DataTransferObjects\UpdateAppPreferencesInputData;
use App\Models\Account;
use App\NativeComponents\Auth\Login;
use App\Services\AccountCredentialsStore;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;
use Native\Mobile\Testing\Native;

function fakeUuLoginResponse(int $code, string $message = 'success'): void
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
    ]);
}

beforeEach(function (): void {
    app(UpdateAppPreferences::class)(UpdateAppPreferencesInputData::from(['onboardingCompleted' => true]));
});

it('renders the form with a revealable secure password field and no web view', function (): void {
    Native::test(Login::class)
        ->assertSee('登入 NOU UU 平台')
        ->assertSee('使用條款')
        ->assertSee('隱私權政策')
        ->assertElement('outlined_text_input', fn (array $node): bool => ($node['props']['secure'] ?? false) === true
            && ($node['props']['revealable'] ?? false) === true)
        ->assertMissingElement('webview')
        ->assertNoNavigation();
});

it('sends first-time users to onboarding', function (): void {
    app(UpdateAppPreferences::class)(UpdateAppPreferencesInputData::from(['onboardingCompleted' => false]));

    Native::test(Login::class)->assertReplacedWith('/onboarding');
});

it('logs in and replaces the screen with the courses tab', function (): void {
    fakeUuLoginResponse(0);

    Native::test(Login::class)
        ->input('username', 's1234567')
        ->input('password', 'secret')
        ->tap('submit')
        ->assertReplacedWith('/courses')
        ->assertSet('error', '')
        ->assertSet('password', '');

    expect(app(AccountCredentialsStore::class)->has())->toBeTrue()
        ->and(Account::query()->where('username', 's1234567')->exists())->toBeTrue();
});

it('shows the Chinese message and the raw response for wrong credentials', function (): void {
    fakeUuLoginResponse(403, 'Auth fail');

    Native::test(Login::class)
        ->input('username', 's1234567')
        ->input('password', 'wrong')
        ->tap('submit')
        ->assertSee('登入失敗，請確認帳號密碼。')
        ->assertNoNavigation()
        ->assertSet('processing', false)
        ->assertSee('若登入持續失敗，可展開檢視伺服器回應內容')
        ->assertDontSee('"message": "Auth fail"')
        ->tap('toggle-raw')
        ->assertSee('"message": "Auth fail"');

    expect(Account::query()->count())->toBe(0);
});

it('maps unknown upstream failures to the generic message', function (): void {
    fakeUuLoginResponse(500, 'boom');

    Native::test(Login::class)
        ->input('username', 's1234567')
        ->input('password', 'secret')
        ->tap('submit')
        ->assertSee('登入失敗，請稍後再試。')
        ->assertNoNavigation();
});

it('validates empty fields without calling upstream', function (): void {
    Http::fake();

    Native::test(Login::class)
        ->tap('submit')
        ->assertSee('請輸入學號或帳號。')
        ->assertNoNavigation();

    Http::assertNothingSent();
});

it('requires a password when only the username is filled', function (): void {
    Http::fake();

    Native::test(Login::class)
        ->input('username', 's1234567')
        ->tap('submit')
        ->assertSee('請輸入密碼。');

    Http::assertNothingSent();
});

it('shows a retryable error when the platform is unreachable', function (): void {
    Http::fake(fn () => throw new ConnectionException('offline'));

    Native::test(Login::class)
        ->input('username', 's1234567')
        ->input('password', 'secret')
        ->tap('submit')
        ->assertSee('登入失敗，請稍後再試。')
        ->assertSet('processing', false)
        ->assertNoNavigation();
});

it('opens the policies in the in-app browser', function (): void {
    Native::test(Login::class)
        ->tap('usage-policy')
        ->assertNativeCalled('Browser.OpenInApp', fn (array $params): bool => $params['url'] === Login::USAGE_POLICY_URL)
        ->tap('privacy-policy')
        ->assertNativeCalled('Browser.OpenInApp', fn (array $params): bool => $params['url'] === Login::PRIVACY_POLICY_URL);
});

it('links to settings', function (): void {
    Native::test(Login::class)
        ->tap('settings')
        ->assertNavigatedTo('/settings');
});

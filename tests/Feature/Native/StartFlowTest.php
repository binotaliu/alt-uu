<?php

declare(strict_types=1);

use AltUU\Domains\AppPreference\Actions\UpdateAppPreferences;
use AltUU\Domains\AppPreference\DataTransferObjects\UpdateAppPreferencesInputData;
use App\NativeComponents\Auth\Login;
use App\NativeComponents\Auth\Onboarding;
use App\NativeComponents\Courses\CourseList;
use Illuminate\Support\Facades\Http;
use Native\Mobile\Edge\NativeRouter;
use Native\Mobile\Testing\Native;

it('starts on the native courses screen', function (): void {
    $startUrl = config('nativephp.start_url');

    expect(NativeRouter::resolve($startUrl)['class'])->toBe(CourseList::class)
        ->and(route('native.courses.index', absolute: false))->toBe($startUrl);
});

it('walks a fresh install from onboarding to login to the course list', function (): void {
    $startUrl = config('nativephp.start_url');

    Native::visit($startUrl)->assertReplacedWith(route('native.onboarding', absolute: false));

    Native::test(Onboarding::class)
        ->set('currentSlide', 2)
        ->tap('continue')
        ->assertReplacedWith(route('native.login', absolute: false));

    Native::visit($startUrl)->assertReplacedWith(route('native.login', absolute: false));

    Http::fake([
        'https://uu.nou.edu.tw/xmlapi/index.php?action=login*' => Http::response([
            'code' => 0,
            'message' => 'success',
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
        '*' => Http::response('<html><body></body></html>'),
    ]);

    Native::test(Login::class)
        ->input('username', 's1234567')
        ->input('password', 'secret')
        ->tap('submit')
        ->assertReplacedWith(route('native.courses.index', absolute: false));
});

it('sends a finished onboarding without an account to login', function (): void {
    app(UpdateAppPreferences::class)(UpdateAppPreferencesInputData::from(['onboardingCompleted' => true]));

    Native::visit(config('nativephp.start_url'))->assertReplacedWith(route('native.login', absolute: false));
});

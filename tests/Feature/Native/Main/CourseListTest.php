<?php

declare(strict_types=1);

use AltUU\Domains\AppPreference\Actions\UpdateAppPreferences;
use AltUU\Domains\AppPreference\DataTransferObjects\UpdateAppPreferencesInputData;
use App\Models\Account;
use App\NativeComponents\Courses\CourseList;
use App\NativeComponents\Support\ReleaseNotes;
use App\Services\AccountActiveProfile;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Native\Mobile\Testing\Native;
use Tests\Feature\Native\Fixtures\AccountSeeding;

beforeEach(function (): void {
    Cache::flush();
    app(UpdateAppPreferences::class)(UpdateAppPreferencesInputData::from(['onboardingCompleted' => true]));
    $account = AccountSeeding::seed('s1234567');
    AccountSeeding::activate($account);
});

function fakeCourseUpstream(?array $courses = null, bool $tasksDown = false): void
{
    $list = $courses ?? [
        ['course_id' => '1001', 'title' => '(114上)資料結構-甲班'],
        ['course_id' => '1002', 'title' => '(113下)演算法'],
    ];

    Http::fake([
        'https://uu.nou.edu.tw/xmlapi/index.php?action=my-profile*' => Http::response(['code' => 0, 'message' => 'success', 'data' => ['username' => 's1234567', 'realname' => '測試學生']]),
        'https://uu.nou.edu.tw/xmlapi/index.php?action=my-course-list*' => Http::response(['code' => 0, 'data' => ['list' => $list]]),
        'https://uu.nou.edu.tw/learn/my_homework.php' => $tasksDown
            ? fn () => throw new ConnectionException('offline')
            : Http::response('<div class="data2"><table class="table subject"><tr><td>1001</td><td>x</td><td>1</td><td>2</td></tr></table></div>'),
        'https://uu.nou.edu.tw/learn/my_forum.php' => $tasksDown
            ? fn () => throw new ConnectionException('offline')
            : Http::response('<div class="data2"><table class="table subject"><tr><td>1001</td><td>x</td><td>7</td></tr></table></div>'),
    ]);
}

it('lists courses grouped by semester with task counters', function (): void {
    fakeCourseUpstream();

    Native::test(CourseList::class)
        ->assertSee('114上')
        ->assertSee('113下')
        ->assertSee('資料結構')
        ->assertSee('演算法')
        ->assertSee('未繳作業 2')
        ->assertSee('未讀文章 7')
        ->assertSee('無待辦');
});

it('mounts inside the main tabs layout', function (): void {
    fakeCourseUpstream();

    Native::visit('/courses')
        ->assertScreen(CourseList::class)
        ->assertNavTitle('我的課程')
        ->assertHasTabBar()
        ->assertTabActive('我的課程');
});

it('opens a course on tap', function (): void {
    fakeCourseUpstream();

    Native::test(CourseList::class)
        ->tap('course-1001')
        ->assertNavigatedTo('/courses/1001');
});

it('shows the empty state for an account without courses', function (): void {
    fakeCourseUpstream([]);

    Native::test(CourseList::class)->assertSee('您的帳號目前未有課程，期待下學期與您在課堂上見面');
});

it('keeps the list when only the task counters fail', function (): void {
    fakeCourseUpstream(tasksDown: true);

    Native::test(CourseList::class)
        ->assertSee('資料結構')
        ->assertSee('取得待辦失敗');
});

it('shows a retryable error when the course list fails and recovers on retry', function (): void {
    Http::fake([
        'https://uu.nou.edu.tw/xmlapi/index.php?action=my-profile*' => Http::response(['code' => 0, 'message' => 'success', 'data' => ['username' => 's1234567', 'realname' => '測試學生']]),
        'https://uu.nou.edu.tw/xmlapi/index.php?action=my-course-list*' => Http::sequence()
            ->pushFailedConnection()
            ->push(['code' => 0, 'data' => ['list' => [['course_id' => '1001', 'title' => '(114上)資料結構-甲班']]]]),
        'https://uu.nou.edu.tw/learn/*' => Http::response('', 500),
    ]);

    Native::test(CourseList::class)
        ->assertSee('App 發生未預期的錯誤，請稍後再試。')
        ->assertSee('重試')
        ->tap('retry')
        ->assertSee('資料結構')
        ->assertDontSee('App 發生未預期的錯誤');
});

it('redirects to the login screen when there is no account', function (): void {
    app(AccountActiveProfile::class)->clear();
    Account::query()->delete();

    Native::test(CourseList::class)->assertReplacedWith('/login');
});

it('opens the What\'s New sheet for an upgrading user only', function (): void {
    fakeCourseUpstream();
    config(['nativephp.version' => ReleaseNotes::releases()[0]['version']]);
    app(UpdateAppPreferences::class)(
        UpdateAppPreferencesInputData::from(['onboardingCompleted' => true]),
    );

    $screen = Native::test(CourseList::class);
    expect($screen->get('whatsNewVisible'))->toBeTrue();

    $screen->dismissSheet('whats-new');
    expect($screen->get('whatsNewVisible'))->toBeFalse();
});

it('sends a first launch to onboarding instead of loading courses', function (): void {
    fakeCourseUpstream();
    app(UpdateAppPreferences::class)(UpdateAppPreferencesInputData::from(['onboardingCompleted' => false]));

    Native::test(CourseList::class)->assertReplacedWith('/onboarding');

    Http::assertNotSent(fn ($request): bool => str_contains($request->url(), 'my-course-list'));
});

it('restores the material screen of a still-playing native player instead of loading the list', function (): void {
    fakeCourseUpstream();
    Native::fakeBridge()->respondTo('MediaPlayer.GetState', ['status' => 'success', 'data' => ['isActive' => true, 'sessionContext' => [
        'routePath' => '/courses/1001/V1', 'cid' => '1001', 'activityId' => 'V1', 'startedAt' => now()->toIso8601String(),
    ]]]);

    Native::test(CourseList::class)
        ->assertNavigatedTo('/courses/1001/V1')
        ->assertSet('courses', []);

    Http::assertNotSent(fn ($request): bool => str_contains($request->url(), 'my-course-list'));
});

it('does not navigate away when no native player session is running', function (): void {
    fakeCourseUpstream();
    Native::fakeBridge()->respondTo('MediaPlayer.GetState', ['status' => 'success', 'data' => ['isActive' => false]]);

    Native::test(CourseList::class)->assertNoNavigation()->assertSee('資料結構');
});

<?php

declare(strict_types=1);

use App\NativeComponents\Account\AccountPane;
use App\NativeComponents\Account\Accounts;
use App\NativeComponents\Account\DataExport;
use App\NativeComponents\Account\ExamInfo;
use App\NativeComponents\Account\Grades;
use App\NativeComponents\Account\Subscription;
use App\NativeComponents\Auth\Login;
use App\NativeComponents\Auth\Onboarding;
use App\NativeComponents\Auth\Reauthenticate;
use App\NativeComponents\Courses\CourseList;
use App\NativeComponents\Courses\CourseShow;
use App\NativeComponents\Courses\DiscussBoard;
use App\NativeComponents\Courses\DiscussThread;
use App\NativeComponents\Courses\LiveSessions;
use App\NativeComponents\Courses\Material;
use App\NativeComponents\Courses\SchoolCalendar;
use App\NativeComponents\Settings\ConnectivityDiagnostics;
use App\NativeComponents\Settings\DiagnosticLog;
use App\NativeComponents\Settings\MaterialSource;
use App\NativeComponents\Settings\SettingsIndex;
use App\NativeLayouts\FormStackLayout;
use App\NativeLayouts\GuestLayout;
use App\NativeLayouts\MainTabsLayout;
use App\NativeLayouts\StackLayout;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Native (SuperNative) routes
|--------------------------------------------------------------------------
|
| Mirrors resources/js/router.ts one to one. Until the cutover every route is
| mounted under a temporary `/native` URI prefix with `native.` route names,
| because this file loads after web.php and would otherwise replace the SPA's
| `/login`, `/{any}` and same-named routes. At cutover, delete the prefix and
| name-prefix wrapper below (see docs/native-migration/conventions.md).
|
| Static segments are registered before {param} siblings.
*/

Route::prefix('native')->name('native.')->group(function (): void {
    Route::nativeGroup(GuestLayout::class, function (): void {
        Route::native('/login', Login::class)->name('login');
        Route::native('/onboarding', Onboarding::class)->name('onboarding');
        Route::native('/reauth/{accountId}', Reauthenticate::class)->name('reauth');
    });

    Route::nativeGroup(MainTabsLayout::class, function (): void {
        Route::native('/courses', CourseList::class)->name('courses.index');
        Route::native('/courses/live-sessions', LiveSessions::class)->name('courses.live-sessions');
        Route::native('/courses/school-calendar', SchoolCalendar::class)->name('courses.school-calendar');
        Route::native('/courses/account', AccountPane::class)->name('courses.account');
    });

    Route::nativeGroup(FormStackLayout::class, function (): void {
        Route::native('/courses/account/accounts', Accounts::class)->name('courses.account.accounts');
        Route::native('/courses/account/subscription', Subscription::class)->name('courses.account.subscription');
        Route::native('/courses/account/data-export', DataExport::class)->name('courses.account.data-export');
    });

    Route::nativeGroup(StackLayout::class, function (): void {
        Route::native('/courses/account/grades', Grades::class)->name('courses.account.grades');
        Route::native('/courses/account/exam-info', ExamInfo::class)->name('courses.account.exam-info');

        Route::native('/settings', SettingsIndex::class)->name('settings');
        Route::native('/settings/diagnostics', ConnectivityDiagnostics::class)->name('settings.diagnostics');
        Route::native('/settings/diagnostics/log', DiagnosticLog::class)->name('settings.diagnostics-log');
        Route::native('/settings/diagnostics/material', MaterialSource::class)->name('settings.material-source');

        Route::native('/courses/{cid}', CourseShow::class)->name('courses.show');
        Route::native('/courses/{cid}/discuss/{boardCid}/{bid}', DiscussBoard::class)->name('courses.discuss.board.show');
        Route::native('/courses/{cid}/discuss/{boardCid}/{bid}/{nid}', DiscussThread::class)->name('courses.discuss.thread.show');
        Route::native('/courses/{cid}/{scoid}', Material::class)->name('courses.material.show');
    });
});

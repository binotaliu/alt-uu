<?php

use App\Http\Controllers\Api\AccountActivityController;
use App\Http\Controllers\Api\AccountController;
use App\Http\Controllers\Api\AllCourseGradesController;
use App\Http\Controllers\Api\AppConfigController;
use App\Http\Controllers\Api\AppPreferencesController;
use App\Http\Controllers\Api\AppStatusController;
use App\Http\Controllers\Api\AttachmentDownloadStatusController;
use App\Http\Controllers\Api\BlockedUsersModerationController;
use App\Http\Controllers\Api\BlockUserModerationController;
use App\Http\Controllers\Api\CachedSubscriptionStatusController;
use App\Http\Controllers\Api\CheckConnectivityServiceController;
use App\Http\Controllers\Api\ClearAttachmentDownloadsController;
use App\Http\Controllers\Api\ClearDiagnosticEventsController;
use App\Http\Controllers\Api\CourseGradeController;
use App\Http\Controllers\Api\CourseHomeworksController;
use App\Http\Controllers\Api\CourseLastSeenMaterialController;
use App\Http\Controllers\Api\CourseLearningTimesController;
use App\Http\Controllers\Api\CourseNodeContentController;
use App\Http\Controllers\Api\CourseNodeResourcesController;
use App\Http\Controllers\Api\CoursePathController;
use App\Http\Controllers\Api\CourseSchoolPortalInfoController;
use App\Http\Controllers\Api\CourseSelfExamsController;
use App\Http\Controllers\Api\CourseTasksCountController;
use App\Http\Controllers\Api\DataExportController;
use App\Http\Controllers\Api\DataImportController;
use App\Http\Controllers\Api\DiagnosticBundleController;
use App\Http\Controllers\Api\DiagnosticRecordingController;
use App\Http\Controllers\Api\DiscussBoardController;
use App\Http\Controllers\Api\DiscussNodeController;
use App\Http\Controllers\Api\DiscussPostController;
use App\Http\Controllers\Api\DiscussWhisperController;
use App\Http\Controllers\Api\ExamAgendaController;
use App\Http\Controllers\Api\LikeDiscussPostController;
use App\Http\Controllers\Api\ListAccountsController;
use App\Http\Controllers\Api\ListConnectivityServicesController;
use App\Http\Controllers\Api\ListCoursesController;
use App\Http\Controllers\Api\ListDiagnosticEventsController;
use App\Http\Controllers\Api\MaterialContentProxyController;
use App\Http\Controllers\Api\MaterialDirectoryInspectionController;
use App\Http\Controllers\Api\MaterialPreferenceController;
use App\Http\Controllers\Api\MaterialSourceInspectionController;
use App\Http\Controllers\Api\NouToolsCourseInfoController;
use App\Http\Controllers\Api\NouToolsLiveSessionsController;
use App\Http\Controllers\Api\NouToolsSchoolCalendarController;
use App\Http\Controllers\Api\ParsedMaterialContentController;
use App\Http\Controllers\Api\PlaybackProgressController;
use App\Http\Controllers\Api\PurchaseSubscriptionController;
use App\Http\Controllers\Api\QueueAttachmentDownloadController;
use App\Http\Controllers\Api\ReauthenticateAccountController;
use App\Http\Controllers\Api\ReportModerationController;
use App\Http\Controllers\Api\RestoreSubscriptionController;
use App\Http\Controllers\Api\SessionProfileController;
use App\Http\Controllers\Api\SetDiscussForumReadController;
use App\Http\Controllers\Api\StoreClientDiagnosticEventsController;
use App\Http\Controllers\Api\SubscriptionProductsController;
use App\Http\Controllers\Api\SubscriptionStatusController;
use App\Http\Controllers\Api\SwitchAccountController;
use App\Http\Controllers\Api\SyncModerationController;
use App\Http\Controllers\Api\UnlikeDiscussPostController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\BootstrapSessionController;
use App\Http\Controllers\StudyTimeController;
use App\Http\Middleware\EnsureHunguSession;
use App\Http\Middleware\EnsureMaterialSourceViewerEnabled;
use App\Services\UUSessionStore;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Route;

Route::post('/login', [AuthController::class, 'store'])->name('login.store');
Route::post('/logout', [AuthController::class, 'destroy'])->name('logout');
Route::post('/api/auth/bootstrap-session', BootstrapSessionController::class)->name('api.auth.bootstrap-session');

// Reachable without a live Hungu session: a device's local account list must
// stay available so the frontend can offer an account picker / re-login flow
// instead of a blind redirect when the active account's session dies.
Route::get('/api/accounts', ListAccountsController::class)->name('api.accounts.index');
Route::post('/api/accounts/{account}/reauthenticate', ReauthenticateAccountController::class)
    ->name('api.accounts.reauthenticate');
// Also unguarded: switching to a *different* account must work even when the
// currently active account's session is the one that just died — otherwise
// the account picker offered for that failure could never actually recover.
Route::post('/api/accounts/{account}/switch', SwitchAccountController::class)->name('api.accounts.switch');

Route::get('/api/config', AppConfigController::class)->name('api.config');

// Update banner and known-issue announcements from the statics site. Needs no
// Hungu session: the notice matters most when something is broken, which
// includes login.
Route::get('/api/app-status', [AppStatusController::class, 'show'])->name('api.app-status.show');
Route::post('/api/app-status/dismissals', [AppStatusController::class, 'store'])
    ->name('api.app-status.dismissals.store');

// Reachable without a live Hungu session so the diagnostic tool can report on
// Hungu-session-dependent failures too.
Route::prefix('api/diagnostics/connectivity')->group(function (): void {
    Route::get('/services', ListConnectivityServicesController::class)
        ->name('api.diagnostics.connectivity.services');
    Route::get('/{service}', CheckConnectivityServiceController::class)
        ->name('api.diagnostics.connectivity.check');
});

// Also outside EnsureHunguSession: a dead session is one of the things the
// log exists to explain, so the log must stay readable when there isn't one.
Route::prefix('api/diagnostics/log')->group(function (): void {
    Route::get('/', ListDiagnosticEventsController::class)
        ->name('api.diagnostics.log.index');
    Route::get('/bundle', DiagnosticBundleController::class)
        ->name('api.diagnostics.log.bundle');
    Route::post('/client-events', StoreClientDiagnosticEventsController::class)
        ->name('api.diagnostics.log.client-events');
    Route::get('/recording', [DiagnosticRecordingController::class, 'show'])
        ->name('api.diagnostics.log.recording.show');
    Route::put('/recording', [DiagnosticRecordingController::class, 'update'])
        ->name('api.diagnostics.log.recording.update');
    Route::delete('/', ClearDiagnosticEventsController::class)
        ->name('api.diagnostics.log.clear');
});

Route::get('/api/preferences', [AppPreferencesController::class, 'show'])
    ->name('api.preferences.show');
Route::patch('/api/preferences', [AppPreferencesController::class, 'update'])
    ->name('api.preferences.update');

Route::prefix('api/moderation')->group(function (): void {
    Route::post('/sync', SyncModerationController::class)->name('api.moderation.sync');
    Route::post('/report', ReportModerationController::class)->name('api.moderation.report');
    Route::post('/block-user', [BlockUserModerationController::class, 'store'])->name('api.moderation.block-user');
    Route::delete('/block-user', [BlockUserModerationController::class, 'destroy'])->name('api.moderation.unblock-user');
    Route::get('/blocked-users', BlockedUsersModerationController::class)->name('api.moderation.blocked-users');
});

Route::middleware([EnsureHunguSession::class])->group(function (): void {
    Route::post('/study-time', [StudyTimeController::class, 'store'])->name('study-time.store');

    Route::prefix('materials')->group(function (): void {
        Route::get('content/parsed', ParsedMaterialContentController::class);
    });

    Route::get('material-proxy/{encodedUrl}', MaterialContentProxyController::class)
        ->where('encodedUrl', '[A-Za-z0-9_-]+')
        ->name('material.content');

    Route::prefix('api')->group(function (): void {
        Route::get('/auth/profile', SessionProfileController::class)->name('api.auth.profile');

        Route::get('/courses', ListCoursesController::class)->name('api.courses.index');
        Route::get('/courses/tasks-count', CourseTasksCountController::class)->name('api.courses.tasks-count');
        Route::get('/grades', AllCourseGradesController::class)->name('api.grades.index');
        Route::get('/exam-agenda', ExamAgendaController::class)->name('api.exam-agenda.index');
        Route::get('/courses/{cid}/path', CoursePathController::class)->name('api.courses.path');
        Route::get('/courses/{cid}/learning-times', CourseLearningTimesController::class)->name('api.courses.learning-times');
        Route::get('/courses/{cid}/homeworks', CourseHomeworksController::class)->name('api.courses.homeworks');
        Route::get('/courses/{cid}/grades', CourseGradeController::class)->name('api.courses.grades');
        Route::get('/courses/{cid}/self-exams', CourseSelfExamsController::class)->name('api.courses.self-exams');
        Route::get('/courses/{cid}/nou-tools-info', NouToolsCourseInfoController::class)
            ->name('api.courses.nou-tools-info');
        Route::get('/courses/{cid}/school-portal-info', CourseSchoolPortalInfoController::class)
            ->name('api.courses.school-portal-info');
        Route::get('/courses/{cid}/nodes/{scoid}/resources', CourseNodeResourcesController::class)->name('api.courses.node.resources');
        Route::get('/courses/{cid}/nodes/{scoid}/content', CourseNodeContentController::class)->name('api.courses.node.content');

        // Needs the live Hungu session, unlike the log: it fetches the school's
        // own pages to show what they actually contain.
        Route::get('/diagnostics/material/{cid}/directory', MaterialDirectoryInspectionController::class)
            ->middleware(EnsureMaterialSourceViewerEnabled::class)
            ->name('api.diagnostics.material.directory');
        Route::get('/diagnostics/material/{cid}/nodes/{scoid}', MaterialSourceInspectionController::class)
            ->middleware(EnsureMaterialSourceViewerEnabled::class)
            ->name('api.diagnostics.material.source');

        Route::get('/nou-tools/live-sessions', NouToolsLiveSessionsController::class)
            ->name('api.nou-tools.live-sessions');
        Route::get('/nou-tools/school-calendar', NouToolsSchoolCalendarController::class)
            ->name('api.nou-tools.school-calendar');

        Route::get('/discuss/boards', [DiscussBoardController::class, 'index'])->name('api.discuss.boards');
        Route::get('/discuss/nodes', [DiscussNodeController::class, 'index'])->name('api.discuss.nodes');
        Route::get('/discuss/posts', [DiscussPostController::class, 'index'])->name('api.discuss.posts');

        Route::post('/discuss/posts', [DiscussPostController::class, 'store'])->name('api.discuss.posts.create');
        Route::patch('/discuss/posts/{postId}', [DiscussPostController::class, 'update'])->name('api.discuss.posts.update');
        Route::delete('/discuss/posts/{postId}', [DiscussPostController::class, 'destroy'])->name('api.discuss.posts.delete');
        Route::post('/discuss/posts/{nodeId}/like', LikeDiscussPostController::class)->name('api.discuss.posts.like');
        Route::post('/discuss/posts/{nodeId}/unlike', UnlikeDiscussPostController::class)->name('api.discuss.posts.unlike');

        Route::post('/discuss/whispers', [DiscussWhisperController::class, 'store'])->name('api.discuss.whispers.create');
        Route::patch('/discuss/whispers/{whisperId}', [DiscussWhisperController::class, 'update'])->name('api.discuss.whispers.update');
        Route::delete('/discuss/whispers/{whisperId}', [DiscussWhisperController::class, 'destroy'])->name('api.discuss.whispers.delete');
        Route::post('/discuss/read/{postId}', SetDiscussForumReadController::class)->name('api.discuss.read');

        Route::get('/preferences/material-font-scale', [MaterialPreferenceController::class, 'show'])
            ->name('api.preferences.material-font-scale');
        Route::post('/preferences/material-font-scale', [MaterialPreferenceController::class, 'store'])
            ->name('api.preferences.material-font-scale.store');

        Route::get('/playback-progress/{cid}/{activityId}', [PlaybackProgressController::class, 'show'])
            ->name('api.playback-progress.show');
        Route::get('/courses/{cid}/last-seen-material', CourseLastSeenMaterialController::class)
            ->name('api.courses.last-seen-material');

        Route::post('/attachments/download-tasks', QueueAttachmentDownloadController::class)
            ->name('api.attachments.download-tasks.queue');
        Route::post('/attachments/download-tasks/cleanup', ClearAttachmentDownloadsController::class)
            ->name('api.attachments.download-tasks.cleanup');
        Route::get('/attachments/download-tasks/{taskId}', AttachmentDownloadStatusController::class)
            ->whereNumber('taskId')
            ->name('api.attachments.download-tasks.status');

        Route::prefix('accounts')->group(function (): void {
            Route::post('/', [AccountController::class, 'store'])->name('api.accounts.store');
            Route::patch('/{account}/nickname', [AccountController::class, 'update'])->name('api.accounts.rename');
            Route::delete('/{account}', [AccountController::class, 'destroy'])->name('api.accounts.destroy');
            Route::get('/activity', AccountActivityController::class)->name('api.accounts.activity');
        });

        Route::prefix('data-export')->group(function (): void {
            Route::get('/', DataExportController::class)->name('api.data-export.show');
            Route::post('/import', DataImportController::class)->name('api.data-export.import');
        });

        Route::prefix('subscription')->group(function (): void {
            Route::get('/products', [SubscriptionProductsController::class, 'index'])->name('api.subscription.products');
            Route::get('/status', SubscriptionStatusController::class)->name('api.subscription.status');
            Route::get('/status/cached', CachedSubscriptionStatusController::class)->name('api.subscription.status.cached');
            Route::post('/purchase', PurchaseSubscriptionController::class)->name('api.subscription.purchase');
            Route::post('/restore', RestoreSubscriptionController::class)->name('api.subscription.restore');
        });

        Route::get('/hungu-cookies', static function (): JsonResponse {
            $session = app(UUSessionStore::class)->get();

            if (! is_array($session)) {
                return response()->json(['cookies' => [], 'domain' => '']);
            }

            $cookies = $session['cookies'] ?? [];
            $baseUrl = $session['base_url'] ?? '';
            $domain = parse_url($baseUrl, PHP_URL_HOST) ?: '';

            return response()->json([
                'cookies' => collect($cookies)
                    ->map(static fn (string $value, string $name): array => [
                        'name' => $name,
                        'value' => $value,
                        'domain' => $domain,
                    ])
                    ->values(),
                'domain' => $domain,
            ]);
        })->name('api.hungu-cookies');
    });
});

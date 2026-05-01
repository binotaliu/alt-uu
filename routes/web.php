<?php

use App\Http\Controllers\Api\AppConfigController;
use App\Http\Controllers\Api\AppearanceController;
use App\Http\Controllers\Api\AttachmentDownloadStatusController;
use App\Http\Controllers\Api\BlockedUsersModerationController;
use App\Http\Controllers\Api\BlockUserModerationController;
use App\Http\Controllers\Api\ClearAttachmentDownloadsController;
use App\Http\Controllers\Api\CourseHomeworksController;
use App\Http\Controllers\Api\CourseLearningTimesController;
use App\Http\Controllers\Api\CourseNodeContentController;
use App\Http\Controllers\Api\CourseNodeResourcesController;
use App\Http\Controllers\Api\CoursePathController;
use App\Http\Controllers\Api\CourseSelfExamsController;
use App\Http\Controllers\Api\CourseTasksCountController;
use App\Http\Controllers\Api\DiscussBoardController;
use App\Http\Controllers\Api\DiscussNodeController;
use App\Http\Controllers\Api\DiscussPostController;
use App\Http\Controllers\Api\DiscussWhisperController;
use App\Http\Controllers\Api\LikeDiscussPostController;
use App\Http\Controllers\Api\ListCoursesController;
use App\Http\Controllers\Api\LiveSessionsTimezonePreferenceController;
use App\Http\Controllers\Api\MaterialContentProxyController;
use App\Http\Controllers\Api\MaterialPreferenceController;
use App\Http\Controllers\Api\NouToolsCourseInfoController;
use App\Http\Controllers\Api\NouToolsLiveSessionsController;
use App\Http\Controllers\Api\NouToolsPreferenceController;
use App\Http\Controllers\Api\NouToolsSchoolCalendarController;
use App\Http\Controllers\Api\OnboardingPreferenceController;
use App\Http\Controllers\Api\ParsedMaterialContentController;
use App\Http\Controllers\Api\PlaybackProgressController;
use App\Http\Controllers\Api\QueueAttachmentDownloadController;
use App\Http\Controllers\Api\ReportModerationController;
use App\Http\Controllers\Api\ScreenReaderPreferenceController;
use App\Http\Controllers\Api\SetDiscussForumReadController;
use App\Http\Controllers\Api\SyncModerationController;
use App\Http\Controllers\Api\UnlikeDiscussPostController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\BootstrapSessionController;
use App\Http\Controllers\StudyTimeController;
use App\Http\Middleware\EnsureHunguSession;
use App\Services\UUSessionStore;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Route;

Route::post('/login', [AuthController::class, 'store'])->name('login.store');
Route::post('/logout', [AuthController::class, 'destroy'])->name('logout');
Route::post('/api/auth/bootstrap-session', BootstrapSessionController::class)->name('api.auth.bootstrap-session');

Route::get('/api/config', AppConfigController::class)->name('api.config');

Route::get('/api/preferences/appearance', [AppearanceController::class, 'show'])
    ->name('api.preferences.appearance');
Route::post('/api/preferences/appearance', [AppearanceController::class, 'store'])
    ->name('api.preferences.appearance.store');
Route::get('/api/preferences/nou-tools', [NouToolsPreferenceController::class, 'show'])
    ->name('api.preferences.nou-tools');
Route::post('/api/preferences/nou-tools', [NouToolsPreferenceController::class, 'store'])
    ->name('api.preferences.nou-tools.store');
Route::get('/api/preferences/screen-reader-enhanced-support', [ScreenReaderPreferenceController::class, 'show'])
    ->name('api.preferences.screen-reader-enhanced-support');
Route::post('/api/preferences/screen-reader-enhanced-support', [ScreenReaderPreferenceController::class, 'store'])
    ->name('api.preferences.screen-reader-enhanced-support.store');
Route::get('/api/preferences/onboarding', [OnboardingPreferenceController::class, 'show'])
    ->name('api.preferences.onboarding');
Route::post('/api/preferences/onboarding', [OnboardingPreferenceController::class, 'store'])
    ->name('api.preferences.onboarding.store');

Route::prefix('api/moderation')->group(function (): void {
    Route::post('/sync', SyncModerationController::class)->name('api.moderation.sync');
    Route::post('/report', ReportModerationController::class)->name('api.moderation.report');
    Route::post('/block-user', [BlockUserModerationController::class, 'store'])->name('api.moderation.block-user');
    Route::delete('/block-user', [BlockUserModerationController::class, 'destroy'])->name('api.moderation.unblock-user');
    Route::get('/blocked-users', BlockedUsersModerationController::class)->name('api.moderation.blocked-users');
});

Route::get('/api/preferences/live-sessions-timezone', [LiveSessionsTimezonePreferenceController::class, 'show'])
    ->name('api.preferences.live-sessions-timezone');
Route::post('/api/preferences/live-sessions-timezone', [LiveSessionsTimezonePreferenceController::class, 'store'])
    ->name('api.preferences.live-sessions-timezone.store');

Route::middleware([EnsureHunguSession::class])->group(function (): void {
    Route::post('/study-time', [StudyTimeController::class, 'store'])->name('study-time.store');

    Route::prefix('materials')->group(function (): void {
        Route::get('content/parsed', ParsedMaterialContentController::class);
    });

    Route::get('material-proxy/{encodedUrl}', MaterialContentProxyController::class)
        ->where('encodedUrl', '[A-Za-z0-9_-]+')
        ->name('material.content');

    Route::prefix('api')->group(function (): void {
        Route::get('/courses', ListCoursesController::class)->name('api.courses.index');
        Route::get('/courses/tasks-count', CourseTasksCountController::class)->name('api.courses.tasks-count');
        Route::get('/courses/{cid}/path', CoursePathController::class)->name('api.courses.path');
        Route::get('/courses/{cid}/learning-times', CourseLearningTimesController::class)->name('api.courses.learning-times');
        Route::get('/courses/{cid}/homeworks', CourseHomeworksController::class)->name('api.courses.homeworks');
        Route::get('/courses/{cid}/self-exams', CourseSelfExamsController::class)->name('api.courses.self-exams');
        Route::get('/courses/{cid}/nou-tools-info', NouToolsCourseInfoController::class)
            ->name('api.courses.nou-tools-info');
        Route::get('/courses/{cid}/nodes/{scoid}/resources', CourseNodeResourcesController::class)->name('api.courses.node.resources');
        Route::get('/courses/{cid}/nodes/{scoid}/content', CourseNodeContentController::class)->name('api.courses.node.content');

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

        Route::post('/attachments/download-tasks', QueueAttachmentDownloadController::class)
            ->name('api.attachments.download-tasks.queue');
        Route::post('/attachments/download-tasks/cleanup', ClearAttachmentDownloadsController::class)
            ->name('api.attachments.download-tasks.cleanup');
        Route::get('/attachments/download-tasks/{taskId}', AttachmentDownloadStatusController::class)
            ->whereNumber('taskId')
            ->name('api.attachments.download-tasks.status');

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

// SPA catch-all: serve the app shell for all frontend routes (excluding /api paths)
Route::get('/login', static fn () => view('app'))->name('login');
Route::get('/auth/booting', static fn () => view('app'))->name('auth.booting');
Route::get('/{any}', static fn () => view('app'))->where('any', '^(?!api(/|$)).*')->name('spa');

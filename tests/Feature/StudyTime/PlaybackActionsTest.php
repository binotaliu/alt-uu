<?php

declare(strict_types=1);

use AltUU\Domains\StudyTime\Actions\GetLastSeenMaterial;
use AltUU\Domains\StudyTime\Actions\GetPlaybackProgress;
use AltUU\Domains\StudyTime\Actions\RecordStudyTime;
use App\Models\Account;
use App\Models\PlaybackProgress;
use App\Services\AccountActiveProfile;
use App\Services\UUSessionStore;
use Illuminate\Support\Facades\Date;
use Illuminate\Support\Facades\Http;
use Illuminate\Validation\ValidationException;
use Mockery as MockeryManager;

/**
 * @param  array<string, mixed>  $attributes
 */
function makePlaybackProgress(array $attributes): PlaybackProgress
{
    $updatedAt = $attributes['updated_at'] ?? null;
    unset($attributes['updated_at']);

    $progress = PlaybackProgress::query()->create($attributes);

    if ($updatedAt !== null) {
        PlaybackProgress::query()->whereKey($progress->id)->update(['updated_at' => $updatedAt]);
    }

    return $progress;
}

it('returns null when there is no playback progress for the activity', function () {
    $account = Account::factory()->create();
    app(AccountActiveProfile::class)->set($account->id);

    expect(app(GetPlaybackProgress::class)('1001', 'N-1'))->toBeNull();
});

it('returns the playback progress of the active account only', function () {
    $account = Account::factory()->create();
    $other = Account::factory()->create();
    app(AccountActiveProfile::class)->set($account->id);

    makePlaybackProgress([
        'account_id' => $account->id,
        'cid' => '1001',
        'activity_id' => 'N-1',
        'duration_seconds' => 120,
        'position_seconds' => 42.5,
        'media_duration_seconds' => 755.4,
        'hungu_upload_success' => true,
    ]);
    makePlaybackProgress([
        'account_id' => $other->id,
        'cid' => '1001',
        'activity_id' => 'N-1',
        'duration_seconds' => 999,
    ]);

    $progress = app(GetPlaybackProgress::class)('1001', 'N-1');

    expect($progress)->not->toBeNull()
        ->and($progress->cid)->toBe('1001')
        ->and($progress->activityId)->toBe('N-1')
        ->and($progress->studySeconds)->toBe(120)
        ->and($progress->positionSeconds)->toBe(42.5)
        ->and($progress->mediaDurationSeconds)->toBe(755.4)
        ->and($progress->hunguUploadSuccess)->toBeTrue()
        ->and($progress->updatedAt)->toBeString();
});

it('accepts an explicit account id for playback progress', function () {
    $active = Account::factory()->create();
    $other = Account::factory()->create();
    app(AccountActiveProfile::class)->set($active->id);

    makePlaybackProgress([
        'account_id' => $other->id,
        'cid' => '1001',
        'activity_id' => 'N-1',
        'duration_seconds' => 33,
    ]);

    expect(app(GetPlaybackProgress::class)('1001', 'N-1'))->toBeNull()
        ->and(app(GetPlaybackProgress::class)('1001', 'N-1', $other->id)?->studySeconds)->toBe(33);
});

it('returns an empty last seen material when nothing was played', function () {
    $account = Account::factory()->create();
    app(AccountActiveProfile::class)->set($account->id);

    $result = app(GetLastSeenMaterial::class)('1001');

    expect($result->activityId)->toBeNull()
        ->and($result->positionSeconds)->toBeNull()
        ->and($result->mediaDurationSeconds)->toBeNull();
});

it('returns the most recently updated activity of the course', function () {
    $account = Account::factory()->create();
    app(AccountActiveProfile::class)->set($account->id);

    makePlaybackProgress([
        'account_id' => $account->id,
        'cid' => '1001',
        'activity_id' => 'N-old',
        'updated_at' => Date::now()->subDay(),
    ]);
    makePlaybackProgress([
        'account_id' => $account->id,
        'cid' => '1001',
        'activity_id' => 'N-new',
        'position_seconds' => 12.5,
        'media_duration_seconds' => 300.0,
        'updated_at' => Date::now(),
    ]);
    makePlaybackProgress([
        'account_id' => $account->id,
        'cid' => '2002',
        'activity_id' => 'N-other-course',
        'updated_at' => Date::now()->addDay(),
    ]);

    $result = app(GetLastSeenMaterial::class)('1001');

    expect($result->activityId)->toBe('N-new')
        ->and($result->positionSeconds)->toBe(12.5)
        ->and($result->mediaDurationSeconds)->toBe(300.0);
});

function fakeStudyTimeUpstream(): void
{
    Http::fake([
        'https://uu.nou.edu.tw/xmlapi/index.php?action=get-server-time*' => Http::response([
            'code' => 0,
            'message' => 'success',
            'data' => ['server_time' => '2026-03-14 10:00:00'],
        ]),
        'https://uu.nou.edu.tw/xmlapi/index.php?action=set-read-node-history*' => Http::response([
            'code' => 0,
            'message' => 'success',
            'data' => ['seconds' => 120],
        ]),
    ]);

    $sessionStore = MockeryManager::mock(UUSessionStore::class);
    $sessionStore->shouldReceive('get')->andReturn([
        'base_url' => 'https://uu.nou.edu.tw',
        'ua' => 'test-agent',
        'ticket' => 'ticket-1',
        'session_idx' => 'idx-1',
        'cookies' => ['WM' => 'cookie'],
        'profile' => ['display_name' => '測試', 'username' => 's123'],
    ]);
    $sessionStore->shouldReceive('put');
    app()->instance(UUSessionStore::class, $sessionStore);
}

it('records study time from a plain array, accepting snake_case aliases', function () {
    $account = Account::factory()->create();
    app(AccountActiveProfile::class)->set($account->id);
    fakeStudyTimeUpstream();

    $result = app(RecordStudyTime::class)([
        'cid' => '1001',
        'activity_id' => 'N-1',
        'url' => 'https://uu.nou.edu.tw/material/lesson-1.html',
        'seconds' => 120,
        'position_seconds' => 42.5,
        'media_duration_seconds' => 755.4,
    ]);

    expect($result->viewModel->ok)->toBeTrue()
        ->and($result->viewModel->seconds)->toBe(120);

    $this->assertDatabaseHas('playback_progress', [
        'account_id' => $account->id,
        'cid' => '1001',
        'activity_id' => 'N-1',
        'duration_seconds' => 120,
        'position_seconds' => 42.5,
        'media_duration_seconds' => 755.4,
    ]);
});

it('validates the study time payload', function () {
    app(RecordStudyTime::class)(['cid' => '1001']);
})->throws(ValidationException::class);

function seedPlaybackHttpSession(Account $account): void
{
    app(AccountActiveProfile::class)->set($account->id);
    app(UUSessionStore::class)->put([
        'base_url' => 'https://uu.nou.edu.tw',
        'ua' => 'test-agent',
        'ticket' => 'ticket-1',
        'session_idx' => 'idx-1',
        'cookies' => ['WM' => 'cookie'],
        'profile' => ['display_name' => '測試', 'username' => 's123', 'picture' => '', 'realname' => '測試'],
    ], $account->id);
}

it('keeps the playback progress api response shape', function () {
    $account = Account::factory()->create();
    seedPlaybackHttpSession($account);
    makePlaybackProgress([
        'account_id' => $account->id,
        'cid' => '1001',
        'activity_id' => 'N-1',
        'duration_seconds' => 120,
        'position_seconds' => 42.5,
        'media_duration_seconds' => 755.4,
        'hungu_upload_success' => true,
    ]);

    $this->withCookie(config('hungu.app_boot_cookie_name'), '1')
        ->getJson('/api/playback-progress/1001/N-1')
        ->assertSuccessful()
        ->assertJsonPath('progress.cid', '1001')
        ->assertJsonPath('progress.activityId', 'N-1')
        ->assertJsonPath('progress.studySeconds', 120)
        ->assertJsonPath('progress.positionSeconds', 42.5)
        ->assertJsonPath('progress.mediaDurationSeconds', 755.4)
        ->assertJsonPath('progress.hunguUploadSuccess', true)
        ->assertJsonStructure(['progress' => ['updatedAt']]);

    $this->withCookie(config('hungu.app_boot_cookie_name'), '1')
        ->getJson('/api/playback-progress/1001/N-missing')
        ->assertSuccessful()
        ->assertExactJson(['progress' => null]);
});

it('keeps the last seen material api response shape', function () {
    $account = Account::factory()->create();
    seedPlaybackHttpSession($account);
    makePlaybackProgress([
        'account_id' => $account->id,
        'cid' => '1001',
        'activity_id' => 'N-2',
        'position_seconds' => 12.5,
        'media_duration_seconds' => 300.0,
    ]);

    $this->withCookie(config('hungu.app_boot_cookie_name'), '1')
        ->getJson('/api/courses/1001/last-seen-material')
        ->assertSuccessful()
        ->assertExactJson(['activityId' => 'N-2', 'positionSeconds' => 12.5, 'mediaDurationSeconds' => 300.0]);

    $this->withCookie(config('hungu.app_boot_cookie_name'), '1')
        ->getJson('/api/courses/9999/last-seen-material')
        ->assertSuccessful()
        ->assertExactJson(['activityId' => null, 'positionSeconds' => null, 'mediaDurationSeconds' => null]);
});

<?php

use App\Jobs\DownloadAttachmentJob;
use App\Models\AttachmentDownload;
use App\Services\UUSessionStore;
use Illuminate\Support\Facades\Date;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Mockery as MockeryManager;

use function Pest\Laravel\assertDatabaseHas;
use function Pest\Laravel\withCookie;

function fakeHunguSessionStore(): void
{
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

it('queues an attachment download task', function () {
    Queue::fake();

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

    $response = withCookie(config('hungu.app_boot_cookie_name'), '1')
        ->postJson('/api/attachments/download-tasks', [
            'cid' => '1001',
            'sourceUrl' => 'https://uu.nou.edu.tw/learn/attachment/sample.pdf',
            'filename' => 'sample.pdf',
        ]);

    $response->assertSuccessful();
    $response->assertJsonPath('status', AttachmentDownload::STATUS_QUEUED);
    $response->assertJsonPath('fileName', 'sample.pdf');

    assertDatabaseHas('attachment_downloads', [
        'cid' => '1001',
        'source_url' => 'https://uu.nou.edu.tw/learn/attachment/sample.pdf',
        'file_name' => 'sample.pdf',
        'status' => AttachmentDownload::STATUS_QUEUED,
    ]);

    Queue::assertPushed(DownloadAttachmentJob::class, 1);
});

it('rejects attachment download task for an external host', function () {
    Queue::fake();

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

    $response = withCookie(config('hungu.app_boot_cookie_name'), '1')
        ->postJson('/api/attachments/download-tasks', [
            'cid' => '1001',
            'sourceUrl' => 'https://example.com/evil.pdf',
        ]);

    $response->assertForbidden();
    Queue::assertNothingPushed();
});

it('returns attachment download task status', function () {
    fakeHunguSessionStore();

    $task = AttachmentDownload::query()->create([
        'cid' => '1001',
        'source_url' => 'https://uu.nou.edu.tw/learn/attachment/sample.pdf',
        'file_name' => 'sample.pdf',
        'status' => AttachmentDownload::STATUS_COMPLETED,
        'relative_path' => 'attachment-downloads/1/sample.pdf',
        'mime_type' => 'application/pdf',
        'file_size' => 1024,
    ]);

    $response = withCookie(config('hungu.app_boot_cookie_name'), '1')
        ->getJson('/api/attachments/download-tasks/'.$task->id);

    $response->assertSuccessful();
    $response->assertJsonPath('taskId', $task->id);
    $response->assertJsonPath('status', AttachmentDownload::STATUS_COMPLETED);
    $response->assertJsonPath('localFilePath', storage_path('app/private/attachment-downloads/1/sample.pdf'));
});

it('clears downloaded attachments by endpoint', function () {
    Storage::fake('local');
    fakeHunguSessionStore();

    Storage::disk('local')->put('attachment-downloads/11/old-a.pdf', 'a');
    Storage::disk('local')->put('attachment-downloads/12/old-b.pdf', 'b');

    $firstTask = AttachmentDownload::query()->create([
        'cid' => '1001',
        'source_url' => 'https://uu.nou.edu.tw/learn/attachment/old-a.pdf',
        'file_name' => 'old-a.pdf',
        'status' => AttachmentDownload::STATUS_COMPLETED,
        'relative_path' => 'attachment-downloads/11/old-a.pdf',
        'mime_type' => 'application/pdf',
        'file_size' => 1,
        'expires_at' => Date::now()->subDay(),
    ]);

    $secondTask = AttachmentDownload::query()->create([
        'cid' => '1002',
        'source_url' => 'https://uu.nou.edu.tw/learn/attachment/old-b.pdf',
        'file_name' => 'old-b.pdf',
        'status' => AttachmentDownload::STATUS_COMPLETED,
        'relative_path' => 'attachment-downloads/12/old-b.pdf',
        'mime_type' => 'application/pdf',
        'file_size' => 1,
        'expires_at' => Date::now()->addDay(),
    ]);

    $response = withCookie(config('hungu.app_boot_cookie_name'), '1')
        ->postJson('/api/attachments/download-tasks/cleanup');

    $response->assertSuccessful();
    $response->assertJsonPath('ok', true);
    $response->assertJsonPath('clearedTasks', 2);
    $response->assertJsonPath('deletedFiles', 2);

    expect(Storage::disk('local')->exists('attachment-downloads/11/old-a.pdf'))->toBeFalse();
    expect(Storage::disk('local')->exists('attachment-downloads/12/old-b.pdf'))->toBeFalse();

    expect($firstTask->refresh()->relative_path)->toBeNull();
    expect($secondTask->refresh()->relative_path)->toBeNull();
});

it('prunes expired downloaded attachments before queueing a new task', function () {
    Queue::fake();
    Storage::fake('local');
    fakeHunguSessionStore();

    Storage::disk('local')->put('attachment-downloads/20/expired.pdf', 'expired');

    $expiredTask = AttachmentDownload::query()->create([
        'cid' => '1001',
        'source_url' => 'https://uu.nou.edu.tw/learn/attachment/expired.pdf',
        'file_name' => 'expired.pdf',
        'status' => AttachmentDownload::STATUS_COMPLETED,
        'relative_path' => 'attachment-downloads/20/expired.pdf',
        'mime_type' => 'application/pdf',
        'file_size' => 7,
        'expires_at' => Date::now()->subHour(),
    ]);

    $response = withCookie(config('hungu.app_boot_cookie_name'), '1')
        ->postJson('/api/attachments/download-tasks', [
            'cid' => '1001',
            'sourceUrl' => 'https://uu.nou.edu.tw/learn/attachment/new.pdf',
            'filename' => 'new.pdf',
        ]);

    $response->assertSuccessful();

    expect(Storage::disk('local')->exists('attachment-downloads/20/expired.pdf'))->toBeFalse();
    expect($expiredTask->refresh()->relative_path)->toBeNull();
});

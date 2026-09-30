<?php

declare(strict_types=1);

use App\Models\AttachmentDownload;
use App\NativeComponents\Support\AttachmentKind;
use Illuminate\Support\Facades\Queue;
use Tests\Feature\Native\Fixtures\AccountSeeding;
use Tests\Feature\Native\Fixtures\RecordingHost;

beforeEach(function (): void {
    Queue::fake();
    AccountSeeding::activate(AccountSeeding::seed('s1111111'));
});

it('detects images by filename then by URL extension', function (): void {
    expect(AttachmentKind::isImage('photo.JPG'))->toBeTrue()
        ->and(AttachmentKind::isImage(null, 'https://x/y/pic.png?token=1'))->toBeTrue()
        ->and(AttachmentKind::isImage('notes.pdf', 'https://x/pic.png'))->toBeFalse()
        ->and(AttachmentKind::isImage(null, null))->toBeFalse();
});

it('shows the file name', function (): void {
    RecordingHost::mountView('attachment-row')->assertSee('講義.pdf');
});

it('queues a download, polls it and opens the finished file', function (): void {
    $host = RecordingHost::mountView('attachment-row')
        ->tap('attachment')
        ->assertSee('正在下載附件，請稍候…');

    $task = AttachmentDownload::query()->firstOrFail();
    expect($task->source_url)->toBe('https://uu.nou.edu.tw/file/1.pdf')
        ->and($task->cid)->toBe('C1')
        ->and($task->file_name)->toBe('講義.pdf');

    $task->update([
        'status' => AttachmentDownload::STATUS_COMPLETED,
        'relative_path' => 'attachments/1.pdf',
        'mime_type' => 'application/pdf',
    ]);

    $host->bridge()->respondTo('AttachmentBridge.OpenLocalFile', ['status' => 'success', 'data' => ['opened' => true]]);
    $host->firePolls();

    $host->assertNativeCalled('AttachmentBridge.OpenLocalFile', fn (array $params): bool => str_ends_with($params['path'], 'attachments/1.pdf')
        && $params['mimeType'] === 'application/pdf')
        ->assertDontSee('正在下載附件，請稍候…');

    expect($host->get('events'))->toBe([['opened']]);
});

it('falls back to the system browser when the local file cannot be opened', function (): void {
    $host = RecordingHost::mountView('attachment-row')->tap('attachment');

    AttachmentDownload::query()->firstOrFail()->update([
        'status' => AttachmentDownload::STATUS_COMPLETED,
        'relative_path' => 'attachments/1.pdf',
    ]);

    $host->bridge()->respondTo('AttachmentBridge.OpenLocalFile', ['status' => 'error', 'message' => 'no viewer']);
    $host->firePolls();

    $host->assertNativeCalled('Browser.Open', fn (array $params): bool => $params['url'] === 'https://uu.nou.edu.tw/file/1.pdf');
});

it('shows the failure message and emits failed', function (): void {
    $host = RecordingHost::mountView('attachment-row')->tap('attachment');

    AttachmentDownload::query()->firstOrFail()->update([
        'status' => AttachmentDownload::STATUS_FAILED,
        'error_message' => '檔案已過期',
    ]);

    $host->firePolls()->assertSee('檔案已過期');

    expect($host->get('events'))->toBe([['failed', '檔案已過期']]);

    $host->tap('dismiss-error')->assertDontSee('檔案已過期');
});

it('asks for confirmation before downloading when requested', function (): void {
    $host = RecordingHost::mountView('attachment-row', ['confirm' => true])
        ->tap('attachment')
        ->assertSee('確定要下載並開啟「講義.pdf」嗎？');

    expect(AttachmentDownload::query()->count())->toBe(0);

    $host->tap('download-confirm');

    expect(AttachmentDownload::query()->count())->toBe(1);
});

it('does nothing when the confirmation is cancelled', function (): void {
    RecordingHost::mountView('attachment-row', ['confirm' => true])->tap('attachment')->tap('download-cancel');

    expect(AttachmentDownload::query()->count())->toBe(0);
});

it('does not start a second download while one is running', function (): void {
    RecordingHost::mountView('attachment-row')->tap('attachment')->tap('attachment');

    expect(AttachmentDownload::query()->count())->toBe(1);
});

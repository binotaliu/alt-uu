<?php

declare(strict_types=1);

namespace App\NativeComponents\Shared;

use AltUU\Domains\AttachmentDownload\Actions\CleanupAttachmentDownloads;
use AltUU\Domains\AttachmentDownload\Actions\GetAttachmentDownloadStatus;
use AltUU\Domains\AttachmentDownload\Actions\QueueAttachmentDownload;
use AltUU\Domains\AttachmentDownload\DataTransferObjects\QueueAttachmentDownloadInputData;
use AltUU\Domains\AttachmentDownload\ViewModels\AttachmentDownloadTaskViewModel;
use Illuminate\View\View;
use Native\Mobile\Edge\NativeComponent;
use Native\Mobile\Facades\Browser;
use Throwable;

/**
 * Downloadable attachment line shared by discussion posts and homework
 * (download flow of DiscussThread.vue and CourseHomeworkTab.vue).
 *
 * Tag: `<native:attachment-row key="attachment-{{ $post->id }}-{{ $i }}" cid="{{ $cid }}" :filename="$a->filename" :href="$a->href" source="hungu" :confirm="true" />`
 *
 * Props: `cid`, `filename`, `href` (source URL on the school host), `source`
 * (`hungu` default or `school_portal`), `confirm` (ask 確認下載 in a sheet
 * before starting; the discussion thread does, homework does not),
 * `downloadFilename` (optional override sent to the queue, e.g. `x.pdf`),
 * `refPrefix` (prefix of every ref incl. the confirm sheet's `{prefix}download-confirm`;
 * set a unique one on each row that uses `confirm` when several share a screen).
 * Events: `opened` (local file handed to the OS viewer), `failed` (message).
 *
 * Flow: confirm (optional) -> QueueAttachmentDownload -> the row polls the task
 * once per second while `working` (via native:poll in the view, the status is
 * read in render()) -> completed: opens the local file through
 * `AttachmentBridge.OpenLocalFile`, falling back to the system browser when
 * that fails -> failed / timeout (120 s): shows the error under the row.
 * Only one download runs per row. Nothing is required from the host.
 */
final class AttachmentRow extends NativeComponent
{
    private const int TIMEOUT_SECONDS = 120;

    public string $cid = '';

    public string $filename = '';

    public ?string $href = null;

    public string $source = 'hungu';

    public bool $confirm = false;

    public string $downloadFilename = '';

    public string $refPrefix = '';

    public bool $confirming = false;

    public bool $working = false;

    public string $errorMessage = '';

    public ?int $taskId = null;

    private int $startedAt = 0;

    public function tapRow(): void
    {
        if ($this->working || $this->href === null || $this->href === '') {
            return;
        }

        $this->errorMessage = '';

        if ($this->confirm) {
            $this->confirming = true;

            return;
        }

        $this->startDownload();
    }

    public function confirmDownload(): void
    {
        $this->confirming = false;
        $this->startDownload();
    }

    public function cancelConfirm(): void
    {
        $this->confirming = false;
    }

    public function dismissError(): void
    {
        $this->errorMessage = '';
    }

    public function render(): View
    {
        if ($this->working) {
            $this->pollTask();
        }

        return view('native.shared.attachment-row', [
            'displayName' => $this->filename !== '' ? $this->filename : '此附件',
        ]);
    }

    private function startDownload(): void
    {
        $this->working = true;
        $this->startedAt = time();

        try {
            $task = app(QueueAttachmentDownload::class)(
                new QueueAttachmentDownloadInputData(
                    cid: $this->cid,
                    sourceUrl: (string) $this->href,
                    filename: $this->downloadFilename !== '' ? $this->downloadFilename : ($this->filename !== '' ? $this->filename : null),
                    source: $this->source,
                ),
                app(CleanupAttachmentDownloads::class),
            );

            $this->taskId = $task->taskId;
        } catch (Throwable $exception) {
            $this->fail($exception->getMessage());
        }
    }

    private function pollTask(): void
    {
        if ($this->taskId === null) {
            return;
        }

        try {
            $task = app(GetAttachmentDownloadStatus::class)($this->taskId);
        } catch (Throwable) {
            $this->fail('');

            return;
        }

        if ($task->status === 'completed') {
            $this->finish($task);

            return;
        }

        if ($task->status === 'failed') {
            $this->fail((string) $task->errorMessage);

            return;
        }

        if (time() - $this->startedAt >= self::TIMEOUT_SECONDS) {
            $this->fail('附件下載逾時，請稍後再試。');
        }
    }

    private function finish(AttachmentDownloadTaskViewModel $task): void
    {
        $this->working = false;
        $this->taskId = null;

        if ($task->localFilePath !== null && $this->openLocalFile($task->localFilePath, $task->mimeType)) {
            $this->emit('opened');

            return;
        }

        if ($this->href !== null) {
            Browser::open($this->href);
        }
    }

    private function fail(string $message): void
    {
        $this->working = false;
        $this->taskId = null;
        $this->errorMessage = $message !== '' ? $message : '下載失敗，請稍後再試。';
        $this->emit('failed', $this->errorMessage);
    }

    /**
     * The attachment-bridge plugin exposes OpenLocalFile only as a bridge
     * function (its PHP facade has no wrapper for it yet).
     */
    private function openLocalFile(string $path, ?string $mimeType): bool
    {
        if (! function_exists('nativephp_call')) {
            return false;
        }

        $result = nativephp_call('AttachmentBridge.OpenLocalFile', json_encode([
            'path' => $path,
            'mimeType' => $mimeType,
        ]));

        if (! is_string($result) || $result === '') {
            return false;
        }

        $decoded = json_decode($result, true);

        return is_array($decoded) && ($decoded['status'] ?? null) !== 'error';
    }
}

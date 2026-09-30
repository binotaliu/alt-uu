<?php

declare(strict_types=1);

namespace App\NativeComponents\Courses\Discuss;

use AltUU\Domains\AttachmentDownload\Actions\CleanupAttachmentDownloads;
use AltUU\Domains\AttachmentDownload\Actions\GetAttachmentDownloadStatus;
use AltUU\Domains\AttachmentDownload\Actions\QueueAttachmentDownload;
use AltUU\Domains\AttachmentDownload\DataTransferObjects\QueueAttachmentDownloadInputData;
use Illuminate\View\View;
use Native\Mobile\Edge\NativeComponent;
use Throwable;

/**
 * Inline thumbnail of an image attachment of a discussion post.
 *
 * School images are behind the session cookies, so a plain `native:image` URL
 * cannot load them. The image goes through the same attachment download queue
 * as every other attachment; once the local file exists it is shown as a
 * thumbnail and tapping it emits `open-image` (local path, alt) for the
 * screen's fullscreen viewer. When the download fails the row degrades to the
 * regular download row (`native:attachment-row`), like the Vue page did when an
 * `<img>` errored.
 *
 * Tag: `<native:discuss-image-attachment key="image-{{ $node }}-{{ $i }}" cid="{{ $cid }}" :filename="$a->filename" :href="$a->href" @open-image="openImage" />`
 */
final class DiscussImageAttachment extends NativeComponent
{
    private const int TIMEOUT_SECONDS = 60;

    public string $cid = '';

    public ?string $filename = null;

    public ?string $href = null;

    /** loading | ready | failed */
    public string $state = 'loading';

    public ?int $taskId = null;

    public string $localPath = '';

    public int $startedAt = 0;

    public function mount(): void
    {
        $this->startedAt = time();

        try {
            $task = app(QueueAttachmentDownload::class)(
                new QueueAttachmentDownloadInputData(
                    cid: $this->cid,
                    sourceUrl: (string) $this->href,
                    filename: $this->filename,
                ),
                app(CleanupAttachmentDownloads::class),
            );

            $this->taskId = $task->taskId;
        } catch (Throwable $exception) {
            report($exception);
            $this->state = 'failed';
        }
    }

    public function open(): void
    {
        if ($this->state === 'ready') {
            $this->emit('open-image', $this->localPath, $this->altText());
        }
    }

    public function altText(): string
    {
        return $this->filename !== null && $this->filename !== '' ? $this->filename : '附件圖片';
    }

    public function render(): View
    {
        if ($this->state === 'loading') {
            $this->pollTask();
        }

        return view('native.courses.discuss.discuss-image-attachment');
    }

    private function pollTask(): void
    {
        if ($this->taskId === null) {
            return;
        }

        try {
            $task = app(GetAttachmentDownloadStatus::class)($this->taskId);
        } catch (Throwable) {
            $this->state = 'failed';

            return;
        }

        if ($task->status === 'completed' && $task->localFilePath !== null) {
            $this->localPath = $task->localFilePath;
            $this->state = 'ready';

            return;
        }

        if ($task->status === 'failed' || $task->status === 'completed' || time() - $this->startedAt >= self::TIMEOUT_SECONDS) {
            $this->state = 'failed';
        }
    }
}

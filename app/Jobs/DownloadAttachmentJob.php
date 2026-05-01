<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Models\AttachmentDownload;
use App\Services\UUProxyClient;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Date;
use Illuminate\Support\Str;
use Throwable;

final class DownloadAttachmentJob implements ShouldQueue
{
    use Queueable;

    public int $tries = 1;

    public int $timeout = 900;

    public function __construct(
        public readonly int $taskId,
    ) {}

    public function handle(UUProxyClient $proxyClient): void
    {
        $task = AttachmentDownload::query()->find($this->taskId);

        if (! $task instanceof AttachmentDownload) {
            return;
        }

        if (! in_array($task->status, [AttachmentDownload::STATUS_QUEUED, AttachmentDownload::STATUS_DOWNLOADING], true)) {
            return;
        }

        $task->forceFill([
            'status' => AttachmentDownload::STATUS_DOWNLOADING,
            'error_message' => null,
            'started_at' => Date::now(),
        ])->save();

        try {
            $safeFileName = $this->resolveSafeFileName($task->source_url, $task->file_name);
            $relativePath = sprintf('attachment-downloads/%d/%s', $task->id, $safeFileName);

            $downloadResult = $proxyClient->downloadMaterialContentToLocalDisk($task->source_url, $relativePath);

            $task->forceFill([
                'status' => AttachmentDownload::STATUS_COMPLETED,
                'relative_path' => $relativePath,
                'mime_type' => $downloadResult['mimeType'],
                'file_size' => $downloadResult['fileSize'],
                'completed_at' => Date::now(),
                'expires_at' => Date::now()->addDays(3),
            ])->save();
        } catch (Throwable $exception) {
            $task->forceFill([
                'status' => AttachmentDownload::STATUS_FAILED,
                'error_message' => Str::limit($exception->getMessage(), 2048),
                'completed_at' => Date::now(),
            ])->save();

            throw $exception;
        }
    }

    private function resolveSafeFileName(string $sourceUrl, ?string $preferredFileName): string
    {
        $candidate = trim((string) $preferredFileName);

        if ($candidate === '') {
            $path = (string) parse_url($sourceUrl, PHP_URL_PATH);
            $candidate = basename($path);
        }

        if ($candidate === '' || $candidate === '.' || $candidate === '/') {
            $candidate = 'download.bin';
        }

        $candidate = preg_replace('/[^\p{L}\p{N}._-]/u', '_', $candidate) ?: 'download.bin';

        return Str::limit($candidate, 200, '');
    }
}

<?php

declare(strict_types=1);

namespace AltUU\Domains\AttachmentDownload\Actions;

use AltUU\Domains\AttachmentDownload\DataTransferObjects\QueueAttachmentDownloadInputData;
use AltUU\Domains\AttachmentDownload\ViewModels\AttachmentDownloadTaskViewModel;
use App\Jobs\DownloadAttachmentJob;
use App\Models\AttachmentDownload;
use App\Services\UUCourseClient;

final class QueueAttachmentDownload
{
    public function __construct(private readonly UUCourseClient $courseClient) {}

    public function __invoke(
        QueueAttachmentDownloadInputData $input,
        CleanupAttachmentDownloads $cleanupAttachmentDownloads,
    ): AttachmentDownloadTaskViewModel {
        $baseHost = parse_url($this->resolveAllowedBaseUrl($input->source), PHP_URL_HOST);
        $urlHost = parse_url($input->sourceUrl, PHP_URL_HOST);

        if (! is_string($baseHost) || ! is_string($urlHost) || $baseHost !== $urlHost) {
            abort(403, '不允許存取外部資源');
        }

        // Proactively prune expired local files so mobile storage does not grow indefinitely.
        $cleanupAttachmentDownloads(onlyExpired: true);

        $task = AttachmentDownload::query()->create([
            'cid' => $input->cid,
            'source' => $input->source,
            'source_url' => $input->sourceUrl,
            'file_name' => $input->filename,
            'status' => AttachmentDownload::STATUS_QUEUED,
        ]);

        DownloadAttachmentJob::dispatch($task->id);

        return AttachmentDownloadTaskViewModel::fromModel($task);
    }

    private function resolveAllowedBaseUrl(string $source): string
    {
        if ($source === 'school_portal') {
            return (string) config('school_portal.base_url', '');
        }

        return $this->courseClient->currentBaseUrl();
    }
}

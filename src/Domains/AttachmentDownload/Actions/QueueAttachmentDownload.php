<?php

declare(strict_types=1);

namespace AltUU\Domains\AttachmentDownload\Actions;

use AltUU\Domains\AttachmentDownload\DataTransferObjects\QueueAttachmentDownloadInputData;
use AltUU\Domains\AttachmentDownload\ViewModels\AttachmentDownloadTaskViewModel;
use App\Jobs\DownloadAttachmentJob;
use App\Models\AttachmentDownload;
use Illuminate\Http\Request;

final class QueueAttachmentDownload
{
    public function __invoke(
        Request $request,
        QueueAttachmentDownloadInputData $input,
        CleanupAttachmentDownloads $cleanupAttachmentDownloads,
    ): AttachmentDownloadTaskViewModel {
        $session = $request->hunguSession();
        $baseHost = parse_url((string) ($session['base_url'] ?? ''), PHP_URL_HOST);
        $urlHost = parse_url($input->sourceUrl, PHP_URL_HOST);

        if (! is_string($baseHost) || ! is_string($urlHost) || $baseHost !== $urlHost) {
            abort(403, '不允許存取外部資源');
        }

        // Proactively prune expired local files so mobile storage does not grow indefinitely.
        $cleanupAttachmentDownloads(onlyExpired: true);

        $task = AttachmentDownload::query()->create([
            'cid' => $input->cid,
            'source_url' => $input->sourceUrl,
            'file_name' => $input->filename,
            'status' => AttachmentDownload::STATUS_QUEUED,
        ]);

        DownloadAttachmentJob::dispatch($task->id);

        return AttachmentDownloadTaskViewModel::fromModel($task);
    }
}

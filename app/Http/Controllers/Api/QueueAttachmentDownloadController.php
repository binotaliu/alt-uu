<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use AltUU\Domains\AttachmentDownload\Actions\CleanupAttachmentDownloads;
use AltUU\Domains\AttachmentDownload\Actions\QueueAttachmentDownload;
use AltUU\Domains\AttachmentDownload\DataTransferObjects\QueueAttachmentDownloadInputData;
use AltUU\Domains\AttachmentDownload\ViewModels\AttachmentDownloadTaskViewModel;
use Illuminate\Http\Request;

final class QueueAttachmentDownloadController
{
    public function __invoke(
        Request $request,
        QueueAttachmentDownloadInputData $input,
        QueueAttachmentDownload $queueAttachmentDownload,
        CleanupAttachmentDownloads $cleanupAttachmentDownloads,
    ): AttachmentDownloadTaskViewModel {
        return $queueAttachmentDownload($request, $input, $cleanupAttachmentDownloads);
    }
}

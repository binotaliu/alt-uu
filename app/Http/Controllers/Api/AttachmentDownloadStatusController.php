<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use AltUU\Domains\AttachmentDownload\Actions\GetAttachmentDownloadStatus;
use AltUU\Domains\AttachmentDownload\ViewModels\AttachmentDownloadTaskViewModel;

final class AttachmentDownloadStatusController
{
    public function __invoke(
        int $taskId,
        GetAttachmentDownloadStatus $getAttachmentDownloadStatus,
    ): AttachmentDownloadTaskViewModel {
        return $getAttachmentDownloadStatus($taskId);
    }
}

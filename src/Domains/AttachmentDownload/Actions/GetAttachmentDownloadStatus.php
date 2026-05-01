<?php

declare(strict_types=1);

namespace AltUU\Domains\AttachmentDownload\Actions;

use AltUU\Domains\AttachmentDownload\ViewModels\AttachmentDownloadTaskViewModel;
use App\Models\AttachmentDownload;

final class GetAttachmentDownloadStatus
{
    public function __invoke(int $taskId): AttachmentDownloadTaskViewModel
    {
        $task = AttachmentDownload::query()->findOrFail($taskId);

        return AttachmentDownloadTaskViewModel::fromModel($task);
    }
}

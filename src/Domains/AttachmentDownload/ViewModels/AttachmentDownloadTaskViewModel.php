<?php

declare(strict_types=1);

namespace AltUU\Domains\AttachmentDownload\ViewModels;

use App\Models\AttachmentDownload;
use Spatie\LaravelData\Resource;
use Spatie\TypeScriptTransformer\Attributes\TypeScript;

#[TypeScript]
final class AttachmentDownloadTaskViewModel extends Resource
{
    public function __construct(
        public int $taskId,
        public string $status,
        public ?string $fileName = null,
        public ?string $mimeType = null,
        public ?int $fileSize = null,
        public ?string $errorMessage = null,
        public ?string $localFilePath = null,
        public ?string $expiresAt = null,
    ) {}

    public static function fromModel(AttachmentDownload $task): self
    {
        return new self(
            taskId: $task->id,
            status: (string) $task->status,
            fileName: $task->file_name,
            mimeType: $task->mime_type,
            fileSize: $task->file_size,
            errorMessage: $task->error_message,
            localFilePath: $task->relative_path !== null
                ? storage_path('app/private/'.$task->relative_path)
                : null,
            expiresAt: $task->expires_at?->toIso8601String(),
        );
    }
}

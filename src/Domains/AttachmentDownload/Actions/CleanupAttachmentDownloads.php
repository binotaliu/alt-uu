<?php

declare(strict_types=1);

namespace AltUU\Domains\AttachmentDownload\Actions;

use App\Models\AttachmentDownload;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Date;
use Illuminate\Support\Facades\Storage;

final class CleanupAttachmentDownloads
{
    /**
     * @return array{clearedTasks: int, deletedFiles: int}
     */
    public function __invoke(bool $onlyExpired = false): array
    {
        $query = AttachmentDownload::query()
            ->where('status', AttachmentDownload::STATUS_COMPLETED)
            ->whereNotNull('relative_path');

        if ($onlyExpired) {
            $query->whereNotNull('expires_at')
                ->where('expires_at', '<=', Date::now());
        }

        /** @var Collection<int, AttachmentDownload> $tasks */
        $tasks = $query->get();

        if ($tasks->isEmpty()) {
            return [
                'clearedTasks' => 0,
                'deletedFiles' => 0,
            ];
        }

        $paths = $tasks->pluck('relative_path')
            ->filter(fn (?string $path): bool => is_string($path) && $path !== '')
            ->unique()
            ->values();

        $disk = Storage::disk('local');
        $deletedFiles = 0;

        foreach ($paths as $path) {
            if (! is_string($path) || ! $disk->exists($path)) {
                continue;
            }

            if ($disk->delete($path)) {
                $deletedFiles++;
            }
        }

        foreach ($tasks as $task) {
            $task->forceFill([
                'relative_path' => null,
                'mime_type' => null,
                'file_size' => null,
                'expires_at' => null,
            ])->save();
        }

        return [
            'clearedTasks' => $tasks->count(),
            'deletedFiles' => $deletedFiles,
        ];
    }
}

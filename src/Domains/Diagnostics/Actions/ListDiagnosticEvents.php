<?php

declare(strict_types=1);

namespace AltUU\Domains\Diagnostics\Actions;

use AltUU\Domains\Diagnostics\ViewModels\DiagnosticEventListViewModel;
use AltUU\Domains\Diagnostics\ViewModels\DiagnosticEventViewModel;
use App\Models\DiagnosticEvent;
use App\Services\Diagnostics\DiagnosticRecorder;

final readonly class ListDiagnosticEvents
{
    private const DEFAULT_LIMIT = 200;

    public function __construct(private DiagnosticRecorder $recorder) {}

    public function __invoke(bool $problemsOnly = false, int $limit = self::DEFAULT_LIMIT): DiagnosticEventListViewModel
    {
        // With recording normally off, reading the log is the main moment
        // anything aged out gets dropped.
        $this->recorder->pruneExpired();

        $query = DiagnosticEvent::query()->orderByDesc('id');

        if ($problemsOnly) {
            $query->problems();
        }

        $events = $query
            ->limit(max(1, min($limit, self::DEFAULT_LIMIT)))
            ->get()
            ->map(DiagnosticEventViewModel::fromModel(...))
            ->all();

        return new DiagnosticEventListViewModel(
            events: $events,
            total: DiagnosticEvent::query()->count(),
            recordingEnabled: $this->recorder->recordingExpiresAt() !== null,
        );
    }
}

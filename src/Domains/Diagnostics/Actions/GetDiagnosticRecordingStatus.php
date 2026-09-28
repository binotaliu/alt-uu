<?php

declare(strict_types=1);

namespace AltUU\Domains\Diagnostics\Actions;

use AltUU\Domains\Diagnostics\ViewModels\DiagnosticRecordingStatusViewModel;
use App\Services\Diagnostics\DiagnosticRecorder;
use DateTimeInterface;
use Illuminate\Contracts\Config\Repository as ConfigRepository;

final readonly class GetDiagnosticRecordingStatus
{
    public function __construct(
        private DiagnosticRecorder $recorder,
        private ConfigRepository $config,
    ) {}

    public function __invoke(): DiagnosticRecordingStatusViewModel
    {
        $expiresAt = $this->recorder->recordingExpiresAt();

        return new DiagnosticRecordingStatusViewModel(
            available: $this->recorder->isAvailable(),
            recording: $expiresAt !== null,
            expiresAt: $expiresAt?->format(DateTimeInterface::ATOM),
            windowMinutes: (int) $this->config->get('diagnostics.recording_window_minutes', 30),
            retentionDays: (int) $this->config->get('diagnostics.retention_days', 14),
        );
    }
}

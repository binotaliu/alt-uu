<?php

declare(strict_types=1);

namespace AltUU\Domains\Diagnostics\Actions;

use AltUU\Domains\Diagnostics\DataTransferObjects\SetDiagnosticRecordingInputData;
use AltUU\Domains\Diagnostics\ViewModels\DiagnosticRecordingStatusViewModel;
use App\Services\Diagnostics\DiagnosticRecorder;

final readonly class SetDiagnosticRecording
{
    public function __construct(
        private DiagnosticRecorder $recorder,
        private GetDiagnosticRecordingStatus $getStatus,
    ) {}

    public function __invoke(SetDiagnosticRecordingInputData $input): DiagnosticRecordingStatusViewModel
    {
        $this->recorder->setRecording($input->enabled);

        return ($this->getStatus)();
    }
}

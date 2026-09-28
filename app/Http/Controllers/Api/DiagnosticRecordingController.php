<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use AltUU\Domains\Diagnostics\Actions\GetDiagnosticRecordingStatus;
use AltUU\Domains\Diagnostics\Actions\SetDiagnosticRecording;
use AltUU\Domains\Diagnostics\DataTransferObjects\SetDiagnosticRecordingInputData;
use AltUU\Domains\Diagnostics\ViewModels\DiagnosticRecordingStatusViewModel;

final class DiagnosticRecordingController
{
    public function show(GetDiagnosticRecordingStatus $getStatus): DiagnosticRecordingStatusViewModel
    {
        return $getStatus();
    }

    public function update(
        SetDiagnosticRecordingInputData $input,
        SetDiagnosticRecording $setDiagnosticRecording,
    ): DiagnosticRecordingStatusViewModel {
        return $setDiagnosticRecording($input);
    }
}

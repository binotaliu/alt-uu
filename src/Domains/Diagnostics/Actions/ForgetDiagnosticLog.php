<?php

declare(strict_types=1);

namespace AltUU\Domains\Diagnostics\Actions;

use App\Services\Diagnostics\DiagnosticRecorder;

/**
 * Discards the diagnostic log when the user steps away from the device.
 *
 * The log holds no credentials — everything is redacted on write — but it
 * does hold a request history: which courses were opened, and when. That
 * should not follow the device to whoever uses it next.
 *
 * Closing the recording window matters more than clearing the rows. A window
 * left open keeps capturing for its full 30 minutes, so logging out with
 * recording on would otherwise record the next person's activity.
 */
final readonly class ForgetDiagnosticLog
{
    public function __construct(private DiagnosticRecorder $recorder) {}

    public function __invoke(bool $stopRecording = false): void
    {
        if ($stopRecording) {
            $this->recorder->setRecording(false);
        }

        $this->recorder->clear();
    }
}

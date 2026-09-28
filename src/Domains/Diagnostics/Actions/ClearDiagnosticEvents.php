<?php

declare(strict_types=1);

namespace AltUU\Domains\Diagnostics\Actions;

use App\Services\Diagnostics\DiagnosticRecorder;

final readonly class ClearDiagnosticEvents
{
    public function __construct(private DiagnosticRecorder $recorder) {}

    public function __invoke(): void
    {
        $this->recorder->clear();
    }
}

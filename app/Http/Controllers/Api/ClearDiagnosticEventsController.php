<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use AltUU\Domains\Diagnostics\Actions\ClearDiagnosticEvents;
use Illuminate\Http\JsonResponse;

final class ClearDiagnosticEventsController
{
    public function __invoke(ClearDiagnosticEvents $clearDiagnosticEvents): JsonResponse
    {
        $clearDiagnosticEvents();

        return response()->json(['ok' => true]);
    }
}

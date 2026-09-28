<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use AltUU\Domains\Diagnostics\Actions\StoreClientDiagnosticEvents;
use AltUU\Domains\Diagnostics\DataTransferObjects\ClientDiagnosticEventsInputData;
use Illuminate\Http\JsonResponse;

final class StoreClientDiagnosticEventsController
{
    public function __invoke(
        ClientDiagnosticEventsInputData $input,
        StoreClientDiagnosticEvents $storeClientDiagnosticEvents,
    ): JsonResponse {
        return response()->json([
            'ok' => true,
            'stored' => $storeClientDiagnosticEvents($input),
        ]);
    }
}

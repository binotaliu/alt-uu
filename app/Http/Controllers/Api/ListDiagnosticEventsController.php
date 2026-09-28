<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use AltUU\Domains\Diagnostics\Actions\ListDiagnosticEvents;
use AltUU\Domains\Diagnostics\ViewModels\DiagnosticEventListViewModel;
use Illuminate\Http\Request;

final class ListDiagnosticEventsController
{
    public function __invoke(Request $request, ListDiagnosticEvents $listDiagnosticEvents): DiagnosticEventListViewModel
    {
        return $listDiagnosticEvents(
            problemsOnly: $request->boolean('problemsOnly'),
        );
    }
}

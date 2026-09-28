<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use AltUU\Domains\DataPortability\Actions\ExportAccountData;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Date;

final class DataExportController
{
    public function __invoke(ExportAccountData $exportAccountData): JsonResponse
    {
        $filename = 'alt-uu-data-export-'.Date::now()->format('Y-m-d').'.json';

        return response()->json($exportAccountData())
            ->header('Content-Disposition', 'attachment; filename="'.$filename.'"');
    }
}

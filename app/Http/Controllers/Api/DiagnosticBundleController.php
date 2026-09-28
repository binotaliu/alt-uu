<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use AltUU\Domains\Diagnostics\Actions\BuildDiagnosticBundle;
use Illuminate\Http\Response;

final class DiagnosticBundleController
{
    public function __invoke(BuildDiagnosticBundle $buildDiagnosticBundle): Response
    {
        $bundle = $buildDiagnosticBundle();

        // Served as an attachment so the native attachment bridge can hand it
        // to the platform save/share sheet, exactly as the data export does.
        return response($bundle->content, 200, [
            'Content-Type' => 'text/markdown; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="'.$bundle->filename.'"',
        ]);
    }
}

<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use AltUU\Domains\Course\Actions\SyncCurrentCourse;
use AltUU\Domains\Diagnostics\Actions\InspectMaterialSource;
use AltUU\Domains\Diagnostics\ViewModels\MaterialSourceInspectionViewModel;
use Illuminate\Http\Request;

final class MaterialSourceInspectionController
{
    public function __invoke(
        Request $request,
        string $cid,
        string $scoid,
        InspectMaterialSource $inspect,
        SyncCurrentCourse $syncCourse,
    ): MaterialSourceInspectionViewModel {
        $syncCourse($request, $cid);

        $session = $request->hunguSession();
        $baseHost = parse_url((string) ($session['base_url'] ?? ''), PHP_URL_HOST);

        if (! is_string($baseHost) || $baseHost === '') {
            abort(403, '不允許存取外部資源');
        }

        return $inspect($cid, $scoid, $baseHost);
    }
}

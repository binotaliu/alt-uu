<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use AltUU\Domains\Course\Actions\SyncCurrentCourse;
use AltUU\Domains\Diagnostics\Actions\InspectMaterialDirectory;
use AltUU\Domains\Diagnostics\ViewModels\MaterialDirectoryInspectionViewModel;
use Illuminate\Http\Request;

final class MaterialDirectoryInspectionController
{
    public function __invoke(
        Request $request,
        string $cid,
        InspectMaterialDirectory $inspect,
        SyncCurrentCourse $syncCourse,
    ): MaterialDirectoryInspectionViewModel {
        // The directory is only served for the course the school session is
        // currently "in", so this mirrors what CoursePathController does.
        $syncCourse($request, $cid);

        return $inspect($cid);
    }
}

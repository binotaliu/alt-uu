<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use AltUU\Domains\Course\Actions\SyncCurrentCourse;
use AltUU\Domains\Diagnostics\Actions\InspectMaterialDirectory;
use AltUU\Domains\Diagnostics\ViewModels\MaterialDirectoryInspectionViewModel;

final class MaterialDirectoryInspectionController
{
    public function __invoke(
        string $cid,
        InspectMaterialDirectory $inspect,
        SyncCurrentCourse $syncCourse,
    ): MaterialDirectoryInspectionViewModel {
        // The directory is only served for the course the school session is
        // currently "in", so this mirrors what CoursePathController does.
        $syncCourse($cid);

        return $inspect($cid);
    }
}

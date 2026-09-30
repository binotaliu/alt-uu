<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use AltUU\Domains\StudyTime\Actions\GetLastSeenMaterial;
use AltUU\Domains\StudyTime\ViewModels\LastSeenMaterialViewModel;

final class CourseLastSeenMaterialController
{
    public function __invoke(string $cid, GetLastSeenMaterial $getLastSeenMaterial): LastSeenMaterialViewModel
    {
        return $getLastSeenMaterial($cid);
    }
}

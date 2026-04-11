<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use AltUU\Domains\Course\Actions\GetNodeResources;
use AltUU\Domains\Course\ViewModels\CourseMaterialResourceViewModel;
use Illuminate\Http\Request;
use Spatie\LaravelData\DataCollection;

final class CourseNodeResourcesController
{
    /**
     * @return DataCollection<CourseMaterialResourceViewModel>
     */
    public function __invoke(
        Request $request,
        string $cid,
        string $scoid,
        GetNodeResources $getResources,
    ): DataCollection {
        return $getResources($request, $cid, $scoid);
    }
}

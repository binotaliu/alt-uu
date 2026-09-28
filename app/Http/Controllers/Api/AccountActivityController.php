<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use AltUU\Domains\Activity\Actions\GetActivityHeatmap;
use AltUU\Domains\Activity\ViewModels\ActivityHeatmapViewModel;
use Illuminate\Http\Request;

final class AccountActivityController
{
    public function __invoke(Request $request, GetActivityHeatmap $getActivityHeatmap): ActivityHeatmapViewModel
    {
        return $getActivityHeatmap($request->boolean('allAccounts'));
    }
}

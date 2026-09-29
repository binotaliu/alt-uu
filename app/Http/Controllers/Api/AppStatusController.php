<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use AltUU\Domains\AppStatus\Actions\DismissAppStatusItem;
use AltUU\Domains\AppStatus\Actions\GetAppStatus;
use AltUU\Domains\AppStatus\DataTransferObjects\DismissAppStatusItemInputData;
use AltUU\Domains\AppStatus\ViewModels\AppStatusViewModel;

final class AppStatusController
{
    public function show(GetAppStatus $getAppStatus): AppStatusViewModel
    {
        return $getAppStatus();
    }

    public function store(DismissAppStatusItemInputData $input, DismissAppStatusItem $dismissAppStatusItem): AppStatusViewModel
    {
        return $dismissAppStatusItem($input);
    }
}

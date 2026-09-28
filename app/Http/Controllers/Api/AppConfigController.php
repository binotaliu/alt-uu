<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use AltUU\Domains\AppConfig\Actions\GetAppConfig;
use AltUU\Domains\AppConfig\ViewModels\AppConfigViewModel;

final class AppConfigController
{
    public function __invoke(GetAppConfig $getAppConfig): AppConfigViewModel
    {
        return $getAppConfig();
    }
}

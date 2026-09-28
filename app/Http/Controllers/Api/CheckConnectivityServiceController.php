<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use AltUU\Domains\Diagnostics\Actions\RunConnectivityCheck;
use AltUU\Domains\Diagnostics\Enums\ConnectivityServiceEnum;
use AltUU\Domains\Diagnostics\ViewModels\ConnectivityCheckResultViewModel;

final class CheckConnectivityServiceController
{
    public function __invoke(RunConnectivityCheck $runConnectivityCheck, ConnectivityServiceEnum $service): ConnectivityCheckResultViewModel
    {
        return $runConnectivityCheck($service);
    }
}

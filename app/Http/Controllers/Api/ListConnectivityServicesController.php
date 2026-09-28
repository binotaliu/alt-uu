<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use AltUU\Domains\Diagnostics\Actions\ListConnectivityServices;
use AltUU\Domains\Diagnostics\ViewModels\ConnectivityServiceListViewModel;

final class ListConnectivityServicesController
{
    public function __invoke(ListConnectivityServices $listConnectivityServices): ConnectivityServiceListViewModel
    {
        return $listConnectivityServices();
    }
}

<?php

declare(strict_types=1);

namespace AltUU\Domains\Diagnostics\Actions;

use AltUU\Domains\Diagnostics\Enums\ConnectivityServiceEnum;
use AltUU\Domains\Diagnostics\ViewModels\ConnectivityServiceListViewModel;
use AltUU\Domains\Diagnostics\ViewModels\ConnectivityServiceViewModel;

final readonly class ListConnectivityServices
{
    public function __invoke(): ConnectivityServiceListViewModel
    {
        $services = collect(ConnectivityServiceEnum::cases())
            ->map(fn (ConnectivityServiceEnum $service) => new ConnectivityServiceViewModel(
                service: $service,
                label: $service->label(),
                isReference: $service->isReference(),
            ))
            ->all();

        return new ConnectivityServiceListViewModel(services: $services);
    }
}

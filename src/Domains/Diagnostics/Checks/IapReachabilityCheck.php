<?php

declare(strict_types=1);

namespace AltUU\Domains\Diagnostics\Checks;

use AltUU\Domains\Diagnostics\Contracts\ConnectivityCheck;
use AltUU\Domains\Diagnostics\Enums\ConnectivityServiceEnum;
use AltUU\Domains\Diagnostics\ViewModels\ConnectivityCheckResultViewModel;

final class IapReachabilityCheck implements ConnectivityCheck
{
    public function __construct(private readonly HttpReachabilityProbe $probe) {}

    public function service(): ConnectivityServiceEnum
    {
        return ConnectivityServiceEnum::Iap;
    }

    public function __invoke(): ConnectivityCheckResultViewModel
    {
        return $this->probe->check(
            service: $this->service(),
            baseUrl: (string) config('services.iap.base_url'),
            timeoutSeconds: min(5, (int) config('services.iap.timeout', 5)),
        );
    }
}

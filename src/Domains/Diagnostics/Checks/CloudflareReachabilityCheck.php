<?php

declare(strict_types=1);

namespace AltUU\Domains\Diagnostics\Checks;

use AltUU\Domains\Diagnostics\Contracts\ConnectivityCheck;
use AltUU\Domains\Diagnostics\Enums\ConnectivityServiceEnum;
use AltUU\Domains\Diagnostics\ViewModels\ConnectivityCheckResultViewModel;

final class CloudflareReachabilityCheck implements ConnectivityCheck
{
    public function __construct(private readonly HttpReachabilityProbe $probe) {}

    public function service(): ConnectivityServiceEnum
    {
        return ConnectivityServiceEnum::Cloudflare;
    }

    public function __invoke(): ConnectivityCheckResultViewModel
    {
        return $this->probe->check(
            service: $this->service(),
            baseUrl: (string) config('services.cloudflare.base_url'),
            timeoutSeconds: 5,
        );
    }
}

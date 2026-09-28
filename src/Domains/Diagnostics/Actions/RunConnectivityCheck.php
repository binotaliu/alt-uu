<?php

declare(strict_types=1);

namespace AltUU\Domains\Diagnostics\Actions;

use AltUU\Domains\Diagnostics\Checks\AppleReachabilityCheck;
use AltUU\Domains\Diagnostics\Checks\CloudflareReachabilityCheck;
use AltUU\Domains\Diagnostics\Checks\GoogleReachabilityCheck;
use AltUU\Domains\Diagnostics\Checks\HunguReachabilityCheck;
use AltUU\Domains\Diagnostics\Checks\IapReachabilityCheck;
use AltUU\Domains\Diagnostics\Checks\NouToolsReachabilityCheck;
use AltUU\Domains\Diagnostics\Checks\SchoolPortalReachabilityCheck;
use AltUU\Domains\Diagnostics\Enums\ConnectivityServiceEnum;
use AltUU\Domains\Diagnostics\ViewModels\ConnectivityCheckResultViewModel;

final readonly class RunConnectivityCheck
{
    public function __construct(
        private HunguReachabilityCheck $hunguCheck,
        private SchoolPortalReachabilityCheck $schoolPortalCheck,
        private NouToolsReachabilityCheck $nouToolsCheck,
        private IapReachabilityCheck $iapCheck,
        private GoogleReachabilityCheck $googleCheck,
        private CloudflareReachabilityCheck $cloudflareCheck,
        private AppleReachabilityCheck $appleCheck,
    ) {}

    public function __invoke(ConnectivityServiceEnum $service): ConnectivityCheckResultViewModel
    {
        return match ($service) {
            ConnectivityServiceEnum::Hungu => ($this->hunguCheck)(),
            ConnectivityServiceEnum::SchoolPortal => ($this->schoolPortalCheck)(),
            ConnectivityServiceEnum::NouTools => ($this->nouToolsCheck)(),
            ConnectivityServiceEnum::Iap => ($this->iapCheck)(),
            ConnectivityServiceEnum::Google => ($this->googleCheck)(),
            ConnectivityServiceEnum::Cloudflare => ($this->cloudflareCheck)(),
            ConnectivityServiceEnum::Apple => ($this->appleCheck)(),
        };
    }
}

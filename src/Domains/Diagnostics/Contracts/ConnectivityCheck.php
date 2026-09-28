<?php

declare(strict_types=1);

namespace AltUU\Domains\Diagnostics\Contracts;

use AltUU\Domains\Diagnostics\Enums\ConnectivityServiceEnum;
use AltUU\Domains\Diagnostics\ViewModels\ConnectivityCheckResultViewModel;

interface ConnectivityCheck
{
    public function service(): ConnectivityServiceEnum;

    public function __invoke(): ConnectivityCheckResultViewModel;
}

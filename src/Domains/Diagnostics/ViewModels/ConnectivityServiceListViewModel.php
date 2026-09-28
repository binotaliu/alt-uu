<?php

declare(strict_types=1);

namespace AltUU\Domains\Diagnostics\ViewModels;

use Spatie\LaravelData\Resource;
use Spatie\TypeScriptTransformer\Attributes\TypeScript;

#[TypeScript]
final class ConnectivityServiceListViewModel extends Resource
{
    /**
     * @param  ConnectivityServiceViewModel[]  $services
     */
    public function __construct(
        public array $services,
    ) {}
}

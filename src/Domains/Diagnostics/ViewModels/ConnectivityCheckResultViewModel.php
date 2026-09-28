<?php

declare(strict_types=1);

namespace AltUU\Domains\Diagnostics\ViewModels;

use AltUU\Domains\Diagnostics\Enums\ConnectivityServiceEnum;
use Spatie\LaravelData\Resource;
use Spatie\TypeScriptTransformer\Attributes\TypeScript;

#[TypeScript]
final class ConnectivityCheckResultViewModel extends Resource
{
    public function __construct(
        public ConnectivityServiceEnum $service,
        public string $label,
        public string $checkKind,
        public bool $reachable,
        public ?int $statusCode,
        public ?int $latencyMs,
        public ?string $error,
        public string $checkedAt,
    ) {}
}

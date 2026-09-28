<?php

declare(strict_types=1);

namespace AltUU\Domains\Subscription\ViewModels;

use Spatie\LaravelData\Resource;
use Spatie\TypeScriptTransformer\Attributes\TypeScript;

#[TypeScript]
final class EntitlementViewModel extends Resource
{
    public function __construct(
        public bool $active,
        public ?string $productId,
        public ?string $expiresAt,
        public ?string $platform,
    ) {}
}

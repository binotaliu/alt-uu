<?php

declare(strict_types=1);

namespace AltUU\Domains\Subscription\ViewModels;

use Spatie\LaravelData\Resource;
use Spatie\TypeScriptTransformer\Attributes\TypeScript;

#[TypeScript]
final class ProductViewModel extends Resource
{
    public function __construct(
        public string $id,
        public string $displayName,
        public string $description,
        public string $displayPrice,
        public float $price,
    ) {}
}

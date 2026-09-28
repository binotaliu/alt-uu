<?php

declare(strict_types=1);

namespace AltUU\Domains\Activity\ViewModels;

use Spatie\LaravelData\Resource;
use Spatie\TypeScriptTransformer\Attributes\TypeScript;

#[TypeScript]
final class ActivityDayViewModel extends Resource
{
    public function __construct(
        public string $date,
        public int $seconds,
    ) {}
}

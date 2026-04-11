<?php

declare(strict_types=1);

namespace AltUU\Domains\StudyTime\ViewModels;

use Spatie\LaravelData\Resource;
use Spatie\TypeScriptTransformer\Attributes\TypeScript;

#[TypeScript]
final class StudyTimeResultViewModel extends Resource
{
    public function __construct(
        public bool $ok,
        public int $seconds,
        public ?string $message,
    ) {}
}

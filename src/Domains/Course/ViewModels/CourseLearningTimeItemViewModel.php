<?php

declare(strict_types=1);

namespace AltUU\Domains\Course\ViewModels;

use Spatie\LaravelData\Resource;
use Spatie\TypeScriptTransformer\Attributes\TypeScript;

#[TypeScript]
final class CourseLearningTimeItemViewModel extends Resource
{
    public function __construct(
        public string $identifier,
        public ?string $href,
        public string $text,
        public int $level,
        public bool $itemDisabled,
        public ?string $duration,
    ) {}
}

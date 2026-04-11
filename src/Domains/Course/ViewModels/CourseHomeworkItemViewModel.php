<?php

declare(strict_types=1);

namespace AltUU\Domains\Course\ViewModels;

use Spatie\LaravelData\Resource;
use Spatie\TypeScriptTransformer\Attributes\TypeScript;

#[TypeScript]
final class CourseHomeworkItemViewModel extends Resource
{
    public function __construct(
        public string $title,
        public string $percent,
        public string $type,
        public ?string $status,
        public ?string $window,
        public ?string $actionUrl,
        public ?string $resultUrl,
        public string $source = 'homework',
    ) {}
}

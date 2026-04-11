<?php

declare(strict_types=1);

namespace AltUU\Domains\Course\ViewModels;

use Spatie\LaravelData\Resource;
use Spatie\TypeScriptTransformer\Attributes\TypeScript;

#[TypeScript]
final class CourseTasksCountViewModel extends Resource
{
    public function __construct(
        public string $courseId = '',
        public int $pendingHomeworks = 0,
        public int $unreadArticles = 0,
    ) {}
}

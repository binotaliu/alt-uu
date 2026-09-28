<?php

declare(strict_types=1);

namespace AltUU\Domains\SchoolPortal\ViewModels;

use Spatie\LaravelData\Resource;
use Spatie\TypeScriptTransformer\Attributes\TypeScript;

#[TypeScript]
final class SchoolPortalExamScopeViewModel extends Resource
{
    public function __construct(
        public string $category,
        public ?string $scope = null,
    ) {}
}

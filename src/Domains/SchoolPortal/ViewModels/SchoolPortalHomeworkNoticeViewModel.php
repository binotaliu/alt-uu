<?php

declare(strict_types=1);

namespace AltUU\Domains\SchoolPortal\ViewModels;

use Spatie\LaravelData\Resource;
use Spatie\TypeScriptTransformer\Attributes\TypeScript;

#[TypeScript]
final class SchoolPortalHomeworkNoticeViewModel extends Resource
{
    public function __construct(
        public string $title,
        public ?string $dueDate,
        public ?string $submissionMethod,
        public ?string $downloadUrl,
    ) {}
}

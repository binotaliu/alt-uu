<?php

declare(strict_types=1);

namespace AltUU\Domains\Diagnostics\ViewModels;

use Spatie\LaravelData\Resource;
use Spatie\TypeScriptTransformer\Attributes\TypeScript;

#[TypeScript]
final class DiagnosticBundleViewModel extends Resource
{
    public function __construct(
        public string $filename,
        public string $content,
    ) {}
}

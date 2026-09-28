<?php

declare(strict_types=1);

namespace AltUU\Domains\Diagnostics\Enums;

use Spatie\TypeScriptTransformer\Attributes\TypeScript;

#[TypeScript]
enum DiagnosticSourceEnum: string
{
    case Server = 'server';
    case Client = 'client';
}

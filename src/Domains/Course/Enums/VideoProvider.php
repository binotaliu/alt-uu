<?php

declare(strict_types=1);

namespace AltUU\Domains\Course\Enums;

use Spatie\TypeScriptTransformer\Attributes\TypeScript;

#[TypeScript]
enum VideoProvider: string
{
    case Native = 'native';
    case Youtube = 'youtube';
}

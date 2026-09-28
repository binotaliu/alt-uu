<?php

declare(strict_types=1);

namespace AltUU\Domains\Diagnostics\Enums;

use Spatie\TypeScriptTransformer\Attributes\TypeScript;

#[TypeScript]
enum DiagnosticLevelEnum: string
{
    case Info = 'info';
    case Warning = 'warning';
    case Error = 'error';

    public function label(): string
    {
        return match ($this) {
            self::Info => '資訊',
            self::Warning => '警告',
            self::Error => '錯誤',
        };
    }

    public function isProblem(): bool
    {
        return $this !== self::Info;
    }
}

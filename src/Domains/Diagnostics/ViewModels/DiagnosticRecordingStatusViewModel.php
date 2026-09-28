<?php

declare(strict_types=1);

namespace AltUU\Domains\Diagnostics\ViewModels;

use Spatie\LaravelData\Resource;
use Spatie\TypeScriptTransformer\Attributes\TypeScript;

#[TypeScript]
final class DiagnosticRecordingStatusViewModel extends Resource
{
    public function __construct(
        /** Whether the build ships diagnostics at all. */
        public bool $available,
        /** Whether a recording window is currently open. */
        public bool $recording,
        /** When the window closes, ISO-8601, or null when not recording. */
        public ?string $expiresAt,
        public int $windowMinutes,
        public int $retentionDays,
    ) {}
}

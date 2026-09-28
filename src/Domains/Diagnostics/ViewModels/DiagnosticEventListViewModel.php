<?php

declare(strict_types=1);

namespace AltUU\Domains\Diagnostics\ViewModels;

use Spatie\LaravelData\Resource;
use Spatie\TypeScriptTransformer\Attributes\TypeScript;

#[TypeScript]
final class DiagnosticEventListViewModel extends Resource
{
    /**
     * @param  DiagnosticEventViewModel[]  $events
     */
    public function __construct(
        public array $events,
        public int $total,
        public bool $recordingEnabled,
    ) {}
}

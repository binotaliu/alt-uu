<?php

declare(strict_types=1);

namespace AltUU\Domains\Diagnostics\ViewModels;

use AltUU\Domains\Diagnostics\Enums\DiagnosticEventTypeEnum;
use AltUU\Domains\Diagnostics\Enums\DiagnosticLevelEnum;
use AltUU\Domains\Diagnostics\Enums\DiagnosticSourceEnum;
use App\Models\DiagnosticEvent;
use Spatie\LaravelData\Resource;
use Spatie\TypeScriptTransformer\Attributes\LiteralTypeScriptType;
use Spatie\TypeScriptTransformer\Attributes\TypeScript;

#[TypeScript]
final class DiagnosticEventViewModel extends Resource
{
    /**
     * @param  array<string, mixed>  $context
     */
    public function __construct(
        public int $id,
        public string $occurredAt,
        public DiagnosticEventTypeEnum $type,
        public string $typeLabel,
        public DiagnosticLevelEnum $level,
        public DiagnosticSourceEnum $source,
        public ?string $op,
        public ?string $requestId,
        public string $summary,
        public ?int $status,
        public ?int $durationMs,
        #[LiteralTypeScriptType('Record<string, unknown>')]
        public array $context,
    ) {}

    public static function fromModel(DiagnosticEvent $event): self
    {
        return new self(
            id: $event->id,
            occurredAt: $event->occurred_at->toIso8601String(),
            type: $event->type,
            typeLabel: $event->type->label(),
            level: $event->level,
            source: $event->source,
            op: $event->op,
            requestId: $event->request_id,
            summary: $event->summary,
            status: $event->status,
            durationMs: $event->duration_ms,
            context: $event->context ?? [],
        );
    }
}

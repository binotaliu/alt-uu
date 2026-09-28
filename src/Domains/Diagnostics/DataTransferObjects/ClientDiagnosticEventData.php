<?php

declare(strict_types=1);

namespace AltUU\Domains\Diagnostics\DataTransferObjects;

use Spatie\LaravelData\Attributes\Validation\Nullable;
use Spatie\LaravelData\Attributes\Validation\Required;
use Spatie\LaravelData\Data;
use Spatie\TypeScriptTransformer\Attributes\LiteralTypeScriptType;
use Spatie\TypeScriptTransformer\Attributes\TypeScript;

/**
 * One entry from the frontend's in-memory ring buffer.
 *
 * Everything here is client-supplied, so the rules are deliberately tight:
 * these strings end up in a log the user will paste into a public issue.
 */
#[TypeScript]
final class ClientDiagnosticEventData extends Data
{
    /**
     * @param  array<string, mixed>  $context
     */
    public function __construct(
        #[Required]
        public string $occurredAt,
        #[Required]
        public string $type,
        #[Required]
        public string $level,
        #[Required]
        public string $summary,
        #[Nullable]
        public ?string $op,
        #[Nullable]
        public ?string $requestId,
        #[Nullable]
        public ?int $status,
        #[Nullable]
        public ?int $durationMs,
        #[LiteralTypeScriptType('Record<string, unknown>')]
        public array $context = [],
    ) {}

    /**
     * @return array<string, array<int, string>>
     */
    public static function rules(): array
    {
        return [
            'occurredAt' => ['required', 'string', 'max:40'],
            'type' => ['required', 'string', 'in:client.error,client.nav,api.request'],
            'level' => ['required', 'string', 'in:info,warning,error'],
            'summary' => ['required', 'string', 'max:2000'],
            'op' => ['nullable', 'string', 'max:64'],
            'requestId' => ['nullable', 'string', 'max:64'],
            'status' => ['nullable', 'integer', 'min:0', 'max:599'],
            'durationMs' => ['nullable', 'integer', 'min:0'],
            'context' => ['array'],
        ];
    }
}

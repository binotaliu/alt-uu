<?php

declare(strict_types=1);

namespace AltUU\Domains\Diagnostics\DataTransferObjects;

use Spatie\LaravelData\Attributes\DataCollectionOf;
use Spatie\LaravelData\Data;
use Spatie\TypeScriptTransformer\Attributes\TypeScript;

#[TypeScript]
final class ClientDiagnosticEventsInputData extends Data
{
    /**
     * @param  ClientDiagnosticEventData[]  $events
     */
    public function __construct(
        #[DataCollectionOf(ClientDiagnosticEventData::class)]
        public array $events = [],
    ) {}

    /**
     * @return array<string, array<int, string>>
     */
    public static function rules(): array
    {
        return [
            // Bounded so a malformed or hostile client cannot flood the log.
            'events' => ['array', 'max:300'],
        ];
    }
}

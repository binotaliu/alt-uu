<?php

declare(strict_types=1);

namespace AltUU\Domains\Diagnostics\Actions;

use AltUU\Domains\Diagnostics\DataTransferObjects\ClientDiagnosticEventData;
use AltUU\Domains\Diagnostics\DataTransferObjects\ClientDiagnosticEventsInputData;
use AltUU\Domains\Diagnostics\Enums\DiagnosticEventTypeEnum;
use AltUU\Domains\Diagnostics\Enums\DiagnosticLevelEnum;
use AltUU\Domains\Diagnostics\Enums\DiagnosticSourceEnum;
use App\Services\Diagnostics\DiagnosticRecorder;
use Illuminate\Support\Facades\Date;

/**
 * Folds the frontend's ring buffer into the server-side log.
 *
 * The client half is what distinguishes "our app has a bug" from "the API
 * failed": a Vue render error or an unhandled rejection never reaches the
 * server on its own. Merging the two gives one timeline to read.
 */
final readonly class StoreClientDiagnosticEvents
{
    public function __construct(private DiagnosticRecorder $recorder) {}

    public function __invoke(ClientDiagnosticEventsInputData $input): int
    {
        $stored = 0;

        foreach ($input->events as $event) {
            $data = $event instanceof ClientDiagnosticEventData
                ? $event
                : ClientDiagnosticEventData::from($event);

            $this->recorder->record(
                DiagnosticEventTypeEnum::tryFrom($data->type) ?? DiagnosticEventTypeEnum::ClientError,
                $data->summary,
                DiagnosticLevelEnum::tryFrom($data->level) ?? DiagnosticLevelEnum::Info,
                is_array($data->context) ? $data->context : [],
                op: $data->op,
                requestId: $data->requestId,
                status: $data->status,
                durationMs: $data->durationMs,
                source: DiagnosticSourceEnum::Client,
                occurredAt: $this->parseTimestamp($data->occurredAt),
            );

            $stored++;
        }

        return $stored;
    }

    private function parseTimestamp(string $value): ?\DateTimeInterface
    {
        try {
            return Date::parse($value);
        } catch (\Throwable) {
            return null;
        }
    }
}

<?php

declare(strict_types=1);

namespace AltUU\Domains\Diagnostics\Checks;

use AltUU\Domains\Diagnostics\Enums\ConnectivityServiceEnum;
use AltUU\Domains\Diagnostics\ViewModels\ConnectivityCheckResultViewModel;
use App\Services\Diagnostics\UpstreamRecordingSwitch;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;

final readonly class HttpReachabilityProbe
{
    public function __construct(private UpstreamRecordingSwitch $recordingSwitch) {}

    public function check(ConnectivityServiceEnum $service, string $baseUrl, int $timeoutSeconds): ConnectivityCheckResultViewModel
    {
        // A probe failure IS the diagnostic result and is already shown in the
        // UI, so recording it too would duplicate the information while
        // pushing genuine events out of the bounded log.
        return $this->recordingSwitch->withoutRecording(
            fn (): ConnectivityCheckResultViewModel => $this->probe($service, $baseUrl, $timeoutSeconds),
        );
    }

    private function probe(ConnectivityServiceEnum $service, string $baseUrl, int $timeoutSeconds): ConnectivityCheckResultViewModel
    {
        $start = microtime(true);

        try {
            $response = Http::timeout($timeoutSeconds)
                ->connectTimeout(5)
                ->get($baseUrl);

            return new ConnectivityCheckResultViewModel(
                service: $service,
                label: $service->label(),
                checkKind: 'reachability',
                reachable: $response->successful() || $response->status() < 500,
                statusCode: $response->status(),
                latencyMs: $this->elapsedMs($start),
                error: null,
                checkedAt: now()->toIso8601String(),
            );
        } catch (ConnectionException $e) {
            return new ConnectivityCheckResultViewModel(
                service: $service,
                label: $service->label(),
                checkKind: 'reachability',
                reachable: false,
                statusCode: null,
                latencyMs: $this->elapsedMs($start),
                error: $e->getMessage(),
                checkedAt: now()->toIso8601String(),
            );
        }
    }

    private function elapsedMs(float $start): int
    {
        return (int) round((microtime(true) - $start) * 1000);
    }
}

<?php

declare(strict_types=1);

namespace App\NativeComponents\Settings;

use AltUU\Domains\Diagnostics\Actions\ListConnectivityServices;
use AltUU\Domains\Diagnostics\Actions\RunConnectivityCheck;
use AltUU\Domains\Diagnostics\Enums\ConnectivityServiceEnum;
use App\NativeComponents\Support\ConnectivityRetryTracker;
use Illuminate\View\View;
use Native\Mobile\Attributes\Poll;
use Native\Mobile\Edge\NativeComponent;
use Native\Mobile\Facades\Network;
use Throwable;

/**
 * Connectivity diagnostics (ConnectivityDiagnostics.vue + useConnectivityDiagnostics).
 *
 * Reachable before login, so there is no session guard. Checks run one
 * service per poll tick so each row can show its own "checking" state; the
 * same tick re-reads the device network state while offline and restarts the
 * checks once it is back. Row shape:
 * `['service','label','isReference','status' => pending|checking|done, 'reachable','statusCode','latencyMs','error']`.
 */
final class ConnectivityDiagnostics extends NativeComponent
{
    private const int NETWORK_POLL_INTERVAL_SECONDS = 3;

    private const array OVERVIEW_MESSAGES = [
        'hungu' => '由於無法連線到數位學習平台，因此無法使用 Alt UU',
        'school_portal' => '由於無法連線到教務行政資訊系統，因此無法使用部份功能如下載作業或查詢成績。',
        'nou_tools' => '由於無法連線到 NOU 小幫手，因此部份功能如視訊面授資訊、學校行事曆，以及考古題等功能將無法使用。',
        'iap' => '由於無法連線到 Alt UU+ 服務，因此 Alt UU+ 功能無法使用。若您已訂閱但未顯示您的訂閱狀態，可於稍後可正常連線時按一下訂閱頁中的「恢復購買」來恢復您的訂閱狀態。',
    ];

    private const array NETWORK_TYPE_LABELS = [
        'wifi' => 'Wi-Fi',
        'cellular' => '行動網路',
        'ethernet' => '乙太網路',
        'unknown' => '未知',
    ];

    /** @var list<array<string, mixed>> */
    public array $rows = [];

    /** @var list<array<string, mixed>> */
    public array $referenceRows = [];

    /** @var array{connected: bool, type: string, isExpensive: bool, isConstrained: bool}|null */
    public ?array $deviceNetwork = null;

    public bool $checking = false;

    public bool $checkingReference = false;

    public bool $awaitingNetwork = false;

    public float $lastNetworkPollAt = 0.0;

    public ?string $error = null;

    public ?string $referenceError = null;

    public function mount(): void
    {
        $this->runCheck();
    }

    public function navTitle(): string
    {
        return '連線診斷';
    }

    public function runCheck(): void
    {
        ConnectivityRetryTracker::noteDiagnosticsRun();

        $this->checking = true;
        $this->awaitingNetwork = false;
        $this->error = null;

        $network = $this->loadDeviceNetwork();

        if (! $network['connected']) {
            $this->rows = [];
            $this->referenceRows = [];
            $this->checking = false;
            $this->awaitingNetwork = true;
            $this->lastNetworkPollAt = microtime(true);

            return;
        }

        try {
            $pending = array_map(
                static fn ($service): array => [
                    'service' => $service->service->value,
                    'label' => $service->label,
                    'isReference' => $service->isReference,
                    'status' => 'pending',
                    'reachable' => false,
                    'statusCode' => null,
                    'latencyMs' => null,
                    'error' => null,
                ],
                app(ListConnectivityServices::class)()->services,
            );
        } catch (Throwable) {
            $this->error = '檢查失敗，請稍後再試。';
            $this->checking = false;

            return;
        }

        $this->rows = array_values(array_filter($pending, static fn (array $row): bool => ! $row['isReference']));
        $this->referenceRows = array_values(array_filter($pending, static fn (array $row): bool => $row['isReference']));

        $this->startNextCheck($this->rows);
    }

    public function runReferenceCheck(): void
    {
        if ($this->referenceRows === [] || $this->checkingReference) {
            return;
        }

        $this->checkingReference = true;
        $this->referenceError = null;

        foreach ($this->referenceRows as $index => $row) {
            $this->referenceRows[$index]['status'] = 'pending';
        }

        $this->startNextCheck($this->referenceRows);
    }

    /**
     * One step of the state machine: re-check the device network while
     * offline, otherwise run the row currently marked "checking" and mark the
     * next one.
     */
    #[Poll(400)]
    public function tick(): void
    {
        if ($this->awaitingNetwork) {
            if (microtime(true) - $this->lastNetworkPollAt < self::NETWORK_POLL_INTERVAL_SECONDS) {
                return;
            }

            $this->lastNetworkPollAt = microtime(true);

            if ($this->loadDeviceNetwork()['connected']) {
                $this->runCheck();
            }

            return;
        }

        if ($this->checking) {
            $this->advance($this->rows, $this->error, $this->checking);

            return;
        }

        if ($this->checkingReference) {
            $this->advance($this->referenceRows, $this->referenceError, $this->checkingReference);
        }
    }

    public function render(): View
    {
        return view('native.settings.connectivity-diagnostics', [
            'overview' => $this->overview(),
            'isOffline' => $this->deviceNetwork !== null && ! $this->deviceNetwork['connected'],
            'networkTypeLabel' => self::NETWORK_TYPE_LABELS[$this->deviceNetwork['type'] ?? 'unknown'] ?? ($this->deviceNetwork['type'] ?? ''),
        ]);
    }

    /**
     * @return array{level: string, messages: list<string>}
     */
    private function overview(): array
    {
        if ($this->deviceNetwork !== null && ! $this->deviceNetwork['connected']) {
            return [
                'level' => 'error',
                'messages' => ['您的裝置目前沒有網路連線，請確認您已連線到行動網路（4G / 5G 等）或無線網路（Wi-Fi），方可使用 Alt-UU。'],
            ];
        }

        if ($this->rows === [] || collect($this->rows)->contains(fn (array $row): bool => $row['status'] !== 'done')) {
            return ['level' => 'loading', 'messages' => []];
        }

        $unreachable = array_filter($this->rows, static fn (array $row): bool => ! $row['reachable']);

        $messages = [];

        foreach ($unreachable as $row) {
            if (isset(self::OVERVIEW_MESSAGES[$row['service']])) {
                $messages[] = self::OVERVIEW_MESSAGES[$row['service']];
            }
        }

        if ($messages === []) {
            return ['level' => 'ok', 'messages' => []];
        }

        $hunguUnreachable = collect($unreachable)->contains(fn (array $row): bool => $row['service'] === ConnectivityServiceEnum::Hungu->value);

        return ['level' => $hunguUnreachable ? 'error' : 'warning', 'messages' => $messages];
    }

    /**
     * @param  list<array<string, mixed>>  $rows
     */
    private function startNextCheck(array &$rows): void
    {
        foreach ($rows as $index => $row) {
            if ($row['status'] === 'pending') {
                $rows[$index]['status'] = 'checking';

                return;
            }
        }
    }

    /**
     * @param  list<array<string, mixed>>  $rows
     */
    private function advance(array &$rows, ?string &$error, bool &$running): void
    {
        $current = null;

        foreach ($rows as $index => $row) {
            if ($row['status'] === 'checking') {
                $current = $index;

                break;
            }
        }

        if ($current === null) {
            $running = false;

            return;
        }

        try {
            $result = app(RunConnectivityCheck::class)(ConnectivityServiceEnum::from($rows[$current]['service']));

            $rows[$current] = [
                ...$rows[$current],
                'status' => 'done',
                'reachable' => $result->reachable,
                'statusCode' => $result->statusCode,
                'latencyMs' => $result->latencyMs,
                'error' => $result->error,
            ];
        } catch (Throwable) {
            $error = '檢查失敗，請稍後再試。';
            $rows[$current] = [...$rows[$current], 'status' => 'done', 'reachable' => false, 'error' => '檢查失敗，請稍後再試。'];
        }

        $this->startNextCheck($rows);

        if (collect($rows)->doesntContain(fn (array $row): bool => $row['status'] !== 'done')) {
            $running = false;
        }
    }

    /**
     * @return array{connected: bool, type: string, isExpensive: bool, isConstrained: bool}
     */
    private function loadDeviceNetwork(): array
    {
        try {
            $status = Network::status();

            $this->deviceNetwork = [
                'connected' => (bool) ($status->connected ?? true),
                'type' => (string) ($status->type ?? 'unknown'),
                'isExpensive' => (bool) ($status->isExpensive ?? false),
                'isConstrained' => (bool) ($status->isConstrained ?? false),
            ];
        } catch (Throwable) {
            $this->deviceNetwork = ['connected' => true, 'type' => 'unknown', 'isExpensive' => false, 'isConstrained' => false];
        }

        return $this->deviceNetwork;
    }
}

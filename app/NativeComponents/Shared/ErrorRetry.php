<?php

declare(strict_types=1);

namespace App\NativeComponents\Shared;

use Illuminate\View\View;
use Native\Mobile\Edge\NativeComponent;

/**
 * Inline failure card with a retry button and an expandable detail panel.
 *
 * Tag: `<native:error-retry :message="$error" :retrying="$loading" :detail="$errorDetail" @retry="load" />`
 *
 * Props: `message` (string), `retrying` (bool, disables the button and shows
 * the loading state), `detail` (array, optional, see keys below).
 * Events: `retry` (no args). The host reloads its data and clears `retrying`.
 *
 * `detail` keys (all optional): `displayCode`, `stageLabel`, `operationLabel`,
 * `method`, `url`, `durationMs`, `status`, `upstreamStatus`, `requestId`,
 * `exception` (`['class','message','file','line']`).
 */
final class ErrorRetry extends NativeComponent
{
    public string $message = '';

    public bool $retrying = false;

    /** @var array<string, mixed> */
    public array $detail = [];

    public bool $expanded = false;

    public function retry(): void
    {
        if ($this->retrying) {
            return;
        }

        $this->emit('retry');
    }

    public function toggleDetail(): void
    {
        $this->expanded = ! $this->expanded;
    }

    public function openDiagnosticLog(): void
    {
        $this->navigate($this->route('native.settings.diagnostics-log'));
    }

    public function displayCode(): ?string
    {
        $code = $this->detail['displayCode'] ?? null;

        return is_string($code) && $code !== '' ? $code : null;
    }

    /**
     * Label => value rows for the expanded panel, skipping absent fields.
     *
     * @return array<string, string>
     */
    public function detailRows(): array
    {
        $detail = $this->detail;
        $rows = [];

        $rows['狀況'] = (string) ($detail['stageLabel'] ?? '');
        $rows['項目'] = (string) ($detail['operationLabel'] ?? '');

        if (isset($detail['url'])) {
            $request = trim(($detail['method'] ?? '').' '.$detail['url']);

            if (isset($detail['durationMs'])) {
                $request .= ' · '.$detail['durationMs'].'ms';
            }

            $rows['請求'] = $request;
        }

        if (isset($detail['status'])) {
            $rows['狀態碼'] = (string) $detail['status'];
        }

        if (isset($detail['upstreamStatus'])) {
            $rows['學校系統'] = '回應 '.$detail['upstreamStatus'];
        }

        if (isset($detail['requestId'])) {
            $rows['識別碼'] = (string) $detail['requestId'];
        }

        $exception = $detail['exception'] ?? null;

        if (is_array($exception)) {
            $rows['伺服器'] = ($exception['class'] ?? '').': '.($exception['message'] ?? '')
                .' '.($exception['file'] ?? '').':'.($exception['line'] ?? '');
        }

        return array_filter($rows, static fn (string $value): bool => $value !== '');
    }

    public function render(): View
    {
        return view('native.shared.error-retry', [
            'displayCode' => $this->displayCode(),
            'detailRows' => $this->detailRows(),
        ]);
    }
}

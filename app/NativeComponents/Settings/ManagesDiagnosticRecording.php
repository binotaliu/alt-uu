<?php

declare(strict_types=1);

namespace App\NativeComponents\Settings;

use AltUU\Domains\Diagnostics\Actions\GetDiagnosticRecordingStatus;
use AltUU\Domains\Diagnostics\Actions\SetDiagnosticRecording;
use AltUU\Domains\Diagnostics\DataTransferObjects\SetDiagnosticRecordingInputData;
use Illuminate\Support\Facades\Date;
use Throwable;

/**
 * Shared diagnostic recording window state for the settings and log screens
 * (port of `useDiagnosticRecording`). The window closes against the clock, so
 * `isRecordingNow()` compares the stored expiry with the current time on every
 * render; views re-render through `native:poll` while a window is open.
 */
trait ManagesDiagnosticRecording
{
    public bool $recordingAvailable = true;

    public ?string $recordingExpiresAt = null;

    public int $recordingWindowMinutes = 30;

    public int $recordingRetentionDays = 14;

    public bool $savingRecording = false;

    public ?string $recordingError = null;

    protected function loadRecordingStatus(): void
    {
        try {
            $status = app(GetDiagnosticRecordingStatus::class)();

            $this->recordingAvailable = $status->available;
            $this->recordingExpiresAt = $status->recording ? $status->expiresAt : null;
            $this->recordingWindowMinutes = $status->windowMinutes;
            $this->recordingRetentionDays = $status->retentionDays;
        } catch (Throwable) {
            $this->recordingError = '無法取得診斷記錄狀態。';
        }
    }

    public function setRecording(bool $enabled): void
    {
        if ($this->savingRecording) {
            return;
        }

        $this->savingRecording = true;
        $this->recordingError = null;

        try {
            $status = app(SetDiagnosticRecording::class)(
                SetDiagnosticRecordingInputData::from(['enabled' => $enabled]),
            );

            $this->recordingAvailable = $status->available;
            $this->recordingExpiresAt = $status->recording ? $status->expiresAt : null;
            $this->recordingWindowMinutes = $status->windowMinutes;
            $this->recordingRetentionDays = $status->retentionDays;
        } catch (Throwable) {
            $this->recordingError = '無法變更診斷記錄設定，請稍後再試。';
        } finally {
            $this->savingRecording = false;
        }

        $this->onRecordingChanged();
    }

    /**
     * Hook for screens that reload data after the window opens or closes.
     */
    protected function onRecordingChanged(): void {}

    protected function isRecordingNow(): bool
    {
        if ($this->recordingExpiresAt === null) {
            return false;
        }

        return Date::parse($this->recordingExpiresAt)->isFuture();
    }

    protected function recordingMinutesRemaining(): int
    {
        if (! $this->isRecordingNow() || $this->recordingExpiresAt === null) {
            return 0;
        }

        $seconds = Date::now()->diffInSeconds(Date::parse($this->recordingExpiresAt), false);

        return max(1, (int) ceil($seconds / 60));
    }
}

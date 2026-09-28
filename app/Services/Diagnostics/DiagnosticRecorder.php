<?php

declare(strict_types=1);

namespace App\Services\Diagnostics;

use AltUU\Domains\AppPreference\AppPreferenceStore;
use AltUU\Domains\Diagnostics\Enums\DiagnosticEventTypeEnum;
use AltUU\Domains\Diagnostics\Enums\DiagnosticLevelEnum;
use AltUU\Domains\Diagnostics\Enums\DiagnosticSourceEnum;
use App\Models\DiagnosticEvent;
use DateTimeInterface;
use Illuminate\Contracts\Config\Repository as ConfigRepository;
use Illuminate\Support\Facades\Date;
use Throwable;

/**
 * Writes entries to the on-device diagnostic log.
 *
 * Recording is OFF unless the user has switched it on for a bounded window.
 * Writing a row per request costs SQLite writes on the device, which is a
 * real cost on a low-end Android phone, so this is something the user opts
 * into while reproducing a problem rather than something they pay for
 * permanently.
 *
 * Everything is redacted on the way in and the table is bounded by both row
 * count and age.
 */
final class DiagnosticRecorder
{
    /**
     * Whether recording is live, resolved once per request.
     *
     * isEnabled() is consulted on every inbound request and every upstream
     * call, so without this the common case — recording switched off — would
     * cost several KeyValueStore reads per request just to decide to do
     * nothing.
     */
    private ?bool $recording = null;

    public function __construct(
        private readonly DiagnosticRedactor $redactor,
        private readonly ConfigRepository $config,
        private readonly AppPreferenceStore $preferences,
    ) {}

    /**
     * @param  array<array-key, mixed>  $context
     */
    public function record(
        DiagnosticEventTypeEnum $type,
        string $summary,
        DiagnosticLevelEnum $level = DiagnosticLevelEnum::Info,
        array $context = [],
        ?string $op = null,
        ?string $requestId = null,
        ?int $status = null,
        ?int $durationMs = null,
        DiagnosticSourceEnum $source = DiagnosticSourceEnum::Server,
        ?DateTimeInterface $occurredAt = null,
    ): void {
        if (! $this->isEnabled()) {
            return;
        }

        // Diagnostics must never be the reason a request fails. If the table
        // is missing (a build mid-migration) or the disk is full, swallow it.
        try {
            $event = DiagnosticEvent::create([
                'occurred_at' => $occurredAt ?? now(),
                'type' => $type,
                'level' => $level,
                'source' => $source,
                'op' => $op ?? DiagnosticContext::operation(),
                'request_id' => $requestId ?? DiagnosticContext::requestId(),
                'summary' => $this->redactor->redactText($summary),
                'status' => $status,
                'duration_ms' => $durationMs,
                'context' => $this->redactor->redact($context),
            ]);

            $this->prune($event->id);
        } catch (Throwable) {
            // Intentionally ignored.
        }
    }

    /**
     * Truncate a response body to the configured snippet size, redacting
     * before truncating so a secret cannot survive by being cut in half.
     */
    public function snippet(string $body): string
    {
        $redacted = $this->redactor->redactText($body);
        $limit = max(0, (int) $this->config->get('diagnostics.body_snippet_bytes', 2048));

        if ($limit === 0 || mb_strlen($redacted) <= $limit) {
            return $redacted;
        }

        return mb_substr($redacted, 0, $limit).'…（已截斷）';
    }

    public function clear(): void
    {
        try {
            DiagnosticEvent::query()->delete();
        } catch (Throwable) {
            // Intentionally ignored.
        }
    }

    /**
     * Whether writes are currently accepted: the build allows it AND the
     * user's recording window is still open.
     */
    public function isEnabled(): bool
    {
        if ($this->recording !== null) {
            return $this->recording;
        }

        if (! $this->isAvailable()) {
            return $this->recording = false;
        }

        return $this->recording = $this->recordingExpiresAt() !== null;
    }

    /** Whether the build ships the feature at all. */
    public function isAvailable(): bool
    {
        return (bool) $this->config->get('diagnostics.enabled', true);
    }

    /**
     * When the current recording window closes, or null if it is not open.
     * An elapsed window reads as closed, which is what switches recording
     * back off without anything having to run on a timer.
     */
    public function recordingExpiresAt(): ?DateTimeInterface
    {
        if (! $this->isAvailable()) {
            return null;
        }

        try {
            $until = $this->preferences->getDiagnosticsRecordingUntil();
        } catch (Throwable) {
            return null;
        }

        return $until !== null && $until > Date::now() ? $until : null;
    }

    /**
     * Opens a recording window, or closes it when $enabled is false.
     */
    public function setRecording(bool $enabled): ?DateTimeInterface
    {
        // A build that ships without diagnostics cannot be talked into
        // recording by a request.
        if ($enabled && ! $this->isAvailable()) {
            return null;
        }

        $minutes = max(1, (int) $this->config->get('diagnostics.recording_window_minutes', 30));

        $until = $enabled ? Date::now()->addMinutes($minutes) : null;

        $this->preferences->setDiagnosticsRecordingUntil($until);
        $this->recording = $enabled;

        // Starting a window is the natural moment to drop anything that has
        // aged out, since with recording normally off nothing else runs.
        $this->pruneExpired();

        return $until;
    }

    /**
     * Drops rows past the retention age.
     *
     * The ring buffer alone never expires anything, and with recording off by
     * default a log can now sit untouched for months, so age is the bound
     * that matters. Called when a window opens and whenever the log is read,
     * which covers every path a device actually takes.
     */
    public function pruneExpired(): void
    {
        $days = max(1, (int) $this->config->get('diagnostics.retention_days', 14));

        try {
            DiagnosticEvent::query()
                ->where('occurred_at', '<', Date::now()->subDays($days))
                ->delete();
        } catch (Throwable) {
            // Intentionally ignored.
        }
    }

    public function redactor(): DiagnosticRedactor
    {
        return $this->redactor;
    }

    /**
     * Keep only the newest `max_events` rows.
     *
     * Uses the autoincrementing primary key rather than a COUNT, so this is a
     * single indexed delete on every write instead of a table scan.
     */
    private function prune(int $latestId): void
    {
        $maxEvents = max(1, (int) $this->config->get('diagnostics.max_events', 500));
        $cutoff = $latestId - $maxEvents;

        if ($cutoff > 0) {
            DiagnosticEvent::query()->where('id', '<=', $cutoff)->delete();
        }
    }
}

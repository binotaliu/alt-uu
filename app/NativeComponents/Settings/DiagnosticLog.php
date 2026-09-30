<?php

declare(strict_types=1);

namespace App\NativeComponents\Settings;

use AltUU\AttachmentBridge\Facades\AttachmentBridge;
use AltUU\Domains\Diagnostics\Actions\BuildDiagnosticBundle;
use AltUU\Domains\Diagnostics\Actions\ClearDiagnosticEvents;
use AltUU\Domains\Diagnostics\Actions\ListDiagnosticEvents;
use AltUU\Domains\Diagnostics\ViewModels\DiagnosticEventViewModel;
use App\NativeComponents\Concerns\ShowsToasts;
use Illuminate\Support\Facades\Date;
use Illuminate\Support\Facades\File;
use Illuminate\View\View;
use Native\Mobile\Edge\NativeComponent;
use Native\Mobile\Facades\Share;
use Throwable;

/**
 * Diagnostic log (DiagnosticLog.vue): recording toggle, problems-only filter,
 * expandable event rows, share (bundle download) and clear.
 *
 * Reachable before login, so there is no session guard. The clipboard has no
 * native bridge (conventions 11.6), so the Vue "copy" button is replaced by
 * the share flow only.
 */
final class DiagnosticLog extends NativeComponent
{
    use ManagesDiagnosticRecording;
    use ShowsToasts;

    /** @var list<array<string, mixed>> */
    public array $events = [];

    public int $total = 0;

    public bool $problemsOnly = false;

    public bool $loading = false;

    public ?string $loadError = null;

    public ?string $actionError = null;

    public bool $sharing = false;

    public bool $confirmClearVisible = false;

    /** @var list<int> */
    public array $expandedIds = [];

    public function mount(): void
    {
        $this->loadRecordingStatus();
        $this->load();
    }

    public function onResume(): void
    {
        $this->loadRecordingStatus();
    }

    public function navTitle(): string
    {
        return '診斷記錄';
    }

    public function load(): void
    {
        $this->loading = true;
        $this->loadError = null;

        try {
            $list = app(ListDiagnosticEvents::class)($this->problemsOnly);

            $this->events = array_map(fn (DiagnosticEventViewModel $event): array => [
                'id' => $event->id,
                'time' => Date::parse($event->occurredAt)->format('H:i:s'),
                'marker' => match ($event->level->value) {
                    'error' => '✗',
                    'warning' => '!',
                    default => '·',
                },
                'level' => $event->level->value,
                'summary' => $event->summary,
                'typeLabel' => $event->typeLabel,
                'status' => $event->status,
                'durationMs' => $event->durationMs,
                'op' => $event->op,
                'requestId' => $event->requestId,
                'context' => $event->context === []
                    ? null
                    : (string) json_encode($event->context, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            ], $list->events);
            $this->total = $list->total;
        } catch (Throwable) {
            $this->loadError = '載入診斷記錄失敗。';
        } finally {
            $this->loading = false;
        }
    }

    public function showProblemsOnly(bool $problemsOnly): void
    {
        $this->problemsOnly = $problemsOnly;
        $this->load();
    }

    public function toggleEvent(int $id): void
    {
        $this->expandedIds = in_array($id, $this->expandedIds, true)
            ? array_values(array_diff($this->expandedIds, [$id]))
            : [...$this->expandedIds, $id];
    }

    public function share(): void
    {
        if ($this->sharing) {
            return;
        }

        $this->sharing = true;
        $this->actionError = null;

        try {
            $this->shareBundle();
            $this->toastSuccess('已匯出診斷記錄');
        } catch (Throwable) {
            $this->actionError = '匯出失敗，請稍後再試。';
        } finally {
            $this->sharing = false;
        }
    }

    public function askClear(): void
    {
        $this->confirmClearVisible = true;
    }

    public function cancelClear(): void
    {
        $this->confirmClearVisible = false;
    }

    public function confirmClear(): void
    {
        $this->confirmClearVisible = false;
        $this->actionError = null;

        try {
            app(ClearDiagnosticEvents::class)();
            $this->expandedIds = [];
            $this->load();
            $this->toastSuccess('已清除診斷記錄');
        } catch (Throwable) {
            $this->actionError = '清除失敗，請稍後再試。';
        }
    }

    public function render(): View
    {
        return view('native.settings.diagnostic-log', [
            'recordingNow' => $this->isRecordingNow(),
            'minutesRemaining' => $this->recordingMinutesRemaining(),
        ]);
    }

    protected function onRecordingChanged(): void
    {
        // A freshly opened window flushes buffered events, so reload the list.
        $this->load();
    }

    /**
     * The attachment bridge fetches the bundle through the embedded runtime and
     * hands it to the platform save/share sheet (same as the data export).
     * If the bridge is unavailable the bundle is written to a file and given
     * to the system share sheet instead.
     */
    private function shareBundle(): void
    {
        $bundle = app(BuildDiagnosticBundle::class)();

        $result = AttachmentBridge::download(route('api.diagnostics.log.bundle', absolute: false), $bundle->filename);

        if ($result !== null) {
            return;
        }

        $directory = storage_path('app/diagnostics');
        File::ensureDirectoryExists($directory);
        $path = $directory.DIRECTORY_SEPARATOR.$bundle->filename;
        File::put($path, $bundle->content);

        Share::file('Alt UU 診斷記錄', '', $path);
    }
}

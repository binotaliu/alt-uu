<?php

declare(strict_types=1);

namespace App\NativeComponents\Courses;

use App\NativeComponents\Concerns\GuardsHunguSession;
use App\NativeComponents\Concerns\ShowsSessionExpiredPicker;
use App\NativeComponents\Concerns\ShowsToasts;
use App\NativeComponents\Courses\Support\LoadFailure;
use App\NativeComponents\Courses\Support\NouToolsGate;
use App\NativeComponents\Courses\Support\SchoolCalendarPresenter;
use App\Services\NouToolsClient;
use Illuminate\View\View;
use Native\Mobile\Attributes\Lazy;
use Native\Mobile\Edge\NativeComponent;
use Throwable;

/**
 * "學校行事曆" tab (SchoolCalendarPane.vue + SchoolCalendarTab.vue): a
 * countdown card for the next flagged event, then upcoming/ongoing and ended
 * events grouped by month. Gated on the NOU Tools preference exactly like the
 * live sessions tab (see LiveSessions for the gate rationale).
 */
#[Lazy]
final class SchoolCalendar extends NativeComponent
{
    use GuardsHunguSession;
    use ShowsSessionExpiredPicker;
    use ShowsToasts;

    /** @var array<int, array<string, mixed>> */
    public array $events = [];

    public bool $loading = true;

    public string $error = '';

    /** @var array<string, mixed> */
    public array $errorDetail = [];

    public bool $nouToolsEnabled = true;

    public bool $gateVisible = false;

    public function navTitle(): string
    {
        return '學校行事曆';
    }

    public function placeholder(): View
    {
        return view('native.courses.school-calendar-placeholder');
    }

    public function mount(): void
    {
        if (! $this->ensureHunguSession()) {
            return;
        }

        $this->applyGate();

        if ($this->nouToolsEnabled) {
            $this->loadCalendar();
        }
    }

    public function onResume(): void
    {
        if ($this->handleSessionExpired()) {
            return;
        }

        $this->applyGate();

        if ($this->nouToolsEnabled) {
            $this->loadCalendar();
        }
    }

    public function refresh(): void
    {
        if ($this->nouToolsEnabled) {
            $this->loadCalendar();
        }
    }

    public function retry(): void
    {
        $this->loadCalendar();
    }

    public function openGate(): void
    {
        $this->gateVisible = true;
    }

    public function closeGate(): void
    {
        $this->gateVisible = false;
    }

    public function enableNouTools(): void
    {
        if (! NouToolsGate::enable()) {
            $this->toastError('啟用失敗，請稍後重試');

            return;
        }

        $this->gateVisible = false;
        $this->nouToolsEnabled = true;
        $this->loadCalendar();
    }

    public function onAccountSwitched(int $accountId): void
    {
        $this->events = [];
        $this->applyGate();

        if ($this->nouToolsEnabled) {
            $this->loadCalendar();
        }
    }

    private function applyGate(): void
    {
        $enabled = NouToolsGate::isEnabled();

        if (! $enabled && $this->nouToolsEnabled) {
            $this->gateVisible = true;
        }

        $this->nouToolsEnabled = $enabled;
    }

    private function loadCalendar(): void
    {
        // Only the first load blanks the screen; refreshes keep the list.
        $this->loading = $this->events === [];
        $this->error = '';
        $this->errorDetail = [];

        try {
            $this->events = app(NouToolsClient::class)->getSchoolCalendar();
        } catch (Throwable $exception) {
            $this->events = [];

            if ($this->handleSessionExpired()) {
                $this->loading = false;

                return;
            }

            ['message' => $this->error, 'detail' => $this->errorDetail] = LoadFailure::describe($exception);
        }

        $this->loading = false;
    }

    public function render(): View
    {
        return view('native.courses.school-calendar', [
            'presented' => SchoolCalendarPresenter::present($this->events),
        ]);
    }
}

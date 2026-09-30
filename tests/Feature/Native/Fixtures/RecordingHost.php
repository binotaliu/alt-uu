<?php

declare(strict_types=1);

namespace Tests\Feature\Native\Fixtures;

use Illuminate\View\View;
use Native\Mobile\Edge\NativeComponent;
use Native\Mobile\Testing\Native;
use Native\Mobile\Testing\TestableComponent;

/**
 * Test-only screen that mounts a shared child component through its tag and
 * records every event the child emits. `emit()` from a screen is a no-op, so
 * child events can only be observed through a host like this one.
 *
 * The view lives in tests/Feature/Native/Fixtures/views and receives `$state`
 * (arbitrary host state, mutated with `->set('state', [...])`). Handlers
 * bound in the view as `@event="record('event')"` land in `$events` as
 * `['event', ...emitArgs]`.
 */
final class RecordingHost extends NativeComponent
{
    /** @var array<string, mixed> */
    public array $state = [];

    /** @var list<array<int, mixed>> */
    public array $events = [];

    public string $hostView = '';

    /**
     * @param  array<string, mixed>  $state
     */
    public static function mountView(string $view, array $state = []): TestableComponent
    {
        app('view')->addNamespace('native-fixtures', __DIR__.'/views');

        return Native::test(self::class, data: ['view' => $view, 'state' => $state]);
    }

    public function mount(): void
    {
        $this->hostView = (string) $this->data('view');
        $this->state = (array) $this->data('state', []);
    }

    public function record(string $event, mixed ...$args): void
    {
        $this->events[] = [$event, ...$args];
    }

    public function setState(string $key, mixed $value): void
    {
        $this->state[$key] = $value;
    }

    public function render(): View
    {
        return view('native-fixtures::'.$this->hostView);
    }
}

<?php

declare(strict_types=1);

use Tests\Feature\Native\Fixtures\RecordingHost;

it('renders label, description and a switch reflecting the value', function (): void {
    RecordingHost::mountView('toggle-row', ['value' => true])
        ->assertSee('自動播放')
        ->assertSee('播放完自動下一則')
        ->assertElement('toggle', fn ($el) => ($el['props']['value'] ?? null) === true);
});

it('emits toggled with the requested value last', function (): void {
    $host = RecordingHost::mountView('toggle-row', ['value' => false])->toggle('toggle', true);

    expect($host->get('events'))->toBe([['toggled', true]]);
});

it('swaps the switch for a spinner while saving and ignores input', function (): void {
    RecordingHost::mountView('toggle-row', ['saving' => true])
        ->assertElement('activity_indicator')
        ->assertMissingElement('toggle');
});

it('ignores toggles while disabled', function (): void {
    $host = RecordingHost::mountView('toggle-row', ['disabled' => true])->toggle('toggle', true);

    expect($host->get('events'))->toBe([]);
});

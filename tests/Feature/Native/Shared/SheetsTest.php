<?php

declare(strict_types=1);

use Tests\Feature\Native\Fixtures\RecordingHost;

it('keeps the sheet closed until the host makes it visible', function (): void {
    RecordingHost::mountView('confirm-sheet')
        ->assertElement('bottom_sheet', fn (array $node): bool => ($node['props']['visible'] ?? null) === false);

    RecordingHost::mountView('confirm-sheet', ['visible' => true])
        ->assertElement('bottom_sheet', fn (array $node): bool => $node['props']['visible'] === true);
});

it('shows the confirm sheet and emits confirm', function (): void {
    $host = RecordingHost::mountView('confirm-sheet', ['visible' => true])
        ->assertSee('移除帳號')
        ->assertSee('移除後需要重新登入。')
        ->tap('confirm');

    expect($host->get('events'))->toBe([['confirm']]);
});

it('emits cancel from the cancel button and from a swipe-down dismiss', function (): void {
    $host = RecordingHost::mountView('confirm-sheet', ['visible' => true])
        ->tap('cancel')
        ->dismissSheet('confirm-sheet');

    expect($host->get('events'))->toBe([['cancel'], ['cancel']]);
});

it('ignores taps while processing', function (): void {
    $host = RecordingHost::mountView('confirm-sheet', ['visible' => true, 'processing' => true])
        ->tap('confirm')
        ->tap('cancel');

    expect($host->get('events'))->toBe([]);
});

it('emits the typed text with the confirm event', function (): void {
    $host = RecordingHost::mountView('text-input-sheet', ['visible' => true, 'initial' => '小明'])
        ->assertSee('修改名稱')
        ->input('input', '小華')
        ->tap('confirm');

    expect($host->get('events'))->toBe([['confirm', '小華']]);
});

it('resets the draft to the initial value each time the sheet opens', function (): void {
    $host = RecordingHost::mountView('text-input-sheet', ['visible' => true, 'initial' => '小明'])
        ->input('input', '打到一半');

    $host->call('setState', 'visible', false)
        ->call('setState', 'initial', '小美')
        ->call('setState', 'visible', true)
        ->tap('confirm');

    expect($host->get('events'))->toBe([['confirm', '小美']]);
});

it('shows the validation error and blocks input while saving', function (): void {
    $host = RecordingHost::mountView('text-input-sheet', ['visible' => true, 'error' => '名稱過長', 'processing' => true])
        ->assertSee('儲存中…')
        ->tap('confirm');

    expect($host->get('events'))->toBe([]);
});

it('prefixes every ref with refPrefix so several sheets on one screen are unambiguous', function (): void {
    $host = RecordingHost::mountView('confirm-sheet', ['visible' => true, 'refPrefix' => 'block-'])
        ->tap('block-confirm')
        ->tap('block-cancel')
        ->dismissSheet('block-confirm-sheet');

    expect($host->get('events'))->toBe([['confirm'], ['cancel'], ['cancel']]);
});

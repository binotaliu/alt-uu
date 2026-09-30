<?php

declare(strict_types=1);

use App\NativeComponents\Support\MaterialDirectoryTree;
use Tests\Feature\Native\Fixtures\RecordingHost;

it('builds folders, synthetic links and ancestors like the Vue tree', function (): void {
    $nodes = MaterialDirectoryTree::build(MaterialDirectoryTree::sourceNodes([
        ['identifier' => 'A', 'href' => 'https://x/a', 'text' => 'A', 'level' => 0],
        ['identifier' => 'A1', 'href' => 'https://x/a1', 'text' => 'A1', 'level' => 1],
        ['identifier' => 'B', 'href' => null, 'text' => 'B', 'level' => 0],
    ], []));

    expect(array_column($nodes, 'internalId'))->toBe(['A::folder', 'A::link', 'A1', 'B'])
        ->and($nodes[0]['isDirectory'])->toBeTrue()
        ->and($nodes[0]['href'])->toBeNull()
        ->and($nodes[1]['isSyntheticLink'])->toBeTrue()
        ->and($nodes[1]['targetIdentifier'])->toBe('A')
        ->and($nodes[1]['level'])->toBe(1)
        ->and($nodes[1]['ancestorDirectoryIds'])->toBe(['A::folder'])
        ->and($nodes[2]['ancestorDirectoryIds'])->toBe(['A::folder'])
        ->and($nodes[3]['isDirectory'])->toBeFalse();
});

it('formats clocks and the last seen label', function (): void {
    expect(MaterialDirectoryTree::formatClock(65))->toBe('1:05')
        ->and(MaterialDirectoryTree::formatClock(3725))->toBe('1:02:05')
        ->and(MaterialDirectoryTree::lastSeenLabel(null, 100))->toBe('上次看到')
        ->and(MaterialDirectoryTree::lastSeenLabel(30, 100))->toBe('上次看到 0:30 / 1:40')
        ->and(MaterialDirectoryTree::lastSeenLabel(500, 100))->toBe('上次看到 1:40 / 1:40');
});

it('renders the tree with folders and rows', function (): void {
    RecordingHost::mountView('material-directory')
        ->assertSee('教材目錄')
        ->assertSee('第一章')
        ->assertSee('影片一')
        ->assertSee('停用項目')
        ->assertSee('未觀看')
        ->assertSee('全部展開');
});

it('shows watch durations from learning time items', function (): void {
    RecordingHost::mountView('material-directory', ['withDurations' => true])
        ->assertSee('10:00');
});

it('emits node-selected with the target identifier and href', function (): void {
    $host = RecordingHost::mountView('material-directory')->tap('node-A::link');

    expect($host->get('events'))->toBe([['node-selected', 'A', 'https://x/a']]);
});

it('collapses and expands folders', function (): void {
    RecordingHost::mountView('material-directory')
        ->tap('dir-A::folder')
        ->assertDontSee('影片一')
        ->assertDontSee('停用項目')
        ->assertSee('影片二')
        ->tap('dir-A::folder')
        ->assertSee('影片一')
        ->tap('collapse-all')
        ->assertDontSee('影片二')
        ->tap('expand-all')
        ->assertSee('影片二');
});

it('expands the ancestors of the active node when it changes', function (): void {
    RecordingHost::mountView('material-directory')
        ->tap('collapse-all')
        ->assertDontSee('影片二')
        ->call('setState', 'active', 'B1')
        ->assertSee('影片二')
        ->assertDontSee('影片一');
});

it('starts with the active node visible', function (): void {
    RecordingHost::mountView('material-directory', ['active' => 'A1'])->assertSee('影片一');
});

it('shows the last seen label unless the node is active', function (): void {
    RecordingHost::mountView('material-directory', ['lastSeen' => 'A1', 'position' => 90, 'duration' => 600])
        ->assertSee('上次看到 1:30 / 10:00');

    RecordingHost::mountView('material-directory', ['lastSeen' => 'A1', 'active' => 'A1', 'position' => 90, 'duration' => 600])
        ->assertDontSee('上次看到');
});

it('navigates to the material screen in link mode', function (): void {
    $host = RecordingHost::mountView('material-directory', ['mode' => 'link'])->tap('node-A1');

    $host->assertNavigatedTo('/courses/C1/A1');
    expect($host->get('events'))->toBe([]);
});

it('shows a skeleton while loading', function (): void {
    RecordingHost::mountView('material-directory', ['loading' => true])
        ->assertDontSee('第一章');
});

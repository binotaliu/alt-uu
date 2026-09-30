<?php

declare(strict_types=1);

use AltUU\Domains\Diagnostics\Actions\ClearDiagnosticEvents;
use App\Models\DiagnosticEvent;
use App\NativeComponents\Settings\DiagnosticLog;
use Native\Mobile\Testing\Native;

it('shows the empty state and recording prompt without events', function (): void {
    Native::visit('/settings/diagnostics/log')
        ->assertScreen(DiagnosticLog::class)
        ->assertNavTitle('診斷記錄')
        ->assertSee('診斷記錄未開啟')
        ->assertSee('目前沒有任何記錄。請先於上方開啟診斷記錄，再重現一次問題。');
});

it('lists events with their details and expands the context', function (): void {
    $event = DiagnosticEvent::factory()->failed(503)->create([
        'summary' => 'GET /api/courses 失敗',
        'context' => ['exception' => 'Timeout'],
    ]);

    Native::test(DiagnosticLog::class)
        ->assertSee('GET /api/courses 失敗')
        ->assertSee('✗')
        ->assertSee('顯示 1 筆，共 1 筆。')
        ->assertDontSee('Timeout')
        ->tap("event-{$event->id}")
        ->assertSee('Timeout')
        ->tap("event-{$event->id}")
        ->assertDontSee('Timeout');
});

it('filters to problems only', function (): void {
    DiagnosticEvent::factory()->create(['summary' => '一切正常的請求']);
    DiagnosticEvent::factory()->failed()->create(['summary' => '壞掉的請求']);

    Native::test(DiagnosticLog::class)
        ->assertSee('一切正常的請求')
        ->assertSee('壞掉的請求')
        ->tap('filter-problems')
        ->assertSet('problemsOnly', true)
        ->assertDontSee('一切正常的請求')
        ->assertSee('壞掉的請求')
        ->assertSee('顯示 1 筆，共 2 筆。')
        ->tap('filter-all')
        ->assertSee('一切正常的請求');
});

it('clears the log only after confirming', function (): void {
    DiagnosticEvent::factory()->count(2)->create();

    $test = Native::test(DiagnosticLog::class)
        ->tap('clear')
        ->assertElement('bottom_sheet', fn ($el) => ($el['props']['visible'] ?? null) === true);

    expect(DiagnosticEvent::query()->count())->toBe(2);

    $test->dismissSheet('confirm-sheet')
        ->assertSet('confirmClearVisible', false);

    expect(DiagnosticEvent::query()->count())->toBe(2);

    $test->tap('clear')->call('confirmClear')
        ->assertSet('confirmClearVisible', false)
        ->assertSee('目前沒有任何記錄')
        ->assertNativeCalled('Dialog.Toast', fn (array $p): bool => $p['message'] === '已清除診斷記錄');

    expect(DiagnosticEvent::query()->count())->toBe(0);
});

it('shows an error and keeps the log when clearing fails', function (): void {
    DiagnosticEvent::factory()->create();
    $test = Native::test(DiagnosticLog::class);

    app()->bind(ClearDiagnosticEvents::class, fn () => throw new RuntimeException('locked'));

    $test->call('confirmClear')->assertSee('清除失敗，請稍後再試。');

    expect(DiagnosticEvent::query()->count())->toBe(1);
});

it('hands the bundle to the attachment bridge when sharing', function (): void {
    DiagnosticEvent::factory()->create();
    $bridge = Native::fakeBridge()->respondTo('AttachmentBridge.Download', ['status' => 'success', 'data' => ['saved' => true]]);

    Native::test(DiagnosticLog::class)
        ->tap('share')
        ->assertSet('sharing', false)
        ->assertNativeCalled('AttachmentBridge.Download', fn (array $p): bool => $p['url'] === '/api/diagnostics/log/bundle'
            && str_starts_with($p['filename'], 'alt-uu-diagnostics-'))
        ->assertNativeCalled('Dialog.Toast', fn (array $p): bool => $p['message'] === '已匯出診斷記錄');

    $bridge->assertNotCalled('Share.File');
});

it('falls back to the system share sheet when the bridge is unavailable', function (): void {
    DiagnosticEvent::factory()->create();
    Native::fakeBridge()->respondTo('AttachmentBridge.Download', '');

    Native::test(DiagnosticLog::class)
        ->tap('share')
        ->assertNativeCalled('Share.File', fn (array $p): bool => str_ends_with($p['filePath'], '.md') && file_exists($p['filePath']));
});

it('reports a failure when the bundle cannot be exported', function (): void {
    Native::fakeBridge()->respondTo('AttachmentBridge.Download', fn () => throw new RuntimeException('bridge down'));

    Native::test(DiagnosticLog::class)
        ->tap('share')
        ->assertSee('匯出失敗，請稍後再試。')
        ->assertSet('sharing', false);
});

it('toggles the recording window and reloads the list', function (): void {
    Native::test(DiagnosticLog::class)
        ->assertDontSee('分鐘後自動關閉。請重現')
        ->call('setRecording', true)
        ->assertSee('分鐘後自動關閉。請重現')
        ->call('setRecording', false)
        ->assertDontSee('分鐘後自動關閉。請重現');
});

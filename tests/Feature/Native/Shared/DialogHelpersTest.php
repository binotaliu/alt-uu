<?php

declare(strict_types=1);

use Native\Mobile\Events\Alert\ButtonPressed;
use Native\Mobile\Testing\Native;
use Tests\Feature\Native\Fixtures\DialogHost;

it('shows a confirm alert with cancel and destructive confirm buttons', function (): void {
    Native::test(DialogHost::class)
        ->tap('ask')
        ->assertNativeCalled('Dialog.Alert', fn (array $params): bool => $params['title'] === '移除帳號'
            && $params['id'] === 'confirm:remove:12'
            && $params['buttons'][0] === ['label' => '取消', 'style' => 'cancel']
            && $params['buttons'][1] === ['label' => '移除', 'style' => 'destructive']);
});

it('routes the confirm button to onDialogConfirmed with the argument', function (): void {
    $screen = Native::test(DialogHost::class)
        ->tap('ask')
        ->emitNative(ButtonPressed::class, ['index' => 1, 'label' => '移除', 'id' => 'confirm:remove:12']);

    expect($screen->get('log'))->toBe(['confirmed:remove:12']);
});

it('routes the cancel button to onDialogCancelled', function (): void {
    $screen = Native::test(DialogHost::class)
        ->emitNative(ButtonPressed::class, ['index' => 0, 'label' => '取消', 'id' => 'confirm:remove']);

    expect($screen->get('log'))->toBe(['cancelled:remove:']);
});

it('ignores alerts it did not create', function (): void {
    $screen = Native::test(DialogHost::class)
        ->tap('warn')
        ->assertNativeCalled('Dialog.Alert', fn (array $params): bool => $params['message'] === '登入已失效')
        ->emitNative(ButtonPressed::class, ['index' => 0, 'label' => '好', 'id' => 'alert']);

    expect($screen->get('log'))->toBe([]);
});

it('shows toasts through Dialog.Toast', function (): void {
    Native::test(DialogHost::class)
        ->tap('notify')
        ->assertNativeCalledTimes('Dialog.Toast', 2)
        ->assertNativeCalled('Dialog.Toast', fn (array $params): bool => $params['message'] === '儲存失敗' && $params['duration'] === 'long');
});

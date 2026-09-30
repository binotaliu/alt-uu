<?php

declare(strict_types=1);

namespace Tests\Feature\Native\Fixtures;

use App\NativeComponents\Concerns\ShowsToasts;
use App\NativeComponents\Concerns\UsesNativeDialogs;
use Illuminate\View\View;
use Native\Mobile\Edge\NativeComponent;

/**
 * Test-only screen using the dialog and toast traits.
 */
final class DialogHost extends NativeComponent
{
    use ShowsToasts;
    use UsesNativeDialogs;

    /** @var list<string> */
    public array $log = [];

    public function ask(): void
    {
        $this->confirmWithDialog('remove', '移除帳號', '確定要移除嗎？', '移除', destructive: true, argument: '12');
    }

    public function warn(): void
    {
        $this->alertWithDialog('提醒', '登入已失效');
    }

    public function notify(): void
    {
        $this->toastError('儲存失敗');
        $this->toastSuccess('已儲存');
    }

    protected function onDialogConfirmed(string $action, ?string $argument): void
    {
        $this->log[] = "confirmed:{$action}:{$argument}";
    }

    protected function onDialogCancelled(string $action, ?string $argument): void
    {
        $this->log[] = "cancelled:{$action}:{$argument}";
    }

    public function render(): View
    {
        app('view')->addNamespace('native-fixtures', __DIR__.'/views');

        return view('native-fixtures::dialog-host');
    }
}

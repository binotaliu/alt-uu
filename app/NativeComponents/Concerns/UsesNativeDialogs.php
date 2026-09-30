<?php

declare(strict_types=1);

namespace App\NativeComponents\Concerns;

use Native\Mobile\Attributes\On;
use Native\Mobile\Events\Alert\ButtonPressed;
use Native\Mobile\Facades\Dialog;

/**
 * Native replacement for `window.alert` / `window.confirm` on SCREENS.
 *
 * Use it on the screen class, never on a child: class-based
 * `#[On(ButtonPressed::class)]` listeners only fire on screens. Children ask
 * their host by emitting an event and the screen calls these helpers.
 *
 *     $this->confirmWithDialog('remove-account', '移除帳號', '確定要移除嗎？', '移除', destructive: true, argument: (string) $id);
 *
 *     protected function onDialogConfirmed(string $action, ?string $argument): void
 *     {
 *         if ($action === 'remove-account') { ... }
 *     }
 *
 * The alert id encodes `confirm:{action}` or `confirm:{action}:{argument}`,
 * so only ids created here are routed to the hooks; other native alerts on
 * the same screen are left alone. The cancel button is index 0, the confirm
 * button index 1.
 */
trait UsesNativeDialogs
{
    private const string DIALOG_ID_PREFIX = 'confirm:';

    protected function confirmWithDialog(
        string $action,
        string $title,
        string $message,
        string $confirmLabel = '確認',
        bool $destructive = false,
        string $cancelLabel = '取消',
        ?string $argument = null,
    ): void {
        $id = self::DIALOG_ID_PREFIX.$action.($argument !== null ? ':'.$argument : '');

        Dialog::alert($title, $message, [
            ['label' => $cancelLabel, 'style' => 'cancel'],
            ['label' => $confirmLabel, 'style' => $destructive ? 'destructive' : 'default'],
        ])->id($id)->show();
    }

    protected function alertWithDialog(string $title, string $message, string $okLabel = '好'): void
    {
        Dialog::alert($title, $message, [$okLabel])->id('alert')->show();
    }

    protected function onDialogConfirmed(string $action, ?string $argument): void {}

    protected function onDialogCancelled(string $action, ?string $argument): void {}

    #[On(ButtonPressed::class)]
    public function handleDialogButtonPressed(int $index, string $label, ?string $id = null): void
    {
        if ($id === null || ! str_starts_with($id, self::DIALOG_ID_PREFIX)) {
            return;
        }

        $parts = explode(':', substr($id, strlen(self::DIALOG_ID_PREFIX)), 2);
        $action = $parts[0];
        $argument = $parts[1] ?? null;

        if ($index === 1) {
            $this->onDialogConfirmed($action, $argument);

            return;
        }

        $this->onDialogCancelled($action, $argument);
    }
}

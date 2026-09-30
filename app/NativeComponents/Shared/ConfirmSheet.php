<?php

declare(strict_types=1);

namespace App\NativeComponents\Shared;

use Illuminate\View\View;
use Native\Mobile\Edge\NativeComponent;

/**
 * Bottom-sheet confirmation (ConfirmDialog.vue).
 *
 * Tag: `<native:confirm-sheet key="confirm-remove" :visible="$confirming" title="移除帳號" message="..." confirm-label="移除" :danger="true" :processing="$busy" @confirm="doRemove" @cancel="closeConfirm" />`
 *
 * Props: `visible`, `title`, `message`, `confirmLabel` (default 確認),
 * `cancelLabel` (default 取消), `danger` (destructive confirm button),
 * `processing` (confirm shows a spinner, buttons ignore taps).
 * Events: `confirm` (no args), `cancel` (no args; also fired on swipe-down or
 * tap-outside).
 *
 * REQUIRED host action: the host owns `visible`. On `cancel` it MUST set its
 * flag to false, and on `confirm` it closes the sheet when the work is done
 * (props are re-assigned on every parent render, so the child cannot close
 * itself). For quick yes/no questions that do not need a sheet, prefer the
 * `UsesNativeDialogs` trait.
 */
final class ConfirmSheet extends NativeComponent
{
    public bool $visible = false;

    public string $title = '';

    public string $message = '';

    public string $confirmLabel = '確認';

    public string $cancelLabel = '取消';

    public bool $danger = false;

    public bool $processing = false;

    public function confirm(): void
    {
        if ($this->processing) {
            return;
        }

        $this->emit('confirm');
    }

    public function cancel(): void
    {
        if ($this->processing) {
            return;
        }

        $this->emit('cancel');
    }

    public function render(): View
    {
        return view('native.shared.confirm-sheet');
    }
}

<?php

declare(strict_types=1);

namespace App\NativeComponents\Shared;

use Illuminate\View\View;
use Native\Mobile\Edge\NativeComponent;

/**
 * Bottom-sheet with one text field (RenameAccountDialog.vue).
 *
 * Tag: `<native:text-input-sheet key="rename" :visible="$renaming" title="修改名稱" description="設定這個帳號的自訂名稱，僅顯示在這個裝置上。" :initial-value="$nickname" placeholder="請輸入自訂名稱" :max-length="30" :processing="$saving" :error="$renameError" @confirm="saveName" @cancel="closeRename" />`
 *
 * Props: `visible`, `title`, `description`, `initialValue`, `placeholder`,
 * `maxLength` (0 = unlimited), `confirmLabel` (default 儲存), `cancelLabel`,
 * `processing`, `error` (message shown under the field), `refPrefix` (prefix of
 * every ref, see `ConfirmSheet`).
 * Events: `confirm` with the entered text as the LAST argument
 * (`@confirm="saveName"` calls `saveName($value)`), `cancel` (also on
 * swipe-down / tap-outside).
 *
 * The draft is reset to `initialValue` every time `visible` turns true (the
 * Vue dialog did the same). The child detects the closed-to-open transition
 * itself, so hosts do not need to remount it with a changing key.
 *
 * REQUIRED host action: set `visible` to false on `cancel`, and after a
 * successful `confirm`. Keep `processing` true while saving.
 */
final class TextInputSheet extends NativeComponent
{
    public bool $visible = false;

    public string $title = '';

    public string $description = '';

    public string $initialValue = '';

    public string $placeholder = '';

    public int $maxLength = 0;

    public string $confirmLabel = '儲存';

    public string $cancelLabel = '取消';

    public string $refPrefix = '';

    public bool $processing = false;

    public string $error = '';

    public string $value = '';

    private bool $wasVisible = false;

    public function confirm(): void
    {
        if ($this->processing) {
            return;
        }

        $this->emit('confirm', $this->value);
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
        if ($this->visible && ! $this->wasVisible) {
            $this->value = $this->initialValue;
        }

        $this->wasVisible = $this->visible;

        return view('native.shared.text-input-sheet');
    }
}

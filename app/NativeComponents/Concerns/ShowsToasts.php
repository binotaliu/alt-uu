<?php

declare(strict_types=1);

namespace App\NativeComponents\Concerns;

use Native\Mobile\Facades\Dialog;

/**
 * Replacement for `window.showFlashMessage(message, type)`.
 *
 * `Dialog::toast` is a plain platform toast: it has no severity styling, so
 * failure messages should stay short and self-explanatory. Use it from
 * screens (child components can call it too, it is a fire-and-forget bridge
 * call).
 *
 * `$duration` is `'short'` or `'long'`.
 */
trait ShowsToasts
{
    protected function toast(string $message, string $duration = 'short'): void
    {
        Dialog::toast($message, $duration);
    }

    protected function toastSuccess(string $message): void
    {
        $this->toast($message);
    }

    protected function toastError(string $message): void
    {
        $this->toast($message, 'long');
    }
}

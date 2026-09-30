<?php

declare(strict_types=1);

namespace App\NativeComponents\Shared;

use Illuminate\View\View;
use Native\Mobile\Edge\NativeComponent;

/**
 * Muted placeholder card for "nothing here yet" states.
 *
 * Tag: `<native:empty-state message="..." title="..." />`
 * Props: `message` (string, required), `title` (string, optional headline).
 * No events.
 */
final class EmptyState extends NativeComponent
{
    public string $message = '';

    public string $title = '';

    public function render(): View
    {
        return view('native.shared.empty-state');
    }
}

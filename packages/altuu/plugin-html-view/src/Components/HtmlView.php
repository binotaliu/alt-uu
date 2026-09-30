<?php

declare(strict_types=1);

namespace AltUU\HtmlView\Components;

use Native\Mobile\Edge\Components\Native\NativeBladeComponent;

final class HtmlView extends NativeBladeComponent
{
    protected bool $isSelfClosing = true;

    protected function elementType(): string
    {
        return 'html_view';
    }
}

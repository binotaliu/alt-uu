<?php

declare(strict_types=1);

namespace AltUU\MediaPlayer\Components;

use Native\Mobile\Edge\Components\Native\NativeBladeComponent;

final class MediaPlayer extends NativeBladeComponent
{
    protected bool $isSelfClosing = true;

    protected function elementType(): string
    {
        return 'media_player';
    }
}

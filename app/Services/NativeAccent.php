<?php

declare(strict_types=1);

namespace App\Services;

use Native\Mobile\UI\Theme;

/**
 * Applies one of the seven user-selectable accents (config `native-ui.accents`)
 * to the SuperNative theme at runtime by merging the accent's token overrides
 * on top of the default (warm) theme.
 */
final class NativeAccent
{
    public const string DEFAULT = 'warm';

    /**
     * @return array<string, string> accent id => Traditional Chinese label
     */
    public function options(): array
    {
        /** @var array<string, array{label: string}> $accents */
        $accents = config('native-ui.accents', []);

        return array_map(static fn (array $accent): string => $accent['label'], $accents);
    }

    /**
     * Merge the accent's overrides into the theme and push it to the device.
     * Unknown ids fall back to the default accent.
     */
    public function apply(string $accent): string
    {
        $id = array_key_exists($accent, $this->options()) ? $accent : self::DEFAULT;

        /** @var array{light: array<string, string>, dark: array<string, string>} $tokens */
        $tokens = config("native-ui.accents.{$id}");

        Theme::merge(['light' => $tokens['light'], 'dark' => $tokens['dark']]);

        return $id;
    }
}

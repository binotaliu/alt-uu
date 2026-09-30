<?php

declare(strict_types=1);

namespace App\NativeComponents\Support;

/**
 * Port of the former Vue lib/htmlColorScheme.ts.
 *
 * Rich text sanitised upstream may carry inline `color`, `background-color`
 * and `border-color` values authored for a light page. In dark mode those
 * become unreadable, so the HSL lightness channel is remapped while hue and
 * saturation are kept:
 *  - text with L < 50% moves to L in [70, 95]%
 *  - backgrounds with L > 50% move to L in [5, 25]%
 *  - borders with L > 60% move to L in [20, 40]%
 * Values already suited to dark mode, and anything that is not a hex / rgb() /
 * hsl() colour (named colours, `var()`, gradients), are left untouched.
 *
 * Differences from the TypeScript version: `black` and `white` are understood
 * (the web version fed the literal `black` through the parser, which rejected
 * it, so its "background without colour" fallback stayed black on dark), and
 * the alpha of 8-digit hex colours is preserved.
 */
final class HtmlColorScheme
{
    private const array TEXT_PROPERTIES = ['color'];

    private const array BACKGROUND_PROPERTIES = ['background-color', 'background'];

    private const array BORDER_PROPERTIES = [
        'border-color',
        'border-top-color',
        'border-right-color',
        'border-bottom-color',
        'border-left-color',
        'outline-color',
    ];

    /**
     * Rewrites one inline `style` attribute value for the dark scheme.
     */
    public static function adjustStyleForDark(string $style): string
    {
        $allProperties = [...self::TEXT_PROPERTIES, ...self::BACKGROUND_PROPERTIES, ...self::BORDER_PROPERTIES];

        $adjusted = preg_replace_callback(
            '/([\w-]+)\s*:\s*([^;]+)/',
            static function (array $match) use ($allProperties): string {
                $property = strtolower(trim($match[1]));

                if (in_array($property, $allProperties, true)) {
                    return $match[1].': '.self::adjustColourForDark(trim($match[2]), $property);
                }

                return $match[1].': '.$match[2];
            },
            $style,
        ) ?? $style;

        // A `background` shorthand without any colour declaration would inherit
        // a text colour chosen for the light page, so give it a readable one
        // (like the web version, `background-color:` alone does not trigger
        // this because its regexp also matches the `color:` inside it).
        if (
            $adjusted !== $style
            && preg_match('/background(-color)?\s*:/i', $adjusted) === 1
            && preg_match('/color\s*:/i', $adjusted) !== 1
        ) {
            $adjusted .= '; color: '.self::adjustColourForDark('black', 'color');
        }

        return $adjusted;
    }

    public static function adjustColourForDark(string $value, string $property): string
    {
        $parsed = self::parseColour($value);

        if ($parsed === null) {
            return $value;
        }

        [$hue, $saturation, $lightness] = self::rgbToHsl(...$parsed['rgb']);
        $newLightness = $lightness;

        if (in_array($property, self::TEXT_PROPERTIES, true)) {
            if ($lightness < 50) {
                $newLightness = max(70.0, min(95.0, 100 - $lightness));
            }
        } elseif (in_array($property, self::BACKGROUND_PROPERTIES, true)) {
            if ($lightness > 50) {
                $newLightness = max(5.0, min(25.0, 100 - $lightness));
            }
        } elseif (in_array($property, self::BORDER_PROPERTIES, true)) {
            if ($lightness > 60) {
                $newLightness = max(20.0, min(40.0, 100 - $lightness));
            }
        }

        if ($newLightness === $lightness) {
            return $value;
        }

        return self::toColourString(self::hslToRgb($hue, $saturation, $newLightness), $parsed['alpha']);
    }

    /**
     * @return array{rgb: array{int, int, int}, alpha: float}|null
     */
    private static function parseColour(string $value): ?array
    {
        $value = trim($value);
        $lower = strtolower($value);

        if ($lower === 'black') {
            return ['rgb' => [0, 0, 0], 'alpha' => 1.0];
        }

        if ($lower === 'white') {
            return ['rgb' => [255, 255, 255], 'alpha' => 1.0];
        }

        if (str_starts_with($value, '#')) {
            return self::parseHex($value);
        }

        if (preg_match('/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)$/i', $value, $match) === 1) {
            return [
                'rgb' => [(int) $match[1], (int) $match[2], (int) $match[3]],
                'alpha' => isset($match[4]) && $match[4] !== '' ? (float) $match[4] : 1.0,
            ];
        }

        if (preg_match('/^hsla?\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%(?:\s*,\s*([\d.]+))?\s*\)$/i', $value, $match) === 1) {
            return [
                'rgb' => self::hslToRgb((float) $match[1], (float) $match[2], (float) $match[3]),
                'alpha' => isset($match[4]) && $match[4] !== '' ? (float) $match[4] : 1.0,
            ];
        }

        return null;
    }

    /**
     * @return array{rgb: array{int, int, int}, alpha: float}|null
     */
    private static function parseHex(string $value): ?array
    {
        $hex = substr($value, 1);

        if (preg_match('/^[0-9a-f]+$/i', $hex) !== 1) {
            return null;
        }

        if (strlen($hex) === 3) {
            $hex = $hex[0].$hex[0].$hex[1].$hex[1].$hex[2].$hex[2];
        }

        if (strlen($hex) !== 6 && strlen($hex) !== 8) {
            return null;
        }

        return [
            'rgb' => [(int) hexdec(substr($hex, 0, 2)), (int) hexdec(substr($hex, 2, 2)), (int) hexdec(substr($hex, 4, 2))],
            'alpha' => strlen($hex) === 8 ? round(hexdec(substr($hex, 6, 2)) / 255, 2) : 1.0,
        ];
    }

    /**
     * @param  array{int, int, int}  $rgb
     */
    private static function toColourString(array $rgb, float $alpha): string
    {
        if ($alpha < 1) {
            return sprintf('rgba(%d, %d, %d, %s)', $rgb[0], $rgb[1], $rgb[2], rtrim(rtrim(number_format($alpha, 4, '.', ''), '0'), '.'));
        }

        return sprintf('#%02x%02x%02x', $rgb[0], $rgb[1], $rgb[2]);
    }

    /**
     * @return array{float, float, float}
     */
    private static function rgbToHsl(int $r, int $g, int $b): array
    {
        $rn = $r / 255;
        $gn = $g / 255;
        $bn = $b / 255;

        $max = max($rn, $gn, $bn);
        $min = min($rn, $gn, $bn);
        $lightness = ($max + $min) / 2;

        if ($max === $min) {
            return [0.0, 0.0, $lightness * 100];
        }

        $delta = $max - $min;
        $saturation = $lightness > 0.5 ? $delta / (2 - $max - $min) : $delta / ($max + $min);

        $hue = match ($max) {
            $rn => (($gn - $bn) / $delta + ($gn < $bn ? 6 : 0)) / 6,
            $gn => (($bn - $rn) / $delta + 2) / 6,
            default => (($rn - $gn) / $delta + 4) / 6,
        };

        return [$hue * 360, $saturation * 100, $lightness * 100];
    }

    /**
     * @return array{int, int, int}
     */
    private static function hslToRgb(float $h, float $s, float $l): array
    {
        $hn = $h / 360;
        $sn = $s / 100;
        $ln = $l / 100;

        if ($sn === 0.0) {
            $value = (int) round($ln * 255);

            return [$value, $value, $value];
        }

        $q = $ln < 0.5 ? $ln * (1 + $sn) : $ln + $sn - $ln * $sn;
        $p = 2 * $ln - $q;

        return [
            (int) round(self::hueToRgb($p, $q, $hn + 1 / 3) * 255),
            (int) round(self::hueToRgb($p, $q, $hn) * 255),
            (int) round(self::hueToRgb($p, $q, $hn - 1 / 3) * 255),
        ];
    }

    private static function hueToRgb(float $p, float $q, float $t): float
    {
        if ($t < 0) {
            $t += 1;
        }

        if ($t > 1) {
            $t -= 1;
        }

        if ($t < 1 / 6) {
            return $p + ($q - $p) * 6 * $t;
        }

        if ($t < 1 / 2) {
            return $q;
        }

        if ($t < 2 / 3) {
            return $p + ($q - $p) * (2 / 3 - $t) * 6;
        }

        return $p;
    }
}

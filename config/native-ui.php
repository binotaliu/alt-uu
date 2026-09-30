<?php

/**
 * Native UI — Theme Tokens
 *
 * Published via `php artisan vendor:publish --tag=native-ui-config`.
 * Edit to customize your app's visual identity in one place.
 *
 * For dynamic per-tenant theming, use Native\Mobile\UI\Theme::merge([...])
 * from a service provider. Runtime merges deep-merge on top of these values.
 */

return [

    /*
    |---------------------------------------------------------------------------
    | Theme
    |---------------------------------------------------------------------------
    |
    | Color tokens (open-ended map), 4 radii, 4 font sizes, font family.
    |
    | "on-X" means "color of content placed ON a surface of color X"
    |   — i.e., text/icons on that background.
    |
    | The token map is OPEN-ENDED: add any key your design needs (e.g. a
    | `warning` pair) to both blocks and `bg-theme-warning` /
    | `text-theme-on-warning` / `border-theme-warning` resolve immediately.
    | Theme classes also accept opacity modifiers — `bg-theme-primary/15`
    | is the tonal-fill idiom (the alpha applies to the dark companion
    | too). In PHP (layout chrome builders, dynamic styling) read tokens
    | with the appearance-aware `theme()` helper: `theme('primary')`.
    |
    | Color tokens accept:
    |   - CSS hex: '#B91C1C', '#F00', or with alpha '#8B5CF680' (#RRGGBBAA)
    |   - Tailwind palette names: 'red-300', 'orange-800'
    |   - Opacity modifiers on either: 'red-300/20', '#8B5CF6/50'
    |
    | Dark mode is auto-derived from `light` when `dark` is not set. To opt
    | into explicit dark tokens, fill out the `dark` block.
    |
    | The default pairs meet WCAG AA (4.5:1) — if you customize, keep each
    | `on-*` color at 4.5:1 contrast against its background token.
    |
    */

    'theme' => [

        /*
         * Traced from the former Vue app (resources/css/app.css, removed at cutover): light page =
         * theme-100, cards = white, primary fill = theme-800, headings =
         * theme-900, links/muted = theme-700, borders = theme-300/200; dark
         * page = zinc-950, cards = zinc-900, raised = zinc-800, borders =
         * zinc-600/700, text = zinc-100/400, accent text = theme-400. Values
         * below are the default WARM accent (theme-N = oklch scale of the
         * accent, converted to sRGB hex); see the `accents` block below for
         * the other six.
         */
        'light' => [
            'primary' => '#833E2D',
            'on-primary' => '#FFFFFF',
            'primary-container' => '#FFEEE8',
            'on-primary-container' => '#5D291C',

            'secondary' => '#A64831',
            'on-secondary' => '#FFFFFF',

            // Accent-coloured text, links and active icons (theme-700).
            'accent' => '#A64831',
            'on-accent' => '#FFFFFF',

            'surface' => '#FFFFFF',
            'on-surface' => '#5D291C',
            'background' => '#FFEEE8',
            'on-background' => '#5D291C',

            'surface-variant' => '#FFF6F3',
            'on-surface-variant' => '#A64831',

            'outline' => '#FFC9B5',
            'outline-variant' => '#FFE0D4',

            'destructive' => 'red-600',
            'on-destructive' => '#FFFFFF',
            'destructive-container' => 'red-100',
            'on-destructive-container' => 'red-900',

            'success' => 'emerald-700',
            'on-success' => '#FFFFFF',
            'success-container' => 'emerald-100',
            'on-success-container' => 'emerald-800',

            'warning' => 'amber-700',
            'on-warning' => '#FFFFFF',
            'warning-container' => 'amber-50',
            'on-warning-container' => 'amber-800',
        ],

        'dark' => [
            'primary' => '#833E2D',
            'on-primary' => '#FFFFFF',
            'primary-container' => '#5D291C',
            'on-primary-container' => '#FFEEE8',

            'secondary' => 'zinc-400',
            'on-secondary' => 'zinc-950',

            'accent' => '#FFA282',
            'on-accent' => 'zinc-950',

            'surface' => 'zinc-900',
            'on-surface' => 'zinc-100',
            'background' => 'zinc-950',
            'on-background' => 'zinc-100',

            'surface-variant' => 'zinc-800',
            'on-surface-variant' => 'zinc-400',

            'outline' => 'zinc-600',
            'outline-variant' => 'zinc-700',

            'destructive' => 'red-400',
            'on-destructive' => 'zinc-950',
            'destructive-container' => 'red-900',
            'on-destructive-container' => 'red-100',

            'success' => 'emerald-300',
            'on-success' => 'emerald-950',
            'success-container' => 'emerald-900',
            'on-success-container' => 'emerald-200',

            'warning' => 'amber-400',
            'on-warning' => 'amber-950',
            'warning-container' => 'amber-900',
            'on-warning-container' => 'amber-200',
        ],

        // Corner radii (points / dp). Cards and buttons use rounded-xl (12).
        'radius-sm' => 8,
        'radius-md' => 12,
        'radius-lg' => 16,
        'radius-full' => 9999,

        // Font size scale (points / sp).
        'font-sm' => 14,
        'font-md' => 16,
        'font-lg' => 20,
        'font-xl' => 24,

    ],

    /*
    |---------------------------------------------------------------------------
    | Fonts
    |---------------------------------------------------------------------------
    |
    | The Vue app uses `font-sans: system-ui` and bundles no custom font, so
    | the app-wide default stays the platform face (San Francisco / Roboto,
    | which also covers Traditional Chinese via the system CJK fallback).
    | Register semantic aliases here only if a bundled font is ever added.
    |
    */

    'fonts' => [
        'default' => 'System',
    ],

    /*
    |---------------------------------------------------------------------------
    | Accents
    |---------------------------------------------------------------------------
    |
    | The seven user-selectable accents (html[data-accent] in the Vue app; id
    | `warm` is the default and equals the `theme` block above). Only the roles
    | that follow the accent are listed. Apply at runtime with
    | App\Services\NativeAccent::apply($id), which Theme::merge()s the override.
    | Generated from the oklch scales of the former Vue app (resources/css/app.css, removed at cutover).
    |
    */

    'accents' => [
        'warm' => [
            'label' => '暖橘',
            'light' => [
                'primary' => '#833E2D',
                'primary-container' => '#FFEEE8',
                'on-primary-container' => '#5D291C',
                'accent' => '#A64831',
                'background' => '#FFEEE8',
                'surface-variant' => '#FFF6F3',
                'on-surface' => '#5D291C',
                'on-surface-variant' => '#A64831',
                'secondary' => '#A64831',
                'outline' => '#FFC9B5',
                'outline-variant' => '#FFE0D4',
            ],
            'dark' => [
                'primary' => '#833E2D',
                'primary-container' => '#5D291C',
                'on-primary-container' => '#FFEEE8',
                'accent' => '#FFA282',
            ],
        ],
        'ocean' => [
            'label' => '海藍',
            'light' => [
                'primary' => '#005D84',
                'primary-container' => '#E5F5FD',
                'on-primary-container' => '#00405E',
                'accent' => '#0072A8',
                'background' => '#E5F5FD',
                'surface-variant' => '#F2FAFE',
                'on-surface' => '#00405E',
                'on-surface-variant' => '#0072A8',
                'secondary' => '#0072A8',
                'outline' => '#A8E1FD',
                'outline-variant' => '#CEEEFE',
            ],
            'dark' => [
                'primary' => '#005D84',
                'primary-container' => '#00405E',
                'on-primary-container' => '#E5F5FD',
                'accent' => '#60CCFC',
            ],
        ],
        'forest' => [
            'label' => '森綠',
            'light' => [
                'primary' => '#2C6330',
                'primary-container' => '#E9F6EB',
                'on-primary-container' => '#1B451E',
                'accent' => '#2E7C35',
                'background' => '#E9F6EB',
                'surface-variant' => '#F4FAF5',
                'on-surface' => '#1B451E',
                'on-surface-variant' => '#2E7C35',
                'secondary' => '#2E7C35',
                'outline' => '#B7E5BF',
                'outline-variant' => '#D6F0DA',
            ],
            'dark' => [
                'primary' => '#2C6330',
                'primary-container' => '#1B451E',
                'on-primary-container' => '#E9F6EB',
                'accent' => '#83D494',
            ],
        ],
        'purple' => [
            'label' => '皇紫',
            'light' => [
                'primary' => '#5A4886',
                'primary-container' => '#F4EFFE',
                'on-primary-container' => '#3E315F',
                'accent' => '#6F57AB',
                'background' => '#F4EFFE',
                'surface-variant' => '#F9F7FE',
                'on-surface' => '#3E315F',
                'on-surface-variant' => '#6F57AB',
                'secondary' => '#6F57AB',
                'outline' => '#DECEFF',
                'outline-variant' => '#ECE2FF',
            ],
            'dark' => [
                'primary' => '#5A4886',
                'primary-container' => '#3E315F',
                'on-primary-container' => '#F4EFFE',
                'accent' => '#CAACFF',
            ],
        ],
        'pink' => [
            'label' => '粉紅',
            'light' => [
                'primary' => '#873061',
                'primary-container' => '#FDEDF3',
                'on-primary-container' => '#5E2043',
                'accent' => '#AB3378',
                'background' => '#FDEDF3',
                'surface-variant' => '#FEF6F9',
                'on-surface' => '#5E2043',
                'on-surface-variant' => '#AB3378',
                'secondary' => '#AB3378',
                'outline' => '#FFC2DD',
                'outline-variant' => '#FEDEEB',
            ],
            'dark' => [
                'primary' => '#873061',
                'primary-container' => '#5E2043',
                'on-primary-container' => '#FDEDF3',
                'accent' => '#FF8FCA',
            ],
        ],
        'red' => [
            'label' => '緋紅',
            'light' => [
                'primary' => '#8C3436',
                'primary-container' => '#FFEDEB',
                'on-primary-container' => '#612324',
                'accent' => '#AF3C40',
                'background' => '#FFEDEB',
                'surface-variant' => '#FFF6F5',
                'on-surface' => '#612324',
                'on-surface-variant' => '#AF3C40',
                'secondary' => '#AF3C40',
                'outline' => '#FFC4BD',
                'outline-variant' => '#FFDEDB',
            ],
            'dark' => [
                'primary' => '#8C3436',
                'primary-container' => '#612324',
                'on-primary-container' => '#FFEDEB',
                'accent' => '#FF9891',
            ],
        ],
        'grey' => [
            'label' => '銀灰',
            'light' => [
                'primary' => '#51565B',
                'primary-container' => '#F0F2F4',
                'on-primary-container' => '#373B3F',
                'accent' => '#636A70',
                'background' => '#F0F2F4',
                'surface-variant' => '#F7F8FA',
                'on-surface' => '#373B3F',
                'on-surface-variant' => '#636A70',
                'secondary' => '#636A70',
                'outline' => '#D4D8DD',
                'outline-variant' => '#E5E8EB',
            ],
            'dark' => [
                'primary' => '#51565B',
                'primary-container' => '#373B3F',
                'on-primary-container' => '#F0F2F4',
                'accent' => '#B8BEC5',
            ],
        ],
    ],

];

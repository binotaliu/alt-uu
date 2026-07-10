/**
 * Utilities for adjusting inline HTML colors when switching between light/dark colour schemes.
 *
 * Rich-text content sanitised by HTML Purifier may carry inline style properties such as
 * `color`, `background-color`, and `border-color` that were authored for a light-mode context.
 * This module parses those values, detects whether they would be unreadable in dark mode, and
 * remaps the HSL lightness channel so every element remains legible.
 */

type RGB = [number, number, number];
type HSL = [number, number, number];

// ---------------------------------------------------------------------------
// Colour parsing
// ---------------------------------------------------------------------------

function hexToRgb(hex: string): RGB | null {
    let s = hex.startsWith('#') ? hex.slice(1) : hex;

    if (s.length === 3) {
        s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
    }

    if (s.length === 6 || s.length === 8) {
        return [
            parseInt(s.slice(0, 2), 16),
            parseInt(s.slice(2, 4), 16),
            parseInt(s.slice(4, 6), 16),
        ];
    }

    return null;
}

function rgbToHsl(r: number, g: number, b: number): HSL {
    const rn = r / 255;
    const gn = g / 255;
    const bn = b / 255;

    const max = Math.max(rn, gn, bn);
    const min = Math.min(rn, gn, bn);
    const l = (max + min) / 2;

    if (max === min) {
        return [0, 0, l * 100];
    }

    const d = max - min;
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    let h = 0;

    switch (max) {
        case rn:
            h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
            break;
        case gn:
            h = ((bn - rn) / d + 2) / 6;
            break;
        case bn:
            h = ((rn - gn) / d + 4) / 6;
            break;
    }

    return [h * 360, s * 100, l * 100];
}

function hue2rgb(p: number, q: number, t: number): number {
    let tc = t;

    if (tc < 0) {
        tc += 1;
    }

    if (tc > 1) {
        tc -= 1;
    }

    if (tc < 1 / 6) {
        return p + (q - p) * 6 * tc;
    }

    if (tc < 1 / 2) {
        return q;
    }

    if (tc < 2 / 3) {
        return p + (q - p) * (2 / 3 - tc) * 6;
    }

    return p;
}

function hslToRgb(h: number, s: number, l: number): RGB {
    const hn = h / 360;
    const sn = s / 100;
    const ln = l / 100;

    if (sn === 0) {
        const v = Math.round(ln * 255);

        return [v, v, v];
    }

    const q = ln < 0.5 ? ln * (1 + sn) : ln + sn - ln * sn;
    const p = 2 * ln - q;

    return [
        Math.round(hue2rgb(p, q, hn + 1 / 3) * 255),
        Math.round(hue2rgb(p, q, hn) * 255),
        Math.round(hue2rgb(p, q, hn - 1 / 3) * 255),
    ];
}

interface ParsedColour {
    rgb: RGB;
    alpha: number;
}

function parseColour(value: string): ParsedColour | null {
    const v = value.trim();

    // hex: #rgb, #rrggbb, #rrggbbaa
    if (v.startsWith('#')) {
        const rgb = hexToRgb(v);

        return rgb ? { rgb, alpha: 1 } : null;
    }

    // rgb() / rgba()
    const rgbMatch = v.match(
        /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)$/i,
    );

    if (rgbMatch) {
        return {
            rgb: [
                parseInt(rgbMatch[1]),
                parseInt(rgbMatch[2]),
                parseInt(rgbMatch[3]),
            ],
            alpha: rgbMatch[4] !== undefined ? parseFloat(rgbMatch[4]) : 1,
        };
    }

    // hsl() / hsla()
    const hslMatch = v.match(
        /^hsla?\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%(?:\s*,\s*([\d.]+))?\s*\)$/i,
    );

    if (hslMatch) {
        return {
            rgb: hslToRgb(
                parseFloat(hslMatch[1]),
                parseFloat(hslMatch[2]),
                parseFloat(hslMatch[3]),
            ),
            alpha: hslMatch[4] !== undefined ? parseFloat(hslMatch[4]) : 1,
        };
    }

    return null;
}

function toColourString(rgb: RGB, alpha: number): string {
    if (alpha < 1) {
        return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
    }

    const hex = (n: number) => n.toString(16).padStart(2, '0');

    return `#${hex(rgb[0])}${hex(rgb[1])}${hex(rgb[2])}`;
}

// ---------------------------------------------------------------------------
// Colour adjustment
// ---------------------------------------------------------------------------

/**
 * CSS properties that carry a foreground / text colour.
 * In dark mode, dark values become unreadable → map toward light.
 */
const TEXT_COLOUR_PROPS = new Set(['color']);

/**
 * CSS properties that carry a background fill.
 * In dark mode, light values become blinding → map toward dark.
 */
const BG_COLOUR_PROPS = new Set(['background-color', 'background']);

/**
 * CSS properties that carry a border / outline colour.
 * Map light values toward mid-dark so borders remain subtle.
 */
const BORDER_COLOUR_PROPS = new Set([
    'border-color',
    'border-top-color',
    'border-right-color',
    'border-bottom-color',
    'border-left-color',
    'outline-color',
]);

/**
 * Adjust a single CSS colour value for the dark colour scheme.
 *
 * Strategy: keep hue and saturation; remap the lightness channel so that
 * - text colours with L < 50 % (dark, authored for light backgrounds) → L ∈ [70, 95] %
 * - background colours with L > 50 % (light, authored for light canvases) → L ∈ [5, 25] %
 * - border colours with L > 60 % (light borders) → L ∈ [20, 40] %
 *
 * Colours that are already appropriate for the target scheme (e.g. already dark
 * backgrounds or already light text) are returned unchanged.
 */
function adjustColourForDark(value: string, prop: string): string {
    const parsed = parseColour(value);

    if (!parsed) {
        return value;
    }

    const [h, s, l] = rgbToHsl(...parsed.rgb);
    let newL = l;

    if (TEXT_COLOUR_PROPS.has(prop)) {
        if (l < 50) {
            newL = Math.max(70, Math.min(95, 100 - l));
        }
    } else if (BG_COLOUR_PROPS.has(prop)) {
        if (l > 50) {
            newL = Math.max(5, Math.min(25, 100 - l));
        }
    } else if (BORDER_COLOUR_PROPS.has(prop)) {
        if (l > 60) {
            newL = Math.max(20, Math.min(40, 100 - l));
        }
    }

    if (newL === l) {
        return value;
    }

    return toColourString(hslToRgb(h, s, newL), parsed.alpha);
}

// ---------------------------------------------------------------------------
// DOM traversal
// ---------------------------------------------------------------------------

const ALL_COLOUR_PROPS = new Set([
    ...TEXT_COLOUR_PROPS,
    ...BG_COLOUR_PROPS,
    ...BORDER_COLOUR_PROPS,
]);

/** Inline style declaration pattern: `property: value` (value may contain parens, spaces, %). */
const STYLE_DECL_RE = /([\w-]+)\s*:\s*([^;]+)/g;

function processElement(el: Element, isDark: boolean): void {
    const styleAttr = el.getAttribute('style');

    if (styleAttr) {
        let adjusted = styleAttr.replace(
            STYLE_DECL_RE,
            (_, prop: string, val: string) => {
                const p = prop.trim().toLowerCase();
                const v = val.trim();

                if (isDark && ALL_COLOUR_PROPS.has(p)) {
                    return `${prop}: ${adjustColourForDark(v, p)}`;
                }

                return `${prop}: ${val}`;
            },
        );

        // If the element has only background color set, and it's in dark mode, we should also add a text color definition to ensure the text is visible.
        if (isDark && adjusted !== styleAttr) {
            if (
                adjusted.match(/background(-color)?\s*:/i) &&
                !adjusted.match(/color\s*:/i)
            ) {
                adjusted = `${adjusted}; color: ${adjustColourForDark('black', 'color')}`;
            }
        }

        if (adjusted !== styleAttr) {
            el.setAttribute('style', adjusted);
        }
    }

    for (const child of el.children) {
        processElement(child, isDark);
    }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Process an HTML string and adjust any inline CSS colour declarations so that
 * the content remains legible in the given colour scheme.
 *
 * In light mode the HTML is returned unmodified; the function is a no-op for
 * content that contains no inline colour styles.
 *
 * @param html    Raw (pre-sanitised) HTML string.
 * @param isDark  Whether the app is currently in dark mode.
 */
export function processHtmlForColorScheme(
    html: string,
    isDark: boolean,
): string {
    if (!html || !isDark) {
        return html;
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(`<body>${html}</body>`, 'text/html');

    for (const child of doc.body.children) {
        processElement(child, isDark);
    }

    return doc.body.innerHTML;
}

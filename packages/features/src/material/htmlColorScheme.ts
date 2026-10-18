/**
 * Port of legacy `lib/htmlColorScheme.ts`: inline `color`,
 * `background(-color)` and border colours authored for light pages are
 * remapped (HSL lightness) so material HTML stays legible in dark mode.
 *
 * Legacy walked a DOMParser tree; there is no DOM here, so the same rules
 * are applied to every `style="…"` attribute of the (already sanitised)
 * HTML string, which is equivalent because only style attributes change.
 */

type RGB = [number, number, number];
type HSL = [number, number, number];

function hexToRgb(hex: string): RGB | null {
  let value = hex.startsWith('#') ? hex.slice(1) : hex;

  if (value.length === 3) {
    value = value
      .split('')
      .map((char) => char + char)
      .join('');
  }

  if (value.length !== 6 && value.length !== 8) {
    return null;
  }

  const channels: RGB = [
    parseInt(value.slice(0, 2), 16),
    parseInt(value.slice(2, 4), 16),
    parseInt(value.slice(4, 6), 16),
  ];

  return channels.some(Number.isNaN) ? null : channels;
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
    default:
      h = ((rn - gn) / d + 4) / 6;
  }

  return [h * 360, s * 100, l * 100];
}

function hueToRgb(p: number, q: number, t: number): number {
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
    Math.round(hueToRgb(p, q, hn + 1 / 3) * 255),
    Math.round(hueToRgb(p, q, hn) * 255),
    Math.round(hueToRgb(p, q, hn - 1 / 3) * 255),
  ];
}

/** CSS named colours legacy resolved through the DOM; only `black` is needed. */
const NAMED_COLOURS: Record<string, RGB> = {
  black: [0, 0, 0],
  white: [255, 255, 255],
};

function parseColour(value: string): { rgb: RGB; alpha: number } | null {
  const v = value.trim();

  if (v.startsWith('#')) {
    const rgb = hexToRgb(v);

    return rgb ? { rgb, alpha: 1 } : null;
  }

  const named = NAMED_COLOURS[v.toLowerCase()];

  if (named !== undefined) {
    return { rgb: named, alpha: 1 };
  }

  const rgbMatch = v.match(
    /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)$/i,
  );

  if (rgbMatch) {
    return {
      rgb: [
        parseInt(rgbMatch[1] ?? '0', 10),
        parseInt(rgbMatch[2] ?? '0', 10),
        parseInt(rgbMatch[3] ?? '0', 10),
      ],
      alpha: rgbMatch[4] !== undefined ? parseFloat(rgbMatch[4]) : 1,
    };
  }

  const hslMatch = v.match(
    /^hsla?\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%(?:\s*,\s*([\d.]+))?\s*\)$/i,
  );

  if (hslMatch) {
    return {
      rgb: hslToRgb(
        parseFloat(hslMatch[1] ?? '0'),
        parseFloat(hslMatch[2] ?? '0'),
        parseFloat(hslMatch[3] ?? '0'),
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

const TEXT_COLOUR_PROPS = new Set(['color']);
const BG_COLOUR_PROPS = new Set(['background-color', 'background']);
const BORDER_COLOUR_PROPS = new Set([
  'border-color',
  'border-top-color',
  'border-right-color',
  'border-bottom-color',
  'border-left-color',
  'outline-color',
]);
const ALL_COLOUR_PROPS = new Set([
  ...TEXT_COLOUR_PROPS,
  ...BG_COLOUR_PROPS,
  ...BORDER_COLOUR_PROPS,
]);

/** Remaps one colour value for dark mode (legacy `adjustColourForDark`). */
export function adjustColourForDark(value: string, prop: string): string {
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
  } else if (BORDER_COLOUR_PROPS.has(prop) && l > 60) {
    newL = Math.max(20, Math.min(40, 100 - l));
  }

  if (newL === l) {
    return value;
  }

  return toColourString(hslToRgb(h, s, newL), parsed.alpha);
}

const STYLE_DECL_RE = /([\w-]+)\s*:\s*([^;]+)/g;

/** Applies the dark-mode remapping to one style attribute value. */
export function adjustStyleForDark(style: string): string {
  let adjusted = style.replace(
    STYLE_DECL_RE,
    (_match, prop: string, val: string) => {
      const name = prop.trim().toLowerCase();

      if (ALL_COLOUR_PROPS.has(name)) {
        return `${prop}: ${adjustColourForDark(val.trim(), name)}`;
      }

      return `${prop}: ${val}`;
    },
  );

  // A background without a text colour gets a readable one. Like legacy,
  // `background-color:` itself counts as a colour, so only the
  // `background:` shorthand triggers this.
  if (
    adjusted !== style &&
    /background(-color)?\s*:/i.test(adjusted) &&
    !/color\s*:/i.test(adjusted)
  ) {
    adjusted = `${adjusted}; color: ${adjustColourForDark('black', 'color')}`;
  }

  return adjusted;
}

const STYLE_ATTRIBUTE_RE = /(\sstyle\s*=\s*)(?:"([^"]*)"|'([^']*)')/gi;

/**
 * Adjusts inline colours of `html` for the colour scheme. A no-op in light
 * mode (legacy `processHtmlForColorScheme`).
 */
export function processHtmlForColorScheme(
  html: string,
  isDark: boolean,
): string {
  if (!html || !isDark) {
    return html;
  }

  return html.replace(
    STYLE_ATTRIBUTE_RE,
    (match, prefix: string, doubleQuoted?: string, singleQuoted?: string) => {
      const value = doubleQuoted ?? singleQuoted ?? '';
      const adjusted = adjustStyleForDark(value);

      if (adjusted === value) {
        return match;
      }

      const quote = doubleQuoted !== undefined ? '"' : "'";

      return `${prefix}${quote}${adjusted.replaceAll(quote, quote === '"' ? '&quot;' : '&#39;')}${quote}`;
    },
  );
}

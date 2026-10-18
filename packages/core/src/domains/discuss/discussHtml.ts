import type { AnyNode } from 'domhandler';
import { isTag, isText } from 'domhandler';
import { parseDocument } from 'htmlparser2';

/**
 * CSS properties that survive {@link sanitizeDiscussHtml} (`CSS.AllowedProperties`),
 * with the values HTMLPurifier normalised.
 */
export type DiscussCssStyle = Partial<
  Record<
    | 'font'
    | 'font-size'
    | 'font-weight'
    | 'font-style'
    | 'font-family'
    | 'text-decoration'
    | 'padding-left'
    | 'color'
    | 'background-color'
    | 'text-align',
    string
  >
>;

/** Block-level tags the sanitiser can emit. */
export const BLOCK_TAGS: ReadonlySet<string> = new Set([
  'div',
  'p',
  'ul',
  'ol',
  'li',
  'audio',
  'video',
]);

export interface DiscussHtmlText {
  type: 'text';
  text: string;
}

export interface DiscussHtmlElement {
  type: 'element';
  tag: string;
  attributes: Record<string, string>;
  style: DiscussCssStyle;
  children: DiscussHtmlNode[];
}

export type DiscussHtmlNode = DiscussHtmlText | DiscussHtmlElement;

/**
 * Turns already sanitised post HTML (see `sanitizeDiscussHtml`) into a small
 * tree the native renderer walks. Whitespace between block elements is
 * dropped; text keeps its inner whitespace.
 */
export function parseDiscussHtml(html: string): DiscussHtmlNode[] {
  return convertNodes(parseDocument(html).children);
}

function convertNodes(nodes: AnyNode[]): DiscussHtmlNode[] {
  const result: DiscussHtmlNode[] = [];

  for (const node of nodes) {
    if (isText(node)) {
      if (node.data !== '') {
        result.push({ type: 'text', text: node.data });
      }

      continue;
    }

    if (!isTag(node)) {
      continue;
    }

    result.push({
      type: 'element',
      tag: node.name.toLowerCase(),
      attributes: { ...node.attribs },
      style: parseInlineStyle(node.attribs.style ?? ''),
      children: convertNodes(node.children),
    });
  }

  return result.filter((node, index) => {
    if (node.type !== 'text' || node.text.trim() !== '') {
      return true;
    }

    const neighbours = [result[index - 1], result[index + 1]];

    return !neighbours.some(
      (neighbour) =>
        neighbour === undefined ||
        (neighbour.type === 'element' && BLOCK_TAGS.has(neighbour.tag)),
    );
  });
}

/** Parses the `prop:value;` string the purifier emits. */
export function parseInlineStyle(style: string): DiscussCssStyle {
  const result: Record<string, string> = {};

  for (const declaration of style.split(';')) {
    const colon = declaration.indexOf(':');

    if (colon <= 0) {
      continue;
    }

    const property = declaration.slice(0, colon).trim().toLowerCase();
    const value = declaration.slice(colon + 1).trim();

    if (value !== '') {
      result[property] = value;
    }
  }

  return result as DiscussCssStyle;
}

// ---------------------------------------------------------------------------
// Dark mode (port of legacy lib/htmlColorScheme.ts)

type Rgb = [number, number, number];
type Hsl = [number, number, number];

function hexToRgb(hex: string): Rgb | null {
  let digits = hex.startsWith('#') ? hex.slice(1) : hex;

  if (digits.length === 3) {
    digits = [...digits].map((char) => char + char).join('');
  }

  if (!/^[0-9a-f]+$/i.test(digits) || ![6, 8].includes(digits.length)) {
    return null;
  }

  return [
    parseInt(digits.slice(0, 2), 16),
    parseInt(digits.slice(2, 4), 16),
    parseInt(digits.slice(4, 6), 16),
  ];
}

function rgbToHsl(r: number, g: number, b: number): Hsl {
  const [rn, gn, bn] = [r / 255, g / 255, b / 255];
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const lightness = (max + min) / 2;

  if (max === min) {
    return [0, 0, lightness * 100];
  }

  const delta = max - min;
  const saturation =
    lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);
  let hue = 0;

  if (max === rn) {
    hue = ((gn - bn) / delta + (gn < bn ? 6 : 0)) / 6;
  } else if (max === gn) {
    hue = ((bn - rn) / delta + 2) / 6;
  } else {
    hue = ((rn - gn) / delta + 4) / 6;
  }

  return [hue * 360, saturation * 100, lightness * 100];
}

function hueToRgb(p: number, q: number, t: number): number {
  let channel = t;

  if (channel < 0) {
    channel += 1;
  }

  if (channel > 1) {
    channel -= 1;
  }

  if (channel < 1 / 6) {
    return p + (q - p) * 6 * channel;
  }

  if (channel < 1 / 2) {
    return q;
  }

  if (channel < 2 / 3) {
    return p + (q - p) * (2 / 3 - channel) * 6;
  }

  return p;
}

function hslToRgb(h: number, s: number, l: number): Rgb {
  const [hn, sn, ln] = [h / 360, s / 100, l / 100];

  if (sn === 0) {
    const gray = Math.round(ln * 255);

    return [gray, gray, gray];
  }

  const q = ln < 0.5 ? ln * (1 + sn) : ln + sn - ln * sn;
  const p = 2 * ln - q;

  return [
    Math.round(hueToRgb(p, q, hn + 1 / 3) * 255),
    Math.round(hueToRgb(p, q, hn) * 255),
    Math.round(hueToRgb(p, q, hn - 1 / 3) * 255),
  ];
}

interface ParsedColor {
  rgb: Rgb;
  alpha: number;
}

function parseColor(value: string): ParsedColor | null {
  const trimmed = value.trim();

  if (trimmed.startsWith('#')) {
    const rgb = hexToRgb(trimmed);

    return rgb === null ? null : { rgb, alpha: 1 };
  }

  const rgbMatch =
    /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)$/i.exec(
      trimmed,
    );

  if (rgbMatch !== null) {
    return {
      rgb: [
        parseInt(rgbMatch[1], 10),
        parseInt(rgbMatch[2], 10),
        parseInt(rgbMatch[3], 10),
      ],
      alpha: rgbMatch[4] !== undefined ? parseFloat(rgbMatch[4]) : 1,
    };
  }

  const hslMatch =
    /^hsla?\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%(?:\s*,\s*([\d.]+))?\s*\)$/i.exec(
      trimmed,
    );

  if (hslMatch !== null) {
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

function toColorString(rgb: Rgb, alpha: number): string {
  if (alpha < 1) {
    return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
  }

  const hex = (channel: number) => channel.toString(16).padStart(2, '0');

  return `#${hex(rgb[0])}${hex(rgb[1])}${hex(rgb[2])}`;
}

/**
 * Remaps the lightness of an authored colour so it stays legible on the dark
 * theme: dark text becomes light (L 70-95%), light backgrounds become dark
 * (L 5-25%). Colours already suitable, and unparsable ones, are unchanged.
 */
export function adjustColorForDark(
  value: string,
  property: 'color' | 'background-color',
): string {
  const parsed = parseColor(value);

  if (parsed === null) {
    return value;
  }

  const [hue, saturation, lightness] = rgbToHsl(...parsed.rgb);
  let adjusted = lightness;

  if (property === 'color') {
    if (lightness < 50) {
      adjusted = Math.max(70, Math.min(95, 100 - lightness));
    }
  } else if (lightness > 50) {
    adjusted = Math.max(5, Math.min(25, 100 - lightness));
  }

  if (adjusted === lightness) {
    return value;
  }

  return toColorString(hslToRgb(hue, saturation, adjusted), parsed.alpha);
}

/**
 * Dark-scheme version of an element style (legacy `processHtmlForColorScheme`):
 * colours are remapped and a background without a text colour gets a light
 * text colour.
 */
export function adjustStyleForDark(style: DiscussCssStyle): DiscussCssStyle {
  const adjusted: DiscussCssStyle = { ...style };
  let changed = false;

  for (const property of ['color', 'background-color'] as const) {
    const value = style[property];

    if (value === undefined) {
      continue;
    }

    const next = adjustColorForDark(value, property);

    if (next !== value) {
      adjusted[property] = next;
      changed = true;
    }
  }

  if (
    changed &&
    adjusted['background-color'] !== undefined &&
    adjusted.color === undefined
  ) {
    adjusted.color = adjustColorForDark('#000000', 'color');
  }

  return adjusted;
}

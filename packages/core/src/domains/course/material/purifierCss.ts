/**
 * Port of HTMLPurifier's `style` attribute validation (AttrDef_CSS and the
 * CSSDefinition property validators, library version bundled with the legacy
 * app) for the properties the legacy `default` profile allows
 * (`CSS.AllowedProperties`).
 *
 * Each validator returns the normalised value or `null` (HTMLPurifier's
 * `false`).
 */

type CssValidator = (value: string) => string | null;

const PHP_TRIM = /^[ \t\n\r\0\v]+|[ \t\n\r\0\v]+$/g;

function phpTrim(value: string): string {
  return value.replace(PHP_TRIM, '');
}

/** AttrDef::parseCDATA */
function parseCdata(value: string): string {
  return phpTrim(value).replace(/[\n\t\r]/g, ' ');
}

const COLOR_KEYWORDS: Record<string, string> = {
  aliceblue: '#F0F8FF',
  antiquewhite: '#FAEBD7',
  aqua: '#00FFFF',
  aquamarine: '#7FFFD4',
  azure: '#F0FFFF',
  beige: '#F5F5DC',
  bisque: '#FFE4C4',
  black: '#000000',
  blanchedalmond: '#FFEBCD',
  blue: '#0000FF',
  blueviolet: '#8A2BE2',
  brown: '#A52A2A',
  burlywood: '#DEB887',
  cadetblue: '#5F9EA0',
  chartreuse: '#7FFF00',
  chocolate: '#D2691E',
  coral: '#FF7F50',
  cornflowerblue: '#6495ED',
  cornsilk: '#FFF8DC',
  crimson: '#DC143C',
  cyan: '#00FFFF',
  darkblue: '#00008B',
  darkcyan: '#008B8B',
  darkgoldenrod: '#B8860B',
  darkgray: '#A9A9A9',
  darkgrey: '#A9A9A9',
  darkgreen: '#006400',
  darkkhaki: '#BDB76B',
  darkmagenta: '#8B008B',
  darkolivegreen: '#556B2F',
  darkorange: '#FF8C00',
  darkorchid: '#9932CC',
  darkred: '#8B0000',
  darksalmon: '#E9967A',
  darkseagreen: '#8FBC8F',
  darkslateblue: '#483D8B',
  darkslategray: '#2F4F4F',
  darkslategrey: '#2F4F4F',
  darkturquoise: '#00CED1',
  darkviolet: '#9400D3',
  deeppink: '#FF1493',
  deepskyblue: '#00BFFF',
  dimgray: '#696969',
  dimgrey: '#696969',
  dodgerblue: '#1E90FF',
  firebrick: '#B22222',
  floralwhite: '#FFFAF0',
  forestgreen: '#228B22',
  fuchsia: '#FF00FF',
  gainsboro: '#DCDCDC',
  ghostwhite: '#F8F8FF',
  gold: '#FFD700',
  goldenrod: '#DAA520',
  gray: '#808080',
  grey: '#808080',
  green: '#008000',
  greenyellow: '#ADFF2F',
  honeydew: '#F0FFF0',
  hotpink: '#FF69B4',
  indianred: '#CD5C5C',
  indigo: '#4B0082',
  ivory: '#FFFFF0',
  khaki: '#F0E68C',
  lavender: '#E6E6FA',
  lavenderblush: '#FFF0F5',
  lawngreen: '#7CFC00',
  lemonchiffon: '#FFFACD',
  lightblue: '#ADD8E6',
  lightcoral: '#F08080',
  lightcyan: '#E0FFFF',
  lightgoldenrodyellow: '#FAFAD2',
  lightgray: '#D3D3D3',
  lightgrey: '#D3D3D3',
  lightgreen: '#90EE90',
  lightpink: '#FFB6C1',
  lightsalmon: '#FFA07A',
  lightseagreen: '#20B2AA',
  lightskyblue: '#87CEFA',
  lightslategray: '#778899',
  lightslategrey: '#778899',
  lightsteelblue: '#B0C4DE',
  lightyellow: '#FFFFE0',
  lime: '#00FF00',
  limegreen: '#32CD32',
  linen: '#FAF0E6',
  magenta: '#FF00FF',
  maroon: '#800000',
  mediumaquamarine: '#66CDAA',
  mediumblue: '#0000CD',
  mediumorchid: '#BA55D3',
  mediumpurple: '#9370DB',
  mediumseagreen: '#3CB371',
  mediumslateblue: '#7B68EE',
  mediumspringgreen: '#00FA9A',
  mediumturquoise: '#48D1CC',
  mediumvioletred: '#C71585',
  midnightblue: '#191970',
  mintcream: '#F5FFFA',
  mistyrose: '#FFE4E1',
  moccasin: '#FFE4B5',
  navajowhite: '#FFDEAD',
  navy: '#000080',
  oldlace: '#FDF5E6',
  olive: '#808000',
  olivedrab: '#6B8E23',
  orange: '#FFA500',
  orangered: '#FF4500',
  orchid: '#DA70D6',
  palegoldenrod: '#EEE8AA',
  palegreen: '#98FB98',
  paleturquoise: '#AFEEEE',
  palevioletred: '#DB7093',
  papayawhip: '#FFEFD5',
  peachpuff: '#FFDAB9',
  peru: '#CD853F',
  pink: '#FFC0CB',
  plum: '#DDA0DD',
  powderblue: '#B0E0E6',
  purple: '#800080',
  rebeccapurple: '#663399',
  red: '#FF0000',
  rosybrown: '#BC8F8F',
  royalblue: '#4169E1',
  saddlebrown: '#8B4513',
  salmon: '#FA8072',
  sandybrown: '#F4A460',
  seagreen: '#2E8B57',
  seashell: '#FFF5EE',
  sienna: '#A0522D',
  silver: '#C0C0C0',
  skyblue: '#87CEEB',
  slateblue: '#6A5ACD',
  slategray: '#708090',
  slategrey: '#708090',
  snow: '#FFFAFA',
  springgreen: '#00FF7F',
  steelblue: '#4682B4',
  tan: '#D2B48C',
  teal: '#008080',
  thistle: '#D8BFD8',
  tomato: '#FF6347',
  turquoise: '#40E0D0',
  violet: '#EE82EE',
  wheat: '#F5DEB3',
  white: '#FFFFFF',
  whitesmoke: '#F5F5F5',
  yellow: '#FFFF00',
  yellowgreen: '#9ACD32',
};

const LENGTH_UNITS = new Set([
  'em',
  'ex',
  'px',
  'in',
  'cm',
  'mm',
  'pt',
  'pc',
  'ch',
  'rem',
  'vw',
  'vh',
  'vmin',
  'vmax',
]);

const GENERIC_FAMILIES = new Set([
  'serif',
  'sans-serif',
  'monospace',
  'fantasy',
  'cursive',
]);

function enumOf(values: string[]): CssValidator {
  const valid = new Set(values);

  return (value) => {
    const lower = phpTrim(value).toLowerCase();

    return valid.has(lower) ? lower : null;
  };
}

function composite(...validators: CssValidator[]): CssValidator {
  return (value) => {
    for (const validator of validators) {
      const result = validator(value);

      if (result !== null) {
        return result;
      }
    }

    return null;
  };
}

/** AttrDef_CSS_Number */
function numberOf(nonNegative = false): CssValidator {
  return (raw) => {
    let number = parseCdata(raw);

    if (number === '') {
      return null;
    }

    if (number === '0') {
      return '0';
    }

    let sign = '';

    if (number[0] === '-') {
      if (nonNegative) {
        return null;
      }

      sign = '-';
      number = number.slice(1);
    } else if (number[0] === '+') {
      number = number.slice(1);
    }

    if (/^[0-9]+$/.test(number)) {
      const trimmed = number.replace(/^0+/, '');

      return trimmed !== '' ? sign + trimmed : '0';
    }

    if (!number.includes('.')) {
      return null;
    }

    const dot = number.indexOf('.');
    let left = number.slice(0, dot);
    const right = number.slice(dot + 1).replace(/0+$/, '');

    if (number.slice(dot + 1) === '' && left === '') {
      return null;
    }

    if (left !== '' && !/^[0-9]+$/.test(left)) {
      return null;
    }

    left = left.replace(/^0+/, '') !== '' ? left.replace(/^0+/, '') : '0';

    if (right === '') {
      return sign + left;
    }

    if (!/^[0-9]+$/.test(right)) {
      return null;
    }

    return `${sign}${left}.${right}`;
  };
}

/** AttrDef_CSS_Percentage */
function percentageOf(nonNegative = false): CssValidator {
  const number = numberOf(nonNegative);

  return (raw) => {
    const value = parseCdata(raw);

    if (value.length <= 1 || !value.endsWith('%')) {
      return null;
    }

    const result = number(value.slice(0, -1));

    return result === null ? null : `${result}%`;
  };
}

/** AttrDef_CSS_Length with an optional "non-negative" lower bound of 0. */
function lengthOf(nonNegative = false): CssValidator {
  const number = numberOf();

  return (raw) => {
    const value = parseCdata(raw);

    if (value === '') {
      return null;
    }

    if (value === '0') {
      return '0';
    }

    if (value.length === 1) {
      return null;
    }

    const split = /^[0-9.+-]*/.exec(value)?.[0].length ?? 0;
    let amount = value.slice(0, split);
    const unit = value.slice(split);

    if (amount === '+0' || amount === '-0') {
      amount = '0';
    }

    if (amount === '0' && unit === '') {
      return '0';
    }

    const lowerUnit = unit.toLowerCase();

    if (!LENGTH_UNITS.has(lowerUnit)) {
      return null;
    }

    const normalised = number(amount);

    if (normalised === null) {
      return null;
    }

    if (nonNegative && normalised.startsWith('-')) {
      return null;
    }

    return normalised + lowerUnit;
  };
}

/** AttrDef_CSS_Color */
function color(raw: string): string | null {
  let value = phpTrim(raw);

  if (value === '') {
    return null;
  }

  const keyword = COLOR_KEYWORDS[value.toLowerCase()];

  if (keyword !== undefined) {
    return keyword;
  }

  const functionMatch = /(rgb|rgba|hsl|hsla)\(/.exec(value);

  if (functionMatch !== null) {
    return colorFunction(value, functionMatch[1]);
  }

  let hex = value;

  if (value[0] === '#') {
    hex = value.slice(1);
  } else {
    value = `#${value}`;
  }

  if ((hex.length !== 3 && hex.length !== 6) || !/^[0-9a-f]+$/i.test(hex)) {
    return null;
  }

  return value;
}

function colorFunction(value: string, fn: string): string | null {
  if (value.indexOf(')') !== value.length - 1) {
    return null;
  }

  const hasAlpha = fn.endsWith('a');
  const parametersSize = hasAlpha ? 4 : 3;
  const isHsl = fn.includes('hsl');
  const maximum = (position: number, type: string): number | null => {
    if (isHsl) {
      if (position === 1) {
        return type === 'integer' ? 360 : null;
      }

      return type === 'percentage' ? 100 : null;
    }

    return type === 'percentage' ? 100 : 255;
  };
  const inner = value
    .split(fn)
    .join('')
    .replace(/^[ ()]+|[ ()]+$/g, '');
  const parts = inner.split(',');

  if (parts.length !== parametersSize) {
    return null;
  }

  let firstType: string | null = null;
  const newParts: string[] = [];

  for (const [index, rawPart] of parts.entries()) {
    const position = index + 1;
    const part = phpTrim(rawPart);

    if (part === '') {
      return null;
    }

    if (hasAlpha && position === parts.length) {
      const alpha = numberOf()(part);

      if (alpha === null) {
        return null;
      }

      const numeric = Number(alpha);

      newParts.push(numeric > 1 ? '1' : numeric < 0 ? '0' : alpha);
      continue;
    }

    const type = part.endsWith('%') ? 'percentage' : 'integer';
    const limit = maximum(position, type);

    if (limit === null) {
      return null;
    }

    firstType ??= type;

    if (!isHsl && firstType !== type) {
      return null;
    }

    const numeric = Number(type === 'percentage' ? part.slice(0, -1) : part);

    if (Number.isNaN(numeric)) {
      return null;
    }

    const clamped = Math.max(Math.min(numeric, limit), 0);

    newParts.push(
      type === 'integer' ? String(Math.trunc(clamped)) : `${clamped}%`,
    );
  }

  return `${fn}(${newParts.join(',')})`;
}

/** AttrDef_CSS_TextDecoration */
function textDecoration(raw: string): string | null {
  const value = parseCdata(raw).toLowerCase();

  if (value === 'none') {
    return value;
  }

  const kept = value
    .split(' ')
    .filter((part) => ['line-through', 'overline', 'underline'].includes(part));

  return kept.length === 0 ? null : kept.join(' ');
}

/** AttrDef_CSS_FontFamily (default: no CSS.AllowedFonts). */
function fontFamily(raw: string): string | null {
  let final = '';

  for (const entry of raw.split(',')) {
    let font = phpTrim(entry);

    if (font === '') {
      continue;
    }

    if (GENERIC_FAMILIES.has(font)) {
      final += `${font}, `;
      continue;
    }

    if (font[0] === '"' || font[0] === "'") {
      if (font.length <= 2 || font[font.length - 1] !== font[0]) {
        continue;
      }

      font = font.slice(1, -1);
    }

    font = expandCssEscape(font);

    if (/^[A-Za-z0-9]+$/.test(font)) {
      final += `${font}, `;
      continue;
    }

    font = font.replace(/[\n\t\r\f]/g, ' ');

    if (!/^[A-Za-z0-9_\- \u0080-￿]*$/u.test(font) || font === '') {
      continue;
    }

    final += `'${font}', `;
  }

  final = final.replace(/[, ]+$/, '');

  return final === '' ? null : final;
}

/** AttrDef::expandCSSEscape: `\41 ` style escapes become characters. */
function expandCssEscape(value: string): string {
  let result = '';
  let index = 0;

  while (index < value.length) {
    if (value[index] !== '\\') {
      result += value[index];
      index += 1;
      continue;
    }

    index += 1;

    if (index >= value.length) {
      result += '\\';
      break;
    }

    if (/[0-9a-f]/i.test(value[index])) {
      let code = value[index];
      index += 1;

      for (let count = 1; index < value.length && count < 6; index++, count++) {
        if (!/[0-9a-f]/i.test(value[index])) {
          break;
        }

        code += value[index];
      }

      const codePoint = parseInt(code, 16);

      if (
        codePoint > 0x10ffff ||
        (codePoint >= 0xd800 && codePoint <= 0xdfff) ||
        codePoint === 0
      ) {
        continue;
      }

      result += String.fromCodePoint(codePoint);

      if (index < value.length && phpTrim(value[index]) !== '') {
        index -= 1;
      }

      index += 1;
      continue;
    }

    if (value[index] === '\n') {
      index += 1;
      continue;
    }

    result += value[index];
    index += 1;
  }

  return result;
}

const fontSize = composite(
  enumOf([
    'xx-small',
    'x-small',
    'small',
    'medium',
    'large',
    'x-large',
    'xx-large',
    'larger',
    'smaller',
  ]),
  percentageOf(),
  lengthOf(),
);
const fontStyle = enumOf(['normal', 'italic', 'oblique']);
const fontVariant = enumOf(['normal', 'small-caps']);
const fontWeight = enumOf([
  'normal',
  'bold',
  'bolder',
  'lighter',
  '100',
  '200',
  '300',
  '400',
  '500',
  '600',
  '700',
  '800',
  '900',
]);
const lineHeight = composite(
  enumOf(['normal']),
  numberOf(true),
  lengthOf(true),
  percentageOf(true),
);
const SYSTEM_FONTS = new Set([
  'caption',
  'icon',
  'menu',
  'message-box',
  'small-caption',
  'status-bar',
]);

/** AttrDef_CSS_Font (the `font` shorthand). */
function fontShorthand(raw: string): string | null {
  const value = parseCdata(raw);

  if (value === '') {
    return null;
  }

  if (SYSTEM_FONTS.has(value.toLowerCase())) {
    return value.toLowerCase();
  }

  const bits = value.split(' ');
  const stageOneValidators: Array<[string, CssValidator]> = [
    ['font-style', fontStyle],
    ['font-variant', fontVariant],
    ['font-weight', fontWeight],
  ];
  const caught = new Set<string>();
  let stage = 0;
  let final = '';

  for (let index = 0; index < bits.length; index++) {
    if (bits[index] === '') {
      continue;
    }

    if (stage === 0) {
      let result: string | null = null;

      for (const [name, validator] of stageOneValidators) {
        if (caught.has(name)) {
          continue;
        }

        result = validator(bits[index]);

        if (result !== null) {
          final += `${result} `;
          caught.add(name);
          break;
        }
      }

      if (caught.size >= 3) {
        stage = 1;
      }

      if (result !== null) {
        continue;
      }
    }

    if (stage <= 1) {
      let foundSlash = false;
      let sizeBit = bits[index];
      let heightBit: string | null = null;

      if (bits[index].includes('/')) {
        const [size, height] = bits[index].split('/');

        sizeBit = size;

        if (height === '') {
          foundSlash = true;
        } else {
          heightBit = height;
        }
      }

      const sizeResult = fontSize(sizeBit);

      if (sizeResult === null) {
        return null;
      }

      final += sizeResult;

      let cursor = bits.length;

      if (heightBit === null) {
        for (let ahead = index + 1; ahead < bits.length; ahead++) {
          if (bits[ahead] === '') {
            continue;
          }

          if (bits[ahead] === '/') {
            if (foundSlash) {
              return null;
            }

            foundSlash = true;
            continue;
          }

          heightBit = bits[ahead];
          cursor = ahead;
          break;
        }
      } else {
        foundSlash = true;
        cursor = index;
      }

      if (foundSlash) {
        index = cursor;
        const heightResult = heightBit === null ? null : lineHeight(heightBit);

        if (heightResult !== null) {
          final += `/${heightResult}`;
        }
      }

      final += ' ';
      stage = 2;
      continue;
    }

    const family = fontFamily(bits.slice(index).join(' '));

    return family === null ? null : `${final}${family}`;
  }

  return null;
}

const PROPERTY_VALIDATORS: Record<string, CssValidator> = {
  'text-align': enumOf(['left', 'right', 'center', 'justify']),
  'font-style': fontStyle,
  'font-weight': fontWeight,
  'font-size': fontSize,
  'font-family': fontFamily,
  font: fontShorthand,
  'text-decoration': textDecoration,
  'padding-left': composite(lengthOf(true), percentageOf(true)),
  color,
  'background-color': composite(enumOf(['transparent']), color),
};

const UNIVERSAL_VALUES = enumOf(['initial', 'inherit', 'unset']);

/** ImportantDecorator with `CSS.AllowImportant` off: `!important` is dropped. */
function stripImportant(raw: string): string {
  let value = phpTrim(raw);

  if (value.length >= 9 && value.endsWith('important')) {
    const rest = value.slice(0, -9).replace(/[ \t\n\r\0\v]+$/, '');

    if (rest.length >= 1 && rest.endsWith('!')) {
      value = rest.slice(0, -1).replace(/[ \t\n\r\0\v]+$/, '');
    }
  }

  return value;
}

/** AttrDef_CSS: splits at top-level `;` (quotes protect semicolons). */
function splitDeclarations(css: string): string[] {
  const declarations: string[] = [];
  let accumulated = '';
  let quote: string | null = null;

  for (const char of css) {
    if (quote !== null) {
      accumulated += char;

      if (char === quote) {
        quote = null;
      }

      continue;
    }

    if (char === ';') {
      declarations.push(accumulated);
      accumulated = '';
    } else {
      accumulated += char;

      if (char === "'" || char === '"') {
        quote = char;
      }
    }
  }

  if (accumulated !== '') {
    declarations.push(accumulated);
  }

  return declarations;
}

/**
 * Validates a `style` attribute value, keeping only `allowedProperties`.
 * Returns `prop:value;prop:value;` or an empty string (attribute dropped).
 */
export function sanitizeCssDeclarations(
  css: string,
  allowedProperties: ReadonlySet<string>,
): string {
  const values = new Map<string, string>();

  for (const declaration of splitDeclarations(parseCdata(css))) {
    const colon = declaration.indexOf(':');

    if (declaration === '' || colon <= 0) {
      continue;
    }

    const property = phpTrim(declaration.slice(0, colon)).toLowerCase();
    const value = phpTrim(declaration.slice(colon + 1));
    const validator = Object.hasOwn(PROPERTY_VALIDATORS, property)
      ? PROPERTY_VALIDATORS[property]
      : undefined;

    if (validator === undefined || !allowedProperties.has(property)) {
      continue;
    }

    const result = UNIVERSAL_VALUES(value) ?? validator(stripImportant(value));

    if (result !== null) {
      values.set(property, result);
    }
  }

  return [...values]
    .map(([property, value]) => `${property}:${value};`)
    .join('');
}

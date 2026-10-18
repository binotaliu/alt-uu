/**
 * Accent palettes ported from the legacy Tailwind v4 `@theme` / `html[data-accent]`
 * blocks (resources/css/app.css). oklch values are pre-converted to sRGB hex
 * because React Native has no oklch support. `warm` is the default accent.
 */
export const accentNames = [
  'warm',
  'ocean',
  'forest',
  'purple',
  'pink',
  'red',
  'grey',
] as const;

export type AccentName = (typeof accentNames)[number];

export type ThemeShade =
  '50' | '100' | '200' | '300' | '400' | '500' | '600' | '700' | '800' | '900';

export const accentPalettes: Record<AccentName, Record<ThemeShade, string>> = {
  warm: {
    '50': '#fff6f3',
    '100': '#ffeee8',
    '200': '#ffe0d4',
    '300': '#ffc9b5',
    '400': '#ffa282',
    '500': '#f28058',
    '600': '#db684c',
    '700': '#a64831',
    '800': '#833e2d',
    '900': '#5d291c',
  },
  ocean: {
    '50': '#f2fafe',
    '100': '#e5f5fd',
    '200': '#ceeefe',
    '300': '#a8e1fd',
    '400': '#60ccfc',
    '500': '#00b4f0',
    '600': '#009bdd',
    '700': '#0072a8',
    '800': '#005d84',
    '900': '#00405e',
  },
  forest: {
    '50': '#f4faf5',
    '100': '#e9f6eb',
    '200': '#d6f0da',
    '300': '#b7e5bf',
    '400': '#83d494',
    '500': '#53be70',
    '600': '#4aa651',
    '700': '#2e7c35',
    '800': '#2c6330',
    '900': '#1b451e',
  },
  purple: {
    '50': '#f9f7fe',
    '100': '#f4effe',
    '200': '#ece2ff',
    '300': '#deceff',
    '400': '#caacff',
    '500': '#b48df4',
    '600': '#977ae0',
    '700': '#6f57ab',
    '800': '#5a4886',
    '900': '#3e315f',
  },
  pink: {
    '50': '#fef6f9',
    '100': '#fdedf3',
    '200': '#fedeeb',
    '300': '#ffc2dd',
    '400': '#ff8fca',
    '500': '#fc65b6',
    '600': '#e24ea2',
    '700': '#ab3378',
    '800': '#873061',
    '900': '#5e2043',
  },
  red: {
    '50': '#fff6f5',
    '100': '#ffedeb',
    '200': '#ffdedb',
    '300': '#ffc4bd',
    '400': '#ff9891',
    '500': '#fd7371',
    '600': '#e45c5e',
    '700': '#af3c40',
    '800': '#8c3436',
    '900': '#612324',
  },
  grey: {
    '50': '#f7f8fa',
    '100': '#f0f2f4',
    '200': '#e5e8eb',
    '300': '#d4d8dd',
    '400': '#b8bec5',
    '500': '#9ea6ae',
    '600': '#889098',
    '700': '#636a70',
    '800': '#51565b',
    '900': '#373b3f',
  },
};

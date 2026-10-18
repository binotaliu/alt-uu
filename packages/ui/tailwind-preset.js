/**
 * NativeWind / Tailwind v3 preset shared by every app. The `theme-*` shades
 * resolve to CSS variables that `ThemeProvider` sets from the active accent
 * palette (see src/theme/palettes.ts), mirroring the legacy `data-accent`
 * switching. Dark mode is class based so the Appearance preference can
 * override the system scheme (ThemeProvider calls nativewind `colorScheme.set`).
 */
const shades = [
  '50',
  '100',
  '200',
  '300',
  '400',
  '500',
  '600',
  '700',
  '800',
  '900',
];

/** @type {Partial<import('tailwindcss').Config>} */
module.exports = {
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        theme: Object.fromEntries(
          shades.map((shade) => [shade, `var(--color-theme-${shade})`]),
        ),
      },
    },
  },
};

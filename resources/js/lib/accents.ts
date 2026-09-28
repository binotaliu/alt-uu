export const ACCENTS = [
    { id: 'warm', label: '暖橘', swatch: 'oklch(0.72 0.15 40)' },
    { id: 'ocean', label: '海藍', swatch: 'oklch(0.72 0.15 230)' },
    { id: 'forest', label: '森綠', swatch: 'oklch(0.72 0.15 150)' },
    { id: 'purple', label: '皇紫', swatch: 'oklch(0.72 0.15 300)' },
    { id: 'pink', label: '粉紅', swatch: 'oklch(0.72 0.2 350)' },
    { id: 'red', label: '緋紅', swatch: 'oklch(0.72 0.17 23)' },
    { id: 'grey', label: '銀灰', swatch: 'oklch(0.72 0.015 250)' },
] as const;

export type AccentId = (typeof ACCENTS)[number]['id'];

export const DEFAULT_ACCENT: AccentId = 'warm';

export function isAccentId(value: unknown): value is AccentId {
    return ACCENTS.some((accent) => accent.id === value);
}

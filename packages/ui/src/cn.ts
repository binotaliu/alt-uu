import { twMerge } from 'tailwind-merge';

/**
 * Joins class names and drops earlier ones that a later one overrides
 * (`cn('p-4', 'p-0')` → `'p-0'`). NativeWind resolves conflicts by stylesheet
 * order, not by position in `className`, so merge before rendering.
 */
export function cn(...classes: (string | false | null | undefined)[]): string {
  return twMerge(classes.filter(Boolean).join(' '));
}

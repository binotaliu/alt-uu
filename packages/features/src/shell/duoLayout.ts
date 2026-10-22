import type { ReservedRegion } from '@altuu/attachment-bridge';
import { NOT_FOLDABLE, type DuoLayout } from '@altuu/ui';

/**
 * Shortest window side from which the iPhone Duo inner display is assumed; the outer
 * display is a phone-sized screen below it. No API names the display, so this is a size
 * heuristic to confirm in the Device Hub simulator.
 */
export const INNER_DISPLAY_MIN_SHORT_SIDE = 500;

/** Maps the native fold / camera regions and the window size to the layout flags. */
export function deriveDuoLayout(
  regions: readonly ReservedRegion[],
  window: { width: number; height: number },
): DuoLayout {
  const divisions = regions.filter((region) => region.kind === 'division');

  if (divisions.length === 0) {
    return NOT_FOLDABLE;
  }

  const fold = divisions.find((region) => region.active) ?? null;
  const display =
    Math.min(window.width, window.height) >= INNER_DISPLAY_MIN_SHORT_SIDE
      ? 'inner'
      : 'outer';

  return {
    isFoldable: true,
    display,
    foldFrame: fold ? fold.frame : null,
    foldAxis: fold
      ? fold.frame.height >= fold.frame.width
        ? 'vertical'
        : 'horizontal'
      : null,
    sideBar:
      display === 'outer' ||
      (display === 'inner' && window.width > window.height),
  };
}

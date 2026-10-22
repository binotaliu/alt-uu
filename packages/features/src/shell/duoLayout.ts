import type { ReservedRegion } from '@altuu/attachment-bridge';
import { NOT_FOLDABLE, type DuoLayout } from '@altuu/ui';

/**
 * Shortest window side from which the iPhone Duo inner display is assumed; the outer
 * display is a phone-sized screen below it. No API names the display, so this is a size
 * heuristic to confirm in the Device Hub simulator.
 */
export const INNER_DISPLAY_MIN_SHORT_SIDE = 500;

/** Camera cut-outs are about 37 pt thick; the outer display's status strip is 84. */
const MIN_STATUS_STRIP_THICKNESS = 60;

/** Maps the native fold / camera regions and the window size to the layout flags. */
export function deriveDuoLayout(
  regions: readonly ReservedRegion[],
  window: { width: number; height: number },
): DuoLayout {
  const divisions = regions.filter((region) => region.kind === 'division');

  // The closed outer display reports no division, only camera occlusions: a small one per
  // camera and a large one flush with a window edge where the status area sits (the
  // trailing edge in portrait, another edge when rotated). Nothing else on an iPhone
  // reports a region that thick, so it identifies the outer display.
  const hasStatusStrip = regions.some(
    ({ kind, frame }) =>
      kind === 'occlusion' &&
      Math.min(frame.width, frame.height) >= MIN_STATUS_STRIP_THICKNESS &&
      (frame.x <= 1 ||
        frame.y <= 1 ||
        frame.x + frame.width >= window.width - 1 ||
        frame.y + frame.height >= window.height - 1),
  );

  if (divisions.length === 0 && !hasStatusStrip) {
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

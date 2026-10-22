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

/**
 * The status area sits in a block at one corner and the bar shares that edge, so the bar
 * goes on that side and stays clear of the block. Rotating the device moves the block.
 */
function barPlacement(
  strip: ReservedRegion['frame'] | undefined,
  window: { width: number; height: number },
): Pick<DuoLayout, 'barEdge' | 'barWidth' | 'barClearance'> {
  if (!strip) {
    const { barEdge, barWidth, barClearance } = NOT_FOLDABLE;

    return { barEdge, barWidth, barClearance };
  }

  const onLeft = strip.x <= 1;
  const atTop = strip.y + strip.height / 2 < window.height / 2;
  const tall = strip.height > window.height * 0.5;
  const clearance =
    tall || strip.width >= window.width * 0.5
      ? 0
      : atTop
        ? strip.y + strip.height + 8
        : window.height - strip.y + 8;

  return {
    barEdge: onLeft ? 'left' : 'right',
    barWidth: strip.width,
    barClearance: {
      top: atTop ? clearance : 0,
      bottom: atTop ? 0 : clearance,
    },
  };
}

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
  const statusStrip = regions.find(
    ({ kind, frame }) =>
      kind === 'occlusion' &&
      Math.min(frame.width, frame.height) >= MIN_STATUS_STRIP_THICKNESS &&
      (frame.x <= 1 ||
        frame.y <= 1 ||
        frame.x + frame.width >= window.width - 1 ||
        frame.y + frame.height >= window.height - 1),
  );

  if (divisions.length === 0 && !statusStrip) {
    return NOT_FOLDABLE;
  }

  const fold = divisions.find((region) => region.active) ?? null;
  const display =
    Math.min(window.width, window.height) >= INNER_DISPLAY_MIN_SHORT_SIDE
      ? 'inner'
      : 'outer';

  const bar = barPlacement(statusStrip?.frame, window);

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
    ...bar,
  };
}

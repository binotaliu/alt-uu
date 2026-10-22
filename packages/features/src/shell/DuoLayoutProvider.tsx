import {
  addFoldChangeListener,
  getReservedRegions,
} from '@altuu/attachment-bridge';
import { DuoLayoutContext, NOT_FOLDABLE, type DuoLayout } from '@altuu/ui';
import { useEffect, useState, type ReactNode } from 'react';
import { useWindowDimensions } from 'react-native';

import { deriveDuoLayout } from './duoLayout';

function isSameLayout(a: DuoLayout, b: DuoLayout): boolean {
  return (
    a.isFoldable === b.isFoldable &&
    a.display === b.display &&
    a.foldAxis === b.foldAxis &&
    a.sideBar === b.sideBar &&
    a.barEdge === b.barEdge &&
    a.barWidth === b.barWidth &&
    a.barClearance.top === b.barClearance.top &&
    a.barClearance.bottom === b.barClearance.bottom &&
    a.foldFrame?.x === b.foldFrame?.x &&
    a.foldFrame?.y === b.foldFrame?.y &&
    a.foldFrame?.width === b.foldFrame?.width &&
    a.foldFrame?.height === b.foldFrame?.height
  );
}

/**
 * The hinge event can arrive before UIKit has updated the fold region's `active` flag, so a
 * single read right then returns the previous fold state. Reading again at these delays
 * (ms after the event or resize) picks up the settled state; unchanged layouts are ignored.
 */
export const FOLD_SETTLE_DELAYS_MS = [0, 100, 250, 500, 1000];

/**
 * Feeds the iPhone Duo fold state to the layouts. Rotating resizes the window, so the
 * regions are read again then (also at the settle delays). Folding or unfolding does not resize it (the fold region
 * just turns active), so the native hinge event triggers a read too. Other devices report
 * no regions and never emit the event.
 */
export function DuoLayoutProvider({ children }: { children: ReactNode }) {
  const { width, height } = useWindowDimensions();
  const [layout, setLayout] = useState(NOT_FOLDABLE);

  useEffect(() => {
    let cancelled = false;

    const read = () => {
      void getReservedRegions().then((regions) => {
        if (!cancelled) {
          const next = deriveDuoLayout(regions, { width, height });

          setLayout((previous) =>
            isSameLayout(previous, next) ? previous : next,
          );
        }
      });
    };

    let settleTimers: ReturnType<typeof setTimeout>[] = [];
    const readSettling = () => {
      settleTimers.forEach(clearTimeout);
      settleTimers = FOLD_SETTLE_DELAYS_MS.map((delay) =>
        setTimeout(read, delay),
      );
    };

    // Rotation can resize the window before UIKit has moved the status-area region, so
    // the first read may still hold the previous orientation's geometry.
    read();
    readSettling();
    const subscription = addFoldChangeListener(readSettling);

    return () => {
      cancelled = true;
      settleTimers.forEach(clearTimeout);
      subscription.remove();
    };
  }, [width, height]);

  return (
    <DuoLayoutContext.Provider value={layout}>
      {children}
    </DuoLayoutContext.Provider>
  );
}

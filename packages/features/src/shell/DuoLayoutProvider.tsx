import { getReservedRegions } from '@altuu/attachment-bridge';
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

/** How often a foldable's regions are read again: fold changes send no JS event. */
export const FOLD_POLL_INTERVAL_MS = 400;

/**
 * Feeds the iPhone Duo fold state to the layouts. Rotating resizes the window, so the
 * regions are read again then. Folding or unfolding does not resize it (the fold region
 * just turns active), and nothing notifies JS, so on a foldable the regions are also
 * polled. Other devices report no regions and are never polled.
 */
export function DuoLayoutProvider({ children }: { children: ReactNode }) {
  const { width, height } = useWindowDimensions();
  const [layout, setLayout] = useState(NOT_FOLDABLE);
  const isFoldable = layout.isFoldable;

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

    read();
    const timer = isFoldable ? setInterval(read, FOLD_POLL_INTERVAL_MS) : null;

    return () => {
      cancelled = true;

      if (timer) {
        clearInterval(timer);
      }
    };
  }, [width, height, isFoldable]);

  return (
    <DuoLayoutContext.Provider value={layout}>
      {children}
    </DuoLayoutContext.Provider>
  );
}

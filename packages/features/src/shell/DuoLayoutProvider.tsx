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

/**
 * Feeds the iPhone Duo fold state to the layouts. Folding, unfolding and rotating
 * resize the window, so the regions are read again whenever its size does.
 */
export function DuoLayoutProvider({ children }: { children: ReactNode }) {
  const { width, height } = useWindowDimensions();
  const [layout, setLayout] = useState(NOT_FOLDABLE);

  useEffect(() => {
    let cancelled = false;

    void getReservedRegions().then((regions) => {
      if (!cancelled) {
        const next = deriveDuoLayout(regions, { width, height });

        setLayout((previous) =>
          isSameLayout(previous, next) ? previous : next,
        );
      }
    });

    return () => {
      cancelled = true;
    };
  }, [width, height]);

  return (
    <DuoLayoutContext.Provider value={layout}>
      {children}
    </DuoLayoutContext.Provider>
  );
}

import { getCornerInsets } from '@altuu/attachment-bridge';
import { CornerInsetsContext, type CornerInsets } from '@altuu/ui';
import { useEffect, useState, type ReactNode } from 'react';
import { useWindowDimensions } from 'react-native';

const NO_CORNER_INSETS: CornerInsets = { top: 0, right: 0, bottom: 0, left: 0 };

/**
 * Feeds the iPadOS 26 window-control margins to the headers (legacy
 * `--corner-inset-*`). They change with the window, so they are read again
 * whenever its size does.
 */
export function CornerInsetsProvider({ children }: { children: ReactNode }) {
  const { width, height } = useWindowDimensions();
  const [insets, setInsets] = useState(NO_CORNER_INSETS);

  useEffect(() => {
    let cancelled = false;

    void getCornerInsets().then((next) => {
      if (!cancelled) {
        setInsets((previous) =>
          previous.top === next.top &&
          previous.right === next.right &&
          previous.bottom === next.bottom &&
          previous.left === next.left
            ? previous
            : next,
        );
      }
    });

    return () => {
      cancelled = true;
    };
  }, [width, height]);

  return (
    <CornerInsetsContext.Provider value={insets}>
      {children}
    </CornerInsetsContext.Provider>
  );
}

import { useState, type ReactNode } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';

import { useDuoLayout } from '../responsive';

export interface FoldSplitProps {
  /** Left pane for a vertical fold, top pane for a horizontal one. */
  first: ReactNode;
  /** Right pane for a vertical fold, bottom pane for a horizontal one. */
  second: ReactNode;
  className?: string;
}

/**
 * Two panes with the folded iPhone Duo's hinge between them. Interactive content must not
 * cross the fold (Apple: reserved regions, `.division`): each pane ends at the fold and
 * the screen background shows through the gap. Render it only while `useDuoLayout`
 * reports a `foldFrame`.
 *
 * The fold frame is in window coordinates, so the container's own offset in the window is
 * measured and subtracted: safe-area padding above it would otherwise skew the panes.
 */
export function FoldSplit({ first, second, className }: FoldSplitProps) {
  const { foldFrame, foldAxis } = useDuoLayout();
  const [origin, setOrigin] = useState({ x: 0, y: 0 });

  if (!foldFrame || !foldAxis) {
    return null;
  }

  const onLayout = (event: LayoutChangeEvent) => {
    const target = event.currentTarget;

    if (typeof target === 'number') {
      return;
    }

    target.measureInWindow((x: number, y: number) => {
      setOrigin((previous) =>
        previous.x === x && previous.y === y ? previous : { x, y },
      );
    });
  };

  const vertical = foldAxis === 'vertical';
  const firstSize = Math.max(
    0,
    vertical ? foldFrame.x - origin.x : foldFrame.y - origin.y,
  );
  const gap = vertical ? foldFrame.width : foldFrame.height;

  return (
    <View
      testID="fold-split"
      onLayout={onLayout}
      className={`flex-1 ${vertical ? 'flex-row' : 'flex-col'} ${className ?? ''}`}
    >
      <View
        testID="fold-split-first"
        style={vertical ? { width: firstSize } : { height: firstSize }}
      >
        {first}
      </View>
      <View style={vertical ? { width: gap } : { height: gap }} />
      <View testID="fold-split-second" className="min-h-0 min-w-0 flex-1">
        {second}
      </View>
    </View>
  );
}

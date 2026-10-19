import { BottomSheet } from '@altuu/ui';

import {
  MaterialDirectory,
  type MaterialDirectoryProps,
} from '../courses/MaterialDirectory';

export interface MaterialDirectorySheetProps extends Pick<
  MaterialDirectoryProps,
  | 'selectedCid'
  | 'nodes'
  | 'isLoading'
  | 'activeNodeIdentifier'
  | 'lastSeenIdentifier'
  | 'lastSeenPositionSeconds'
  | 'lastSeenDurationSeconds'
> {
  visible: boolean;
  onClose: () => void;
  onNodeSelect: (identifier: string) => void;
}

/**
 * Bottom sheet with the material directory, for windows narrower than the
 * tablet breakpoint where the screen has no sidebar.
 */
export function MaterialDirectorySheet({
  visible,
  onClose,
  onNodeSelect,
  ...directory
}: MaterialDirectorySheetProps) {
  return (
    <BottomSheet visible={visible} onClose={onClose} title="切換教材">
      <MaterialDirectory
        {...directory}
        scrollTarget="active"
        onNodeSelect={(identifier) => {
          onClose();
          onNodeSelect(identifier);
        }}
      />
    </BottomSheet>
  );
}

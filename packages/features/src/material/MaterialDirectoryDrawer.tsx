import { Text } from '@altuu/ui';
import { Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  MaterialDirectory,
  type MaterialDirectoryProps,
} from '../courses/MaterialDirectory';

export interface MaterialDirectoryDrawerProps extends Pick<
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
 * Bottom sheet (iOS style) with the material directory, for windows narrower
 * than the tablet breakpoint where the screen has no sidebar.
 */
export function MaterialDirectoryDrawer({
  visible,
  onClose,
  onNodeSelect,
  ...directory
}: MaterialDirectoryDrawerProps) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
      navigationBarTranslucent
      supportedOrientations={[
        'portrait',
        'landscape',
        'landscape-left',
        'landscape-right',
      ]}
    >
      <View className="flex-1 justify-end bg-black/40">
        <Pressable
          accessibilityLabel="關閉"
          className="absolute inset-0"
          onPress={onClose}
        />
        <View
          testID="material-directory-drawer"
          className="h-[85%] w-full max-w-2xl self-center overflow-hidden rounded-t-3xl bg-white dark:bg-zinc-900"
          style={{
            paddingBottom: Math.max(insets.bottom, 8),
            paddingLeft: insets.left,
            paddingRight: insets.right,
          }}
        >
          <View className="items-center pb-1 pt-2">
            <View className="h-1 w-10 rounded-full bg-theme-200 dark:bg-zinc-600" />
          </View>
          <Text className="px-4 pb-2 pt-1 text-center text-base font-semibold text-theme-900 dark:text-zinc-100">
            切換教材
          </Text>
          <MaterialDirectory
            {...directory}
            onNodeSelect={(identifier) => {
              onClose();
              onNodeSelect(identifier);
            }}
          />
        </View>
      </View>
    </Modal>
  );
}

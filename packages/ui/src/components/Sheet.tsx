import type { ReactNode } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export interface SheetProps {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  /** `bottom` (default) is a bottom sheet; `center` is a centred dialog. */
  placement?: 'bottom' | 'center';
  /** Tapping the backdrop closes the sheet (default true). */
  dismissOnBackdrop?: boolean;
  className?: string;
}

/**
 * Backdrop + card in a native Modal, shared by the picker, dialogs and the
 * What's new sheet (legacy fixed `inset-0 bg-black/40` overlays).
 */
export function Sheet({
  visible,
  onClose,
  children,
  placement = 'bottom',
  dismissOnBackdrop = true,
  className,
}: SheetProps) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
      navigationBarTranslucent
    >
      <View
        className={`flex-1 bg-black/40 p-4 ${placement === 'bottom' ? 'justify-end' : 'justify-center'}`}
        style={{ paddingBottom: Math.max(insets.bottom, 16) }}
      >
        <Pressable
          accessibilityLabel="關閉"
          className="absolute inset-0"
          onPress={dismissOnBackdrop ? onClose : undefined}
        />
        <View
          className={`w-full max-w-sm self-center overflow-hidden rounded-2xl bg-white dark:bg-zinc-900 ${className ?? ''}`}
        >
          {children}
        </View>
      </View>
    </Modal>
  );
}

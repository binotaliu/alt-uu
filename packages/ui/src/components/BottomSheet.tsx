import { useEffect, useState, type ReactNode } from 'react';
import { Modal, Pressable, View, useWindowDimensions } from 'react-native';
import {
  GestureDetector,
  GestureHandlerRootView,
  usePanGesture,
} from 'react-native-gesture-handler';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { Text } from './Text';

export interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Centered title under the grabber; also part of the drag handle. */
  title?: string;
  /** Sheet height as a share of the window height (default 0.85). */
  heightRatio?: number;
  /** Tapping the backdrop closes the sheet (default true). */
  dismissOnBackdrop?: boolean;
  /** Extra classes for the sheet card, e.g. a different `max-w-*`. */
  className?: string;
}

const OPEN_DURATION_MS = 300;
const CLOSE_DURATION_MS = 220;
/** Share of the sheet height dragged down that dismisses it. */
const DISMISS_DRAG_RATIO = 0.25;
/** Downward fling speed (points / second) that dismisses it. */
const DISMISS_VELOCITY = 800;

/**
 * iOS-style modal bottom sheet: slides up, dims the backdrop, and is dragged
 * down to dismiss by its grabber / title area (the body stays free for
 * scrolling content). Built on gesture-handler + reanimated inside a native
 * Modal, so it has its own `GestureHandlerRootView`.
 */
export function BottomSheet({
  visible,
  onClose,
  children,
  title,
  heightRatio = 0.85,
  dismissOnBackdrop = true,
  className,
}: BottomSheetProps) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const sheetHeight = windowHeight * heightRatio;
  // Stays mounted while the close animation runs.
  const [mounted, setMounted] = useState(visible);
  const translateY = useSharedValue(sheetHeight);

  if (visible && !mounted) {
    setMounted(true);
  }

  useEffect(() => {
    if (!mounted) {
      return;
    }

    if (visible) {
      translateY.set(
        withTiming(0, {
          duration: OPEN_DURATION_MS,
          easing: Easing.out(Easing.cubic),
        }),
      );

      return;
    }

    translateY.set(
      withTiming(
        sheetHeight,
        { duration: CLOSE_DURATION_MS, easing: Easing.in(Easing.cubic) },
        (finished) => {
          if (finished) {
            scheduleOnRN(setMounted, false);
          }
        },
      ),
    );
  }, [visible, mounted, sheetHeight, translateY]);

  const dragGesture = usePanGesture({
    activeOffsetY: [-8, 8],
    onUpdate: (event) => {
      'worklet';
      translateY.set(Math.max(0, event.translationY));
    },
    onDeactivate: (event) => {
      'worklet';
      if (
        event.translationY > sheetHeight * DISMISS_DRAG_RATIO ||
        event.velocityY > DISMISS_VELOCITY
      ) {
        scheduleOnRN(onClose);
      } else {
        translateY.set(withSpring(0, { damping: 28, stiffness: 300 }));
      }
    },
  });

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.get() }],
  }));
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateY.get(), [0, sheetHeight], [1, 0], 'clamp'),
  }));

  if (!mounted) {
    return null;
  }

  return (
    <Modal
      visible
      transparent
      animationType="none"
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
      <GestureHandlerRootView className="flex-1 justify-end">
        <Animated.View
          pointerEvents="none"
          className="absolute inset-0 bg-black/40"
          style={backdropStyle}
        />
        <Pressable
          accessibilityLabel="關閉"
          className="absolute inset-0"
          onPress={dismissOnBackdrop ? onClose : undefined}
        />
        <Animated.View
          testID="bottom-sheet"
          className={`w-full max-w-2xl self-center overflow-hidden rounded-t-3xl bg-white dark:bg-zinc-900 ${className ?? ''}`}
          style={[
            {
              height: sheetHeight,
              paddingBottom: Math.max(insets.bottom, 8),
              paddingLeft: insets.left,
              paddingRight: insets.right,
            },
            sheetStyle,
          ]}
        >
          <GestureDetector gesture={dragGesture}>
            <View testID="bottom-sheet-handle" collapsable={false}>
              <View className="items-center pb-1 pt-2">
                <View className="h-1 w-10 rounded-full bg-theme-200 dark:bg-zinc-600" />
              </View>
              {title ? (
                <Text className="px-4 pb-2 pt-1 text-center text-base font-semibold text-theme-900 dark:text-zinc-100">
                  {title}
                </Text>
              ) : (
                <View className="h-2" />
              )}
            </View>
          </GestureDetector>
          {children}
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  );
}

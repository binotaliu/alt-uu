import { Icon } from '@altuu/ui';
import { Image, type ImageSource } from 'expo-image';
import { useRef, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const DOUBLE_TAP_SCALE = 2.5;
const MAX_ZOOM = 4;
const DOUBLE_TAP_MS = 300;

export interface ImageLightboxProps {
  /** The image to show; `null` closes the lightbox. */
  source: ImageSource | null;
  alt?: string | null;
  onClose: () => void;
}

/**
 * Legacy ImageLightbox: dark full-screen viewer. iOS pinch-zooms through the
 * ScrollView's native zoom; on both platforms a double tap toggles 2.5x and
 * the zoomed image pans by scrolling.
 */
export function ImageLightbox({ source, alt, onClose }: ImageLightboxProps) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [zoomed, setZoomed] = useState(false);
  const lastTap = useRef(0);

  const close = () => {
    setZoomed(false);
    onClose();
  };

  const handleTap = () => {
    const now = Date.now();

    if (now - lastTap.current < DOUBLE_TAP_MS) {
      setZoomed((current) => !current);
    }

    lastTap.current = now;
  };

  const scale = zoomed ? DOUBLE_TAP_SCALE : 1;

  return (
    <Modal
      visible={source !== null}
      transparent
      animationType="fade"
      onRequestClose={close}
      statusBarTranslucent
    >
      <View className="flex-1 bg-black/90">
        <ScrollView
          key={zoomed ? 'zoomed' : 'fit'}
          horizontal={Platform.OS === 'android' && zoomed}
          maximumZoomScale={MAX_ZOOM}
          minimumZoomScale={1}
          centerContent
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: height,
            minWidth: width,
          }}
        >
          <ScrollView
            scrollEnabled={zoomed}
            nestedScrollEnabled
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: height,
            }}
          >
            <Pressable
              accessibilityLabel={alt ?? '附件圖片'}
              onPress={handleTap}
            >
              {source !== null ? (
                <Image
                  source={source}
                  accessibilityLabel={alt ?? '附件圖片'}
                  contentFit="contain"
                  style={{
                    width: width * scale,
                    height: height * 0.8 * scale,
                  }}
                />
              ) : null}
            </Pressable>
          </ScrollView>
        </ScrollView>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="關閉"
          onPress={close}
          className="absolute rounded-full bg-black/40 p-2"
          style={{
            top: Math.max(insets.top, 16),
            right: Math.max(insets.right, 16),
          }}
        >
          <Icon name="x-mark" size={24} className="text-white" />
        </Pressable>
      </View>
    </Modal>
  );
}

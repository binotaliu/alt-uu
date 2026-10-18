import { Icon } from '@altuu/ui';
import { Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { lightboxDocument, type LightboxImage } from './lightboxDocument';
import { TypedWebView } from '../shell/TypedWebView';

export type { LightboxImage };

export interface ImageLightboxProps {
    image: LightboxImage | null;
    onClose: () => void;
}

/**
 * Full-screen image viewer for images inside material HTML (legacy
 * ImageLightbox). It renders in a WebView so the image loads with the same
 * seeded HUNGU cookies as the material page and gets native pinch zoom.
 */
export function ImageLightbox({ image, onClose }: ImageLightboxProps) {
    const insets = useSafeAreaInsets();

    return (
        <Modal
            visible={image !== null}
            animationType="fade"
            onRequestClose={onClose}
            statusBarTranslucent
            navigationBarTranslucent
            supportedOrientations={['portrait', 'landscape']}
        >
            <View className="flex-1 bg-black">
                {image !== null ? (
                    <TypedWebView
                        originWhitelist={['*']}
                        source={{
                            html: lightboxDocument(image),
                            baseUrl: image.baseUrl,
                        }}
                        style={{ flex: 1, backgroundColor: '#000' }}
                        accessibilityLabel={image.alt || '圖片'}
                        onShouldStartLoadWithRequest={(request) =>
                            request.isTopFrame === false ||
                            request.url === image.baseUrl ||
                            request.url === 'about:blank'
                        }
                    />
                ) : null}
                <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="關閉"
                    hitSlop={8}
                    onPress={onClose}
                    className="absolute right-4 h-10 w-10 items-center justify-center rounded-full bg-black/60"
                    style={{ top: insets.top + 12 }}
                >
                    <Icon name="x-mark" size={22} className="text-white" />
                </Pressable>
            </View>
        </Modal>
    );
}

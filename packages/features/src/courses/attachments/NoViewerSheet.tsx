import { Button, Sheet, Text } from '@altuu/ui';
import { View } from 'react-native';

export interface NoViewerSheetProps {
    visible: boolean;
    onSave: () => void;
    onDismiss: () => void;
}

/** Offered after `ERR_NO_VIEWER`: no installed app can open the download. */
export function NoViewerSheet({
    visible,
    onSave,
    onDismiss,
}: NoViewerSheetProps) {
    return (
        <Sheet visible={visible} onClose={onDismiss} placement="center">
            <View className="p-6">
                <Text className="mb-2 text-lg font-semibold text-theme-900 dark:text-white">
                    無法開啟附件
                </Text>
                <Text className="mb-6 text-sm text-theme-700 dark:text-zinc-300">
                    找不到可以開啟此檔案的 App，您可以先將檔案儲存到裝置。
                </Text>
                <View className="flex-row gap-3">
                    <Button
                        className="flex-1"
                        label="取消"
                        variant="secondary"
                        onPress={onDismiss}
                    />
                    <Button className="flex-1" label="儲存" onPress={onSave} />
                </View>
            </View>
        </Sheet>
    );
}

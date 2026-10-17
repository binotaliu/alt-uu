import { View } from 'react-native';

import { Button } from './Button';
import { Sheet } from './Sheet';
import { Text } from './Text';

export interface ConfirmDialogProps {
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    danger?: boolean;
    onConfirm: () => void;
    onCancel: () => void;
}

/** Legacy ConfirmDialog: centred card with cancel and confirm buttons. */
export function ConfirmDialog({
    isOpen,
    title,
    message,
    confirmLabel = '確認',
    cancelLabel = '取消',
    danger = false,
    onConfirm,
    onCancel,
}: ConfirmDialogProps) {
    return (
        <Sheet visible={isOpen} onClose={onCancel} placement="center">
            <View className="px-5 py-4">
                <Text className="text-lg font-semibold text-theme-900 dark:text-zinc-100">
                    {title}
                </Text>
                <Text className="mt-2 text-sm text-theme-700 dark:text-zinc-400">
                    {message}
                </Text>
            </View>
            <View className="flex-row justify-end gap-2 border-t border-theme-200 px-5 py-4 dark:border-zinc-700">
                <Button
                    label={cancelLabel}
                    variant="secondary"
                    onPress={onCancel}
                />
                <Button
                    label={confirmLabel}
                    variant={danger ? 'danger' : 'primary'}
                    onPress={onConfirm}
                />
            </View>
        </Sheet>
    );
}

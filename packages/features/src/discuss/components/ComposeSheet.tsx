import { Button, Icon, Text } from '@altuu/ui';
import type { ReactNode } from 'react';
import {
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export interface ComposeSheetProps {
    visible: boolean;
    title: string;
    contextLabel: string;
    contextValue: string;
    submitLabel?: string;
    isSubmitting?: boolean;
    /** Validation or request failure shown above the footer. */
    error?: string | null;
    onClose: () => void;
    onSubmit: () => void;
    children: ReactNode;
}

/** Legacy DiscussComposeModal: bottom sheet with context line, fields and 取消 / 送出. */
export function ComposeSheet({
    visible,
    title,
    contextLabel,
    contextValue,
    submitLabel = '送出',
    isSubmitting = false,
    error = null,
    onClose,
    onSubmit,
    children,
}: ComposeSheetProps) {
    const insets = useSafeAreaInsets();

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={isSubmitting ? undefined : onClose}
            statusBarTranslucent
        >
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                className="flex-1 justify-end bg-zinc-950/45"
            >
                <Pressable
                    accessibilityLabel="關閉"
                    className="absolute inset-0"
                    onPress={isSubmitting ? undefined : onClose}
                />
                <View
                    accessibilityViewIsModal
                    className="max-h-[88%] w-full self-center rounded-t-3xl bg-white dark:bg-zinc-900"
                    style={{ paddingBottom: Math.max(insets.bottom, 12) }}
                >
                    <View className="flex-row items-start justify-between gap-3 border-b border-theme-200 px-4 pb-3 pt-4 dark:border-zinc-700">
                        <View className="min-w-0 flex-1">
                            <Text className="text-base font-semibold text-theme-900 dark:text-zinc-100">
                                {title}
                            </Text>
                            <Text
                                numberOfLines={2}
                                className="mt-1 text-xs text-theme-700 dark:text-zinc-400"
                            >
                                {contextLabel}：{contextValue}
                            </Text>
                        </View>
                        <Pressable
                            accessibilityRole="button"
                            accessibilityLabel="關閉"
                            hitSlop={8}
                            onPress={onClose}
                            disabled={isSubmitting}
                            className="size-9 items-center justify-center"
                        >
                            <Icon
                                name="x-mark"
                                size={20}
                                className="text-theme-700 dark:text-zinc-300"
                            />
                        </Pressable>
                    </View>

                    <ScrollView
                        keyboardShouldPersistTaps="handled"
                        contentContainerClassName="gap-3 px-4 py-4"
                    >
                        {children}
                        {error ? (
                            <Text
                                accessibilityRole="alert"
                                className="rounded-lg bg-rose-50 p-2 text-sm text-rose-700 dark:bg-rose-950 dark:text-rose-300"
                            >
                                {error}
                            </Text>
                        ) : null}
                    </ScrollView>

                    <View className="flex-row justify-end gap-2 border-t border-theme-200 px-4 pt-3 dark:border-zinc-700">
                        <Button
                            label="取消"
                            variant="secondary"
                            disabled={isSubmitting}
                            onPress={onClose}
                        />
                        <Button
                            label={submitLabel}
                            loading={isSubmitting}
                            onPress={onSubmit}
                        />
                    </View>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}

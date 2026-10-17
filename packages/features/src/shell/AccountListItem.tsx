import type { AccountViewModel } from '@altuu/core';
import { Icon, Text } from '@altuu/ui';
import type { ReactNode } from 'react';
import { Image, Pressable, View } from 'react-native';

export interface AccountListItemProps {
    account: AccountViewModel;
    disabled?: boolean;
    onSelect: () => void;
    trailing?: ReactNode;
}

/** One account row: avatar, nickname / username, display name. */
export function AccountListItem({
    account,
    disabled = false,
    onSelect,
    trailing,
}: AccountListItemProps) {
    return (
        <Pressable
            accessibilityRole="button"
            disabled={disabled}
            onPress={onSelect}
            className={`flex-row items-center gap-3 px-5 py-3 active:bg-theme-50 dark:active:bg-zinc-800 ${disabled ? 'opacity-50' : ''}`}
        >
            {account.picture ? (
                <Image
                    source={{ uri: account.picture }}
                    className="size-9 rounded-full"
                    accessibilityIgnoresInvertColors
                />
            ) : (
                <Icon
                    name="user-circle"
                    size={36}
                    className="text-theme-700 dark:text-zinc-500"
                />
            )}

            <View className="min-w-0 flex-1">
                <Text
                    numberOfLines={1}
                    className="text-sm font-semibold text-theme-900 dark:text-zinc-100"
                >
                    {account.nickname || account.username}
                </Text>
                <Text
                    numberOfLines={1}
                    className="text-xs text-theme-700 dark:text-zinc-400"
                >
                    {account.displayName}
                </Text>
            </View>

            {trailing}
        </Pressable>
    );
}

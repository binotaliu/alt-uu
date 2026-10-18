import { ConfirmDialog, Text, Icon } from '@altuu/ui';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';

import { useAccounts, useSwitchAccount } from '../../services/hooks';
import { useSessionExpiryStore } from '../../services/stores';
import { ErrorRetry } from '../../shell/ErrorRetry';
import { RenameAccountDialog } from '../components/RenameAccountDialog';
import { SubPage } from '../components/SubPage';
import {
    Avatar,
    Card,
    CardTitle,
    ErrorText,
    FormField,
    PasswordField,
} from '../components/primitives';
import {
    useAddAccount,
    useRemoveAccount,
    useRenameAccount,
} from '../hooks/useAccountActions';

function OutlineRowButton({
    label,
    onPress,
    disabled,
    danger = false,
    testID,
}: {
    label: string;
    onPress: () => void;
    disabled?: boolean;
    danger?: boolean;
    testID?: string;
}) {
    return (
        <Pressable
            testID={testID}
            accessibilityRole="button"
            disabled={disabled}
            onPress={onPress}
            className={`items-center rounded-lg border px-3 py-2 ${
                danger
                    ? 'border-rose-200 active:bg-rose-50 dark:border-rose-500/30 dark:active:bg-rose-500/10'
                    : 'border-theme-300 active:bg-theme-50 dark:border-zinc-600 dark:active:bg-zinc-800'
            } ${disabled ? 'opacity-50' : ''}`}
        >
            <Text
                className={`text-sm font-medium ${
                    danger
                        ? 'text-rose-600 dark:text-rose-400'
                        : 'text-theme-700 dark:text-zinc-300'
                }`}
            >
                {label}
            </Text>
        </Pressable>
    );
}

/** Legacy Account/Accounts.vue: list, switch, rename, remove and add accounts. */
export function AccountsScreen() {
    const accounts = useAccounts();
    const { switchAccount, switchingAccountId } = useSwitchAccount();
    const addAccount = useAddAccount();
    const renameAccount = useRenameAccount();
    const removeAccount = useRemoveAccount();

    const [expandedId, setExpandedId] = useState<number | null>(null);
    const [pendingRemovalId, setPendingRemovalId] = useState<number | null>(
        null,
    );
    const [removingId, setRemovingId] = useState<number | null>(null);

    const [addVisible, setAddVisible] = useState(false);
    const [addUsername, setAddUsername] = useState('');
    const [addPassword, setAddPassword] = useState('');
    const [addError, setAddError] = useState('');

    const [renameId, setRenameId] = useState<number | null>(null);
    const [renameValue, setRenameValue] = useState('');
    const [renameError, setRenameError] = useState('');

    const toggleAddForm = () => {
        setAddVisible((visible) => !visible);
        setAddUsername('');
        setAddPassword('');
        setAddError('');
    };

    const onAdd = async () => {
        setAddError('');

        try {
            await addAccount.mutateAsync({
                username: addUsername,
                password: addPassword,
            });
            setAddVisible(false);
            setAddUsername('');
            setAddPassword('');
        } catch (error) {
            setAddError(
                error instanceof Error
                    ? error.message
                    : '新增帳號失敗，請稍後再試。',
            );
        }
    };

    const onSwitch = async (accountId: number) => {
        try {
            const result = await switchAccount(accountId);

            if (result.ok) {
                router.push('/courses');

                return;
            }

            if (result.message.includes('已失效')) {
                useSessionExpiryStore.getState().setReturnTo('/courses');
                router.push(`/reauth/${accountId}`);

                return;
            }

            Alert.alert('切換帳號失敗', result.message);
        } catch (error) {
            void accounts.refetch();
            Alert.alert(
                '切換帳號失敗',
                error instanceof Error
                    ? error.message
                    : '切換帳號失敗，請稍後再試。',
            );
        }
    };

    const confirmRemove = async () => {
        const accountId = pendingRemovalId;
        setPendingRemovalId(null);

        if (accountId === null) {
            return;
        }

        setRemovingId(accountId);

        try {
            await removeAccount.mutateAsync(accountId);
        } catch (error) {
            Alert.alert(
                '移除帳號失敗',
                error instanceof Error
                    ? error.message
                    : '移除帳號失敗，請稍後再試。',
            );
        } finally {
            setRemovingId(null);
        }
    };

    const openRename = (accountId: number, nickname: string | null) => {
        setRenameId(accountId);
        setRenameValue(nickname ?? '');
        setRenameError('');
    };

    const confirmRename = async (value: string) => {
        if (renameId === null) {
            return;
        }

        setRenameError('');

        try {
            await renameAccount.mutateAsync({
                accountId: renameId,
                nickname: value,
            });
            setRenameId(null);
        } catch (error) {
            setRenameError(
                error instanceof Error
                    ? error.message
                    : '修改名稱失敗，請稍後再試。',
            );
        }
    };

    const list = accounts.data ?? [];

    return (
        <SubPage title="切換帳號" backHref="/courses/account">
            {accounts.error && list.length === 0 ? (
                <ErrorRetry
                    error={accounts.error}
                    retrying={accounts.isFetching}
                    onRetry={() => void accounts.refetch()}
                />
            ) : (
                <Card>
                    <CardTitle>帳號</CardTitle>

                    <View className="mt-3 gap-2">
                        {list.map((account) => {
                            const expanded = expandedId === account.id;

                            return (
                                <View
                                    key={account.id}
                                    className={`rounded-lg border border-theme-200 dark:border-zinc-700 ${
                                        account.isActive
                                            ? 'bg-amber-50/50 dark:bg-amber-500/5'
                                            : ''
                                    }`}
                                >
                                    <Pressable
                                        testID={`account-row-${account.username}`}
                                        accessibilityRole="button"
                                        accessibilityState={{ expanded }}
                                        onPress={() =>
                                            setExpandedId(
                                                expanded ? null : account.id,
                                            )
                                        }
                                        className="flex-row items-center gap-3 p-3"
                                    >
                                        <Avatar
                                            picture={account.picture}
                                            size={40}
                                        />
                                        <View className="min-w-0 flex-1">
                                            <Text
                                                numberOfLines={1}
                                                className="text-sm font-semibold text-theme-900 dark:text-zinc-100"
                                            >
                                                {account.nickname ||
                                                    account.username}
                                            </Text>
                                            <Text
                                                numberOfLines={1}
                                                className="text-xs text-theme-700 dark:text-zinc-400"
                                            >
                                                {account.nickname
                                                    ? `${account.username} · ${account.displayName}`
                                                    : account.displayName}
                                            </Text>
                                        </View>
                                        {account.isActive ? (
                                            <View className="rounded-full bg-amber-700 px-2 py-0.5">
                                                <Text className="text-xs font-semibold text-white">
                                                    目前帳號
                                                </Text>
                                            </View>
                                        ) : null}
                                        <View
                                            style={{
                                                transform: [
                                                    {
                                                        rotate: expanded
                                                            ? '180deg'
                                                            : '0deg',
                                                    },
                                                ],
                                            }}
                                        >
                                            <Icon
                                                name="chevron-down"
                                                size={16}
                                                className="text-theme-700 dark:text-zinc-500"
                                            />
                                        </View>
                                    </Pressable>

                                    {expanded ? (
                                        <View className="gap-2 border-t border-theme-200 p-3 dark:border-zinc-700">
                                            {account.isActive ? null : (
                                                <OutlineRowButton
                                                    testID="account-switch"
                                                    label={
                                                        switchingAccountId ===
                                                        account.id
                                                            ? '切換中…'
                                                            : '切換帳號'
                                                    }
                                                    disabled={
                                                        switchingAccountId ===
                                                        account.id
                                                    }
                                                    onPress={() =>
                                                        void onSwitch(
                                                            account.id,
                                                        )
                                                    }
                                                />
                                            )}
                                            <OutlineRowButton
                                                label="修改名稱"
                                                onPress={() =>
                                                    openRename(
                                                        account.id,
                                                        account.nickname,
                                                    )
                                                }
                                            />
                                            <OutlineRowButton
                                                label="登出此帳號"
                                                danger
                                                disabled={
                                                    removingId === account.id
                                                }
                                                onPress={() =>
                                                    setPendingRemovalId(
                                                        account.id,
                                                    )
                                                }
                                            />
                                        </View>
                                    ) : null}
                                </View>
                            );
                        })}
                    </View>

                    {addVisible ? (
                        <View className="mt-3 gap-2 rounded-lg border border-theme-200 p-3 dark:border-zinc-700">
                            <FormField
                                testID="add-account-username"
                                compact
                                value={addUsername}
                                onChangeText={setAddUsername}
                                placeholder="請輸入學號或帳號"
                                autoComplete="username"
                                textContentType="username"
                            />
                            <PasswordField
                                testID="add-account-password"
                                compact
                                value={addPassword}
                                onChangeText={setAddPassword}
                                placeholder="請輸入密碼"
                                returnKeyType="go"
                                onSubmitEditing={() => void onAdd()}
                            />
                            {addError ? (
                                <ErrorText>{addError}</ErrorText>
                            ) : null}
                            <View className="flex-row gap-2">
                                <Pressable
                                    testID="add-account-submit"
                                    accessibilityRole="button"
                                    disabled={addAccount.isPending}
                                    onPress={() => void onAdd()}
                                    className={`flex-1 items-center rounded-lg bg-theme-700 px-3 py-2 active:bg-theme-800 ${
                                        addAccount.isPending ? 'opacity-50' : ''
                                    }`}
                                >
                                    <Text className="text-sm font-medium text-theme-50">
                                        {addAccount.isPending
                                            ? '新增中…'
                                            : '確認新增'}
                                    </Text>
                                </Pressable>
                                <Pressable
                                    accessibilityRole="button"
                                    onPress={toggleAddForm}
                                    className="rounded-lg border border-theme-300 px-3 py-2 dark:border-zinc-600"
                                >
                                    <Text className="text-sm font-medium text-theme-700 dark:text-zinc-300">
                                        取消
                                    </Text>
                                </Pressable>
                            </View>
                        </View>
                    ) : (
                        <Pressable
                            testID="add-account-open"
                            accessibilityRole="button"
                            onPress={toggleAddForm}
                            className="mt-3 flex-row items-center justify-center gap-1 rounded-lg border border-dashed border-theme-300 px-3 py-2 active:bg-theme-50 dark:border-zinc-600 dark:active:bg-zinc-800"
                        >
                            <Icon
                                name="plus"
                                size={16}
                                className="text-theme-700 dark:text-zinc-300"
                            />
                            <Text className="text-sm font-medium text-theme-700 dark:text-zinc-300">
                                新增帳號
                            </Text>
                        </Pressable>
                    )}
                </Card>
            )}

            <ConfirmDialog
                isOpen={pendingRemovalId !== null}
                title="移除帳號"
                message="確定要移除這個帳號嗎？移除後將登出該帳號的所有裝置端資料。"
                confirmLabel="移除"
                danger
                onConfirm={() => void confirmRemove()}
                onCancel={() => setPendingRemovalId(null)}
            />

            <RenameAccountDialog
                isOpen={renameId !== null}
                initialValue={renameValue}
                processing={renameAccount.isPending}
                error={renameError}
                onConfirm={(value) => void confirmRename(value)}
                onCancel={() => setRenameId(null)}
            />
        </SubPage>
    );
}

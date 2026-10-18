import { Text, useIsDark } from '@altuu/ui';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAccounts } from '../../services/hooks';
import { Avatar, PasswordField, PrimaryButton } from '../components/primitives';
import { authBackgroundStyle } from '../components/backgrounds';
import { useReauthenticate } from '../hooks/useAccountActions';

/** Legacy Auth/Reauthenticate.vue: ask for the password of an expired account. */
export function ReauthScreen() {
    const params = useLocalSearchParams<{ accountId?: string | string[] }>();
    const rawId = Array.isArray(params.accountId)
        ? params.accountId[0]
        : params.accountId;
    const accountId = Number(rawId);

    const insets = useSafeAreaInsets();
    const isDark = useIsDark();
    const accounts = useAccounts();
    const account = accounts.data?.find((item) => item.id === accountId);
    const reauthenticate = useReauthenticate(accountId);
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const submit = async () => {
        if (reauthenticate.isPending) {
            return;
        }

        setError('');

        try {
            const destination = await reauthenticate.mutateAsync(password);
            router.replace(destination);
        } catch (caught) {
            setError(
                caught instanceof Error
                    ? caught.message
                    : '登入失敗，請稍後再試。',
            );
        }
    };

    return (
        <KeyboardAvoidingView
            className="flex-1 bg-theme-50 dark:bg-zinc-950"
            style={authBackgroundStyle(isDark)}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            <ScrollView
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{
                    paddingTop: Math.max(insets.top, 64),
                    paddingBottom: Math.max(insets.bottom, 24),
                    paddingLeft: Math.max(insets.left, 16),
                    paddingRight: Math.max(insets.right, 16),
                }}
            >
                <View className="items-center justify-center gap-3 py-2">
                    <Avatar picture={account?.picture} size={64} />
                    <Text className="text-lg font-semibold text-theme-800">
                        {account?.nickname ?? account?.username ?? '此帳號'}
                    </Text>
                </View>

                <View className="mx-auto mt-6 w-full max-w-xl rounded-3xl border border-theme-200 bg-white/40 p-6 dark:border-zinc-700 dark:bg-zinc-900/80">
                    <View className="rounded-2xl border border-theme-200 bg-theme-50 p-6 dark:border-zinc-700 dark:bg-zinc-800">
                        <Text className="text-xl font-semibold text-theme-900 dark:text-zinc-100">
                            重新登入
                        </Text>
                        <Text className="mt-1 text-sm text-theme-700 dark:text-zinc-300">
                            此帳號的登入已失效，請重新輸入密碼以繼續使用。
                        </Text>

                        <View className="mt-6 gap-4">
                            <View>
                                <PasswordField
                                    testID="reauth-password"
                                    label="密碼"
                                    value={password}
                                    onChangeText={setPassword}
                                    placeholder="請輸入密碼"
                                    autoFocus
                                    returnKeyType="go"
                                    onSubmitEditing={() => void submit()}
                                    invalid={error !== ''}
                                />
                                {error ? (
                                    <Text
                                        accessibilityRole="alert"
                                        className="mt-1 text-sm text-rose-600 dark:text-rose-400"
                                    >
                                        {error}
                                    </Text>
                                ) : null}
                            </View>

                            <PrimaryButton
                                testID="reauth-submit"
                                label={
                                    reauthenticate.isPending
                                        ? '登入中...'
                                        : '登入'
                                }
                                disabled={reauthenticate.isPending}
                                onPress={() => void submit()}
                            />
                        </View>
                    </View>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

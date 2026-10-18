import { Text } from '@altuu/ui';
import { router } from 'expo-router';
import { useState } from 'react';
import {
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { openInAppBrowser } from '../../shell/openUrl';
import { AccountIcon } from '../components/AccountIcon';
import {
    FormField,
    PasswordField,
    PrimaryButton,
} from '../components/primitives';
import { useLogin } from '../hooks/useAccountActions';
import { rawOf } from '../lib/actionError';
import { POLICY_URLS } from '../lib/links';

/** Legacy Auth/Login.vue. */
export function LoginScreen() {
    const insets = useSafeAreaInsets();
    const login = useLogin();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [rawResponse, setRawResponse] = useState<string | null>(null);
    const [showRaw, setShowRaw] = useState(false);

    const submit = async () => {
        if (login.isPending) {
            return;
        }

        setError('');
        setRawResponse(null);

        try {
            await login.mutateAsync({ username, password });
            router.replace('/courses');
        } catch (caught) {
            setError(
                caught instanceof Error
                    ? caught.message
                    : '登入失敗，請稍後再試。',
            );

            const raw = rawOf(caught);
            setRawResponse(
                raw === undefined ? null : JSON.stringify(raw, null, 2),
            );
        }
    };

    const border = error !== '';

    return (
        <KeyboardAvoidingView
            className="flex-1 bg-theme-50 dark:bg-zinc-950"
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
                <View className="items-center justify-center py-2">
                    <AccountIcon
                        name="academic-cap"
                        size={64}
                        className="text-theme-700"
                    />
                    <Text className="text-2xl font-extrabold text-theme-700">
                        Alt UU
                    </Text>
                </View>

                <View className="mx-auto mt-6 w-full max-w-xl rounded-3xl border border-theme-200 bg-white/40 p-6 dark:border-zinc-700 dark:bg-zinc-900/80">
                    <View className="rounded-2xl border border-theme-200 bg-theme-50 p-6 dark:border-zinc-700 dark:bg-zinc-800">
                        <Text className="text-xl font-semibold text-theme-900 dark:text-zinc-100">
                            登入 NOU UU 平台
                        </Text>
                        <Text className="mt-1 text-sm text-theme-700 dark:text-zinc-300">
                            請輸入 NOU UU
                            平台之登入資訊。所有資訊都將在您的裝置上直接與 NOU
                            UU 平台建立安全通訊，不會傳送至其他伺服器。
                        </Text>

                        <View className="mt-6 gap-4">
                            <FormField
                                label="帳號"
                                icon="user"
                                value={username}
                                onChangeText={setUsername}
                                placeholder="請輸入學號或帳號"
                                autoComplete="username"
                                textContentType="username"
                                returnKeyType="next"
                                invalid={border}
                            />
                            <PasswordField
                                label="密碼"
                                value={password}
                                onChangeText={setPassword}
                                placeholder="請輸入密碼"
                                returnKeyType="go"
                                onSubmitEditing={() => void submit()}
                                invalid={border}
                            />

                            {error ? (
                                <Text
                                    accessibilityRole="alert"
                                    className="text-sm text-rose-600 dark:text-rose-400"
                                >
                                    {error}
                                </Text>
                            ) : null}

                            <PrimaryButton
                                label={login.isPending ? '登入中...' : '登入'}
                                disabled={login.isPending}
                                onPress={() => void submit()}
                            />

                            {rawResponse ? (
                                <View>
                                    <Pressable
                                        accessibilityRole="button"
                                        onPress={() => setShowRaw((v) => !v)}
                                    >
                                        <Text className="text-xs text-theme-700 dark:text-zinc-400">
                                            若登入持續失敗，可展開檢視伺服器回應內容
                                        </Text>
                                    </Pressable>
                                    {showRaw ? (
                                        <Text
                                            selectable
                                            className="mt-2 rounded-lg border border-theme-200 bg-theme-50 p-2 font-mono text-xs text-theme-800 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                                        >
                                            {rawResponse}
                                        </Text>
                                    ) : null}
                                </View>
                            ) : null}
                        </View>

                        <Text className="mt-4 text-sm text-theme-700 dark:text-zinc-300">
                            {'登入即表示您已閱讀並同意本 App 之《'}
                            <Text
                                accessibilityRole="link"
                                onPress={() =>
                                    openInAppBrowser(POLICY_URLS.usage)
                                }
                                className="text-sm text-theme-700 underline dark:text-zinc-300"
                            >
                                使用條款
                            </Text>
                            {'》與《'}
                            <Text
                                accessibilityRole="link"
                                onPress={() =>
                                    openInAppBrowser(POLICY_URLS.privacy)
                                }
                                className="text-sm text-theme-700 underline dark:text-zinc-300"
                            >
                                隱私權政策
                            </Text>
                            {'》'}
                        </Text>
                    </View>

                    <Pressable
                        accessibilityRole="link"
                        onPress={() => router.push('/settings')}
                        className="mt-6 flex-row items-center justify-center gap-1 self-center"
                    >
                        <AccountIcon
                            name="cog-6-tooth"
                            size={16}
                            className="text-theme-700 dark:text-zinc-300"
                        />
                        <Text className="text-sm font-medium text-theme-700 underline dark:text-zinc-300">
                            設定
                        </Text>
                    </Pressable>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

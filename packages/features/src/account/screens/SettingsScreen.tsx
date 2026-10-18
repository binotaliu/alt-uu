import { Text } from '@altuu/ui';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Linking, View } from 'react-native';

import {
    useAppConfig,
    useAppPreferences,
    useUpdatePreferences,
} from '../../services/hooks';
import { useClientConfigStore } from '../../services/stores';
import { openInAppBrowser } from '../../shell/openUrl';
import { useWhatsNew } from '../../shell/useWhatsNew';
import { AccountIcon, type AccountIconName } from '../components/AccountIcon';
import { SubPage } from '../components/SubPage';
import { ThemeSettings } from '../components/ThemeSettings';
import {
    Card,
    CardDescription,
    CardTitle,
    OutlineButton,
    PillSwitch,
    SwitchCard,
} from '../components/primitives';
import { useDiagnosticRecording } from '../hooks/useDiagnosticRecording';
import { clearDownloadedAttachments } from '../lib/files';
import { CONTACT_EMAIL_URL, POLICY_URLS } from '../lib/links';

export const BUILD_NUMBER_REVEAL_TAPS = 5;
export const BUILD_NUMBER_TAP_WINDOW_MS = 2000;

const CREDITS = [
    'React Native (MIT License)',
    'Expo (MIT License)',
    'NativeWind (MIT License)',
    'Tailwind CSS (MIT License)',
    'TanStack Query (MIT License)',
    'Zustand (MIT License)',
    'Heroicons (MIT License)',
] as const;

const PREFERENCE_SWITCHES = [
    {
        key: 'nouToolsIntegrationEnabled',
        title: '開啟 NOU 小幫手整合',
        description:
            '開啟此選項以讓 Alt UU 從 NOU 小幫手取得課程資訊與視訊面授資訊。部分詮釋資料可能會傳送給 NOU 小幫手以提供此功能。',
    },
    {
        key: 'screenReaderEnhancedSupportEnabled',
        title: '加強螢幕閱讀器支援',
        description:
            '若您使用螢幕閱讀器，如 VoiceOver、TalkBack、NVDA 或 JAWS，開啟此選項可讓 Alt UU 在教材頁中使用對螢幕閱讀器較友善的播放器。',
        switchLabel: '切換增強螢幕閱讀器支援',
    },
    {
        key: 'liveSessionNicknameModalEnabled',
        title: '視訊面授前顯示暱稱設定提示',
        description:
            '開啟此選項後，點擊「進入教室」或「備用教室」時會先顯示提示視窗，告訴您應設定的顯示暱稱並提供複製功能，再進入教室。',
    },
    {
        key: 'cellularPlaybackWarningEnabled',
        title: '行動網路播放提醒',
        description:
            '開啟此選項後，透過行動網路（非 Wi-Fi）觀看教材影音前，會先詢問是否繼續播放，避免消耗過多行動數據。',
    },
    {
        key: 'altUuPlusDisabled',
        title: '關閉 Alt UU+ 功能',
        description:
            '在界面上隱藏 Alt UU+ 專屬功能，包括主題色、學習統計與資料匯出入。請注意：若你已有 Alt UU+ 訂閱，開啟此選項並不會取消訂閱。',
    },
] as const;

function LinkButton({
    icon,
    label,
    onPress,
}: {
    icon: AccountIconName;
    label: string;
    onPress: () => void;
}) {
    return <OutlineButton icon={icon} label={label} onPress={onPress} />;
}

/** Legacy Settings/Index.vue. */
export function SettingsScreen() {
    const config = useAppConfig();
    const preferences = useAppPreferences();
    const updatePreferences = useUpdatePreferences();
    const sessionStatus = useClientConfigStore((state) => state.sessionStatus);
    const { open: openWhatsNew } = useWhatsNew();
    const recording = useDiagnosticRecording();

    const [savingKey, setSavingKey] = useState<string | null>(null);
    const [isBuildNumberRevealed, setBuildNumberRevealed] = useState(false);
    const tapCount = useRef(0);
    const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [isClearing, setIsClearing] = useState(false);
    const [cleanupSummary, setCleanupSummary] = useState<string | null>(null);
    const [cleanupError, setCleanupError] = useState<string | null>(null);

    useEffect(
        () => () => {
            if (tapTimer.current !== null) {
                clearTimeout(tapTimer.current);
            }
        },
        [],
    );

    const registerVersionTap = () => {
        if (isBuildNumberRevealed) {
            return;
        }

        tapCount.current += 1;

        if (tapTimer.current !== null) {
            clearTimeout(tapTimer.current);
        }

        if (tapCount.current >= BUILD_NUMBER_REVEAL_TAPS) {
            setBuildNumberRevealed(true);
            tapCount.current = 0;

            return;
        }

        tapTimer.current = setTimeout(() => {
            tapCount.current = 0;
        }, BUILD_NUMBER_TAP_WINDOW_MS);
    };

    const setPreference = async (
        key: (typeof PREFERENCE_SWITCHES)[number]['key'],
        value: boolean,
    ) => {
        setSavingKey(key);

        try {
            await updatePreferences.mutateAsync({ [key]: value });
        } catch (error) {
            Alert.alert(
                '儲存設定失敗',
                error instanceof Error ? error.message : '請稍後再試。',
            );
        } finally {
            setSavingKey(null);
        }
    };

    const clearAttachments = () => {
        if (isClearing) {
            return;
        }

        Alert.alert(
            '清除已下載附件',
            '這會清除目前裝置中 Alt UU 已下載的所有附件檔案。確定要繼續嗎？',
            [
                { text: '取消', style: 'cancel' },
                {
                    text: '清除',
                    style: 'destructive',
                    onPress: () => {
                        void (async () => {
                            setIsClearing(true);
                            setCleanupSummary(null);
                            setCleanupError(null);

                            try {
                                const result =
                                    await clearDownloadedAttachments();
                                setCleanupSummary(
                                    `已清除 ${result.deletedFiles} 個檔案。`,
                                );
                            } catch (error) {
                                setCleanupError(
                                    error instanceof Error
                                        ? error.message
                                        : '清除附件失敗，請稍後再試。',
                                );
                            } finally {
                                setIsClearing(false);
                            }
                        })();
                    },
                },
            ],
        );
    };

    const data = config.data;

    return (
        <SubPage
            title="設定"
            backHref={
                sessionStatus === 'unauthenticated' ? '/login' : '/courses'
            }
            wide
        >
            <View className="mb-4 items-center justify-center gap-4 py-2">
                <View className="items-center">
                    <AccountIcon
                        name="academic-cap"
                        size={64}
                        className="text-theme-700"
                    />
                    <Text className="text-2xl font-extrabold text-theme-700">
                        Alt UU
                    </Text>
                </View>
                <Text
                    accessibilityRole="button"
                    testID="app-version"
                    onPress={registerVersionTap}
                    className="font-semibold text-theme-700"
                >
                    {data?.appDisplayVersion ?? ''}
                    {isBuildNumberRevealed && data
                        ? ` (${data.appVersionCode})`
                        : ''}
                </Text>
            </View>

            <ThemeSettings />

            {PREFERENCE_SWITCHES.map((item) => (
                <SwitchCard
                    key={item.key}
                    title={item.title}
                    description={item.description}
                    switchLabel={
                        'switchLabel' in item ? item.switchLabel : undefined
                    }
                    value={preferences[item.key]}
                    disabled={savingKey === item.key}
                    onValueChange={(value) =>
                        void setPreference(item.key, value)
                    }
                />
            ))}

            <Card>
                <View className="flex-row items-start justify-between gap-3">
                    <View className="min-w-0 flex-1">
                        <CardTitle>附件下載</CardTitle>
                        <CardDescription>
                            清除先前下載到本機的附件檔案，釋放裝置儲存空間。
                        </CardDescription>
                    </View>
                    <OutlineButton
                        icon="trash"
                        label={isClearing ? '清除中...' : '清除已下載附件'}
                        disabled={isClearing}
                        onPress={clearAttachments}
                        className="shrink-0"
                    />
                </View>
                {cleanupSummary ? (
                    <Text className="mt-3 text-xs text-emerald-700 dark:text-emerald-300">
                        {cleanupSummary}
                    </Text>
                ) : null}
                {cleanupError ? (
                    <Text className="mt-3 text-xs text-rose-700 dark:text-rose-300">
                        {cleanupError}
                    </Text>
                ) : null}
            </Card>

            <Card>
                <View className="flex-row justify-between gap-2">
                    <View className="min-w-0 flex-1 gap-1">
                        <CardTitle>疑難排解</CardTitle>
                        <Text className="text-xs text-theme-700 dark:text-zinc-400">
                            若您遇到連線問題，可以檢查各項服務目前是否可正常連線。
                        </Text>
                    </View>
                    <OutlineButton
                        icon="signal"
                        label="連線診斷"
                        onPress={() => router.push('/settings/diagnostics')}
                        className="shrink-0 self-start"
                    />
                </View>

                {data?.materialSourceViewerEnabled ? (
                    <View className="mt-4 flex-row justify-between gap-2 border-t border-theme-200 pt-4 dark:border-zinc-700">
                        <View className="min-w-0 flex-1 gap-1">
                            <CardTitle>教材來源檢視</CardTitle>
                            <Text className="text-xs text-theme-700 dark:text-zinc-400">
                                教材目錄或內容顯示不出來時，可以檢視學校實際送來的目錄網址與頁面原始碼。
                            </Text>
                        </View>
                        <OutlineButton
                            icon="document-magnifying-glass"
                            label="檢視來源"
                            onPress={() =>
                                router.push('/settings/diagnostics/material')
                            }
                            className="shrink-0 self-start"
                        />
                    </View>
                ) : null}

                {recording.status?.available !== false ? (
                    <View className="mt-4 border-t border-theme-200 pt-4 dark:border-zinc-700">
                        <View className="flex-row items-start justify-between gap-4">
                            <View className="min-w-0 flex-1">
                                <CardTitle>
                                    紀錄診斷紀錄以協助瞭解問題
                                </CardTitle>
                                <CardDescription>
                                    {`開啟後會記錄 App 的請求與錯誤，方便回報問題時附上。為了節省效能與空間，會在 ${recording.status?.windowMinutes ?? 30} 分鐘後自動關閉，記錄也會在 ${recording.status?.retentionDays ?? 14} 天後自動清除。`}
                                </CardDescription>
                                {recording.isRecording ? (
                                    <Text className="mt-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                                        {`記錄中，約 ${recording.minutesRemaining} 分鐘後自動關閉。`}
                                    </Text>
                                ) : null}
                                {recording.error ? (
                                    <Text className="mt-1 text-xs text-rose-600 dark:text-rose-400">
                                        {recording.error}
                                    </Text>
                                ) : null}
                            </View>
                            <PillSwitch
                                label="切換診斷記錄"
                                value={recording.isRecording}
                                disabled={recording.isBusy}
                                onValueChange={(value) =>
                                    void recording.setRecording(value)
                                }
                            />
                        </View>
                        <View className="mt-3 self-start">
                            <OutlineButton
                                icon="document-text"
                                label="檢視診斷記錄"
                                onPress={() =>
                                    router.push('/settings/diagnostics/log')
                                }
                            />
                        </View>
                    </View>
                ) : null}
            </Card>

            <Card>
                <CardTitle>聯絡資訊與政策</CardTitle>
                <View className="mt-2 gap-2">
                    <LinkButton
                        icon="envelope"
                        label="聯絡本 App 作者"
                        onPress={() => void Linking.openURL(CONTACT_EMAIL_URL)}
                    />
                    <LinkButton
                        icon="document-text"
                        label="使用條款"
                        onPress={() => openInAppBrowser(POLICY_URLS.usage)}
                    />
                    <LinkButton
                        icon="shield-check"
                        label="隱私權政策"
                        onPress={() => openInAppBrowser(POLICY_URLS.privacy)}
                    />
                    <LinkButton
                        icon="sparkles"
                        label="檢視新功能"
                        onPress={openWhatsNew}
                    />
                    <LinkButton
                        icon="code-bracket"
                        label="App 原始碼"
                        onPress={() => openInAppBrowser(POLICY_URLS.source)}
                    />
                </View>
                <Text className="mt-3 text-sm leading-relaxed text-theme-700 dark:text-zinc-300">
                    本程式為 AGPL-3.0-or-later
                    開放原始碼授權軟體。任何人均可自由取得原始碼、修改、編譯、再發佈，惟須維持相同授權方式。
                </Text>
            </Card>

            <Card>
                <CardTitle>鳴謝</CardTitle>
                <Text className="mt-2 text-sm leading-relaxed text-theme-700 dark:text-zinc-300">
                    Alt UU
                    的誕生離不開許多人的幫助，特別是開放原始碼社群豐富的生態，以及所有參與
                    Alt UU 公開測試的同學。
                    {'\n'}
                    以下是一些 Alt UU
                    使用到的開放原始碼專案與其授權。您應該可以在本專案的 GitHub
                    Repository 內找到更多資訊。
                </Text>
                <View className="mt-2 gap-1">
                    {CREDITS.map((credit) => (
                        <Text
                            key={credit}
                            className="text-sm text-theme-700 dark:text-zinc-300"
                        >
                            {`• ${credit}`}
                        </Text>
                    ))}
                </View>
            </Card>
        </SubPage>
    );
}

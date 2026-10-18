import { Text } from '@altuu/ui';
import { useEffect, useMemo } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { AccountIcon } from '../components/AccountIcon';
import { ConnectivityServiceRow } from '../components/ConnectivityServiceRow';
import { SubPage } from '../components/SubPage';
import { Card, CardTitle, OutlineButton } from '../components/primitives';
import {
    useConnectivityDiagnostics,
    type ConnectivityServiceRow as Row,
} from '../hooks/useConnectivityDiagnostics';

const NETWORK_TYPE_LABEL: Record<string, string> = {
    wifi: 'Wi-Fi',
    cellular: '行動網路',
    ethernet: '乙太網路',
    unknown: '未知',
};

const OVERVIEW_MESSAGES: Partial<Record<string, string>> = {
    hungu: '由於無法連線到數位學習平台，因此無法使用 Alt UU',
    school_portal:
        '由於無法連線到教務行政資訊系統，因此無法使用部份功能如下載作業或查詢成績。',
    nou_tools:
        '由於無法連線到 NOU 小幫手，因此部份功能如視訊面授資訊、學校行事曆，以及考古題等功能將無法使用。',
    iap: '由於無法連線到 Alt UU+ 服務，因此 Alt UU+ 功能無法使用。若您已訂閱但未顯示您的訂閱狀態，可於稍後可正常連線時按一下訂閱頁中的「恢復購買」來恢復您的訂閱狀態。',
};

export type Overview =
    | { level: 'loading' | 'ok'; messages: [] }
    | { level: 'warning' | 'error'; messages: string[] };

/** What the summary card says, from the primary rows and the device network. */
export function summarize(
    rows: Row[],
    deviceConnected: boolean | null,
): Overview {
    if (deviceConnected === false) {
        return {
            level: 'error',
            messages: [
                '您的裝置目前沒有網路連線，請確認您已連線到行動網路（4G / 5G 等）或無線網路（Wi-Fi），方可使用 Alt-UU。',
            ],
        };
    }

    if (rows.length === 0 || rows.some((row) => row.status !== 'done')) {
        return { level: 'loading', messages: [] };
    }

    const unreachable = rows.filter(
        (row) => row.status === 'done' && !row.reachable,
    );
    const messages = unreachable
        .map((row) => OVERVIEW_MESSAGES[row.service])
        .filter((message): message is string => Boolean(message));

    if (messages.length === 0) {
        return { level: 'ok', messages: [] };
    }

    return {
        level: unreachable.some((row) => row.service === 'hungu')
            ? 'error'
            : 'warning',
        messages,
    };
}

/** Legacy Settings/ConnectivityDiagnostics.vue. */
export function ConnectivityDiagnosticsScreen() {
    const diagnostics = useConnectivityDiagnostics();
    const { runCheck } = diagnostics;
    const overview = useMemo(
        () =>
            summarize(
                diagnostics.rows,
                diagnostics.deviceNetwork?.connected ?? null,
            ),
        [diagnostics.rows, diagnostics.deviceNetwork],
    );
    const isOffline =
        diagnostics.deviceNetwork !== null &&
        !diagnostics.deviceNetwork.connected;

    useEffect(() => {
        void runCheck();
        // Only on first show; "重新檢查" re-runs it.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <SubPage title="連線診斷" backHref="/settings" wide>
            <View className="min-h-32 justify-center rounded-xl border border-theme-300 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
                <View className="flex-row items-center gap-3">
                    {overview.level === 'loading' ? (
                        <ActivityIndicator />
                    ) : overview.level === 'ok' ? (
                        <AccountIcon
                            name="check-circle"
                            size={24}
                            className="text-emerald-600 dark:text-emerald-400"
                        />
                    ) : overview.level === 'warning' ? (
                        <AccountIcon
                            name="exclamation-triangle"
                            size={24}
                            className="text-amber-600 dark:text-amber-400"
                        />
                    ) : (
                        <AccountIcon
                            name="x-circle"
                            size={24}
                            className="text-rose-600 dark:text-rose-400"
                        />
                    )}
                    <View className="min-w-0 flex-1 gap-1">
                        {overview.level === 'loading' ? (
                            <Text className="text-sm text-theme-700 dark:text-zinc-400">
                                正在檢查各項服務連線狀態…
                            </Text>
                        ) : overview.level === 'ok' ? (
                            <Text className="text-sm text-theme-700 dark:text-zinc-300">
                                所有服務均可正常連線。
                            </Text>
                        ) : (
                            overview.messages.map((message) => (
                                <Text
                                    key={message}
                                    className="text-sm text-theme-700 dark:text-zinc-300"
                                >
                                    {message}
                                </Text>
                            ))
                        )}
                    </View>
                </View>
            </View>

            {isOffline ? null : (
                <>
                    <View className="flex-row items-center justify-between gap-4">
                        <Text className="min-w-0 flex-1 text-sm text-theme-700 dark:text-zinc-400">
                            檢查 Alt UU
                            所依賴的各項服務目前是否可正常連線，協助您判斷連線問題是否來自您的網路。
                        </Text>
                        <OutlineButton
                            icon="arrow-path"
                            label={
                                diagnostics.isChecking ? '檢查中…' : '重新檢查'
                            }
                            disabled={diagnostics.isChecking}
                            onPress={() => void runCheck()}
                            className="shrink-0"
                        />
                    </View>

                    {diagnostics.error ? (
                        <Text className="text-sm text-rose-700 dark:text-rose-300">
                            {diagnostics.error}
                        </Text>
                    ) : null}

                    {diagnostics.deviceNetwork ? (
                        <Card>
                            <View className="flex-row items-center justify-between gap-3">
                                <View className="min-w-0 flex-1">
                                    <CardTitle>裝置網路狀態</CardTitle>
                                    <Text className="mt-1 text-xs text-theme-700 dark:text-zinc-400">
                                        {diagnostics.deviceNetwork.connected
                                            ? `已連線（${NETWORK_TYPE_LABEL[diagnostics.deviceNetwork.type] ?? diagnostics.deviceNetwork.type}）`
                                            : '裝置目前無網路連線'}
                                    </Text>
                                </View>
                                <AccountIcon
                                    name={
                                        diagnostics.deviceNetwork.connected
                                            ? 'check-circle'
                                            : 'x-circle'
                                    }
                                    size={24}
                                    className={
                                        diagnostics.deviceNetwork.connected
                                            ? 'text-emerald-600 dark:text-emerald-400'
                                            : 'text-rose-600 dark:text-rose-400'
                                    }
                                />
                            </View>
                        </Card>
                    ) : null}

                    {diagnostics.rows.map((row) => (
                        <ConnectivityServiceRow key={row.service} row={row} />
                    ))}

                    <View className="border-t border-theme-200 pt-4 dark:border-zinc-700">
                        <CardTitle>網際網路連線（選用）</CardTitle>
                        <View className="flex-row items-start justify-between gap-4">
                            <Text className="mt-1 min-w-0 flex-1 text-xs text-theme-700 dark:text-zinc-400">
                                透過檢查 Google、Cloudflare、Apple
                                等外部服務，協助判斷問題是否來自您的網際網路連線，而非
                                Alt UU 本身。
                            </Text>
                            <OutlineButton
                                icon="arrow-path"
                                label={
                                    diagnostics.isCheckingReference
                                        ? '檢查中…'
                                        : '檢查網際網路連線'
                                }
                                disabled={
                                    diagnostics.isCheckingReference ||
                                    diagnostics.referenceRows.length === 0
                                }
                                onPress={() =>
                                    void diagnostics.runReferenceCheck()
                                }
                                className="shrink-0"
                            />
                        </View>
                    </View>

                    {diagnostics.referenceError ? (
                        <Text className="text-sm text-rose-700 dark:text-rose-300">
                            {diagnostics.referenceError}
                        </Text>
                    ) : null}

                    {diagnostics.referenceRows.map((row) => (
                        <ConnectivityServiceRow key={row.service} row={row} />
                    ))}
                </>
            )}
        </SubPage>
    );
}

import { Text } from '@altuu/ui';
import { ActivityIndicator, View } from 'react-native';

import type { ConnectivityServiceRow as Row } from '../hooks/useConnectivityDiagnostics';
import { AccountIcon } from './AccountIcon';
import { Card } from './primitives';

function statusText(row: Row): string {
    if (row.status === 'pending') {
        return '尚未執行檢查';
    }

    if (row.status === 'checking') {
        return '檢查中…';
    }

    if (row.reachable) {
        return `回應時間 ${row.latencyMs}ms（狀態碼 ${row.statusCode}）`;
    }

    return row.error ?? `無法連線（狀態碼 ${row.statusCode ?? '無回應'}）`;
}

/** Legacy ConnectivityServiceRow: one probed service. */
export function ConnectivityServiceRow({ row }: { row: Row }) {
    return (
        <Card>
            <View className="flex-row items-center justify-between gap-3">
                <View className="min-w-0 flex-1">
                    <Text className="text-sm font-semibold text-theme-900 dark:text-zinc-100">
                        {row.label}
                    </Text>
                    <Text
                        numberOfLines={2}
                        className="mt-1 text-xs text-theme-700 dark:text-zinc-400"
                    >
                        {statusText(row)}
                    </Text>
                </View>
                {row.status === 'checking' ? (
                    <ActivityIndicator size="small" />
                ) : row.status === 'done' && row.reachable ? (
                    <AccountIcon
                        name="check-circle"
                        size={24}
                        className="text-emerald-600 dark:text-emerald-400"
                    />
                ) : row.status === 'done' ? (
                    <AccountIcon
                        name="x-circle"
                        size={24}
                        className="text-rose-600 dark:text-rose-400"
                    />
                ) : null}
            </View>
        </Card>
    );
}

import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Icon } from './Icon';
import { Text } from './Text';

/** What the error panel needs to know about a failure (see features' ServiceError). */
export interface ErrorDetailView {
    displayCode: string;
    stageLabel: string;
    operationLabel: string;
    status: number | null;
    upstreamStatus: number | null;
    requestId: string | null;
    durationMs: number | null;
    /** Technical `Class: message` line, shown in the expandable panel. */
    exception: string | null;
}

export interface ErrorRetryViewProps {
    message: string;
    retrying?: boolean;
    detail?: ErrorDetailView | null;
    onRetry: () => void;
    /** Copies the diagnostic report; resolves true on success. */
    onCopy?: () => Promise<boolean>;
    onOpenLog?: () => void;
}

/** Legacy ErrorRetry: dashed rose panel with retry, expandable details and copy. */
export function ErrorRetryView({
    message,
    retrying = false,
    detail = null,
    onRetry,
    onCopy,
    onOpenLog,
}: ErrorRetryViewProps) {
    const [expanded, setExpanded] = useState(false);
    const [copied, setCopied] = useState(false);

    const copy = async () => {
        if (onCopy === undefined) {
            return;
        }

        const ok = await onCopy();
        setCopied(ok);

        if (ok) {
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const rows: Array<[string, string]> = detail
        ? [
              ['狀況', detail.stageLabel],
              ['項目', detail.operationLabel],
              ...(detail.status === null
                  ? []
                  : ([['狀態碼', String(detail.status)]] as Array<
                        [string, string]
                    >)),
              ...(detail.upstreamStatus === null
                  ? []
                  : ([['學校系統', `回應 ${detail.upstreamStatus}`]] as Array<
                        [string, string]
                    >)),
              ...(detail.durationMs === null
                  ? []
                  : ([['耗時', `${detail.durationMs}ms`]] as Array<
                        [string, string]
                    >)),
              ...(detail.requestId === null
                  ? []
                  : ([['識別碼', detail.requestId]] as Array<
                        [string, string]
                    >)),
              ...(detail.exception === null
                  ? []
                  : ([['錯誤', detail.exception]] as Array<[string, string]>)),
          ]
        : [];

    return (
        <View className="rounded-xl border border-dashed border-rose-300 bg-rose-50 p-5 dark:border-rose-800 dark:bg-rose-950">
            <Text className="text-sm text-rose-700 dark:text-rose-300">
                {message}
                {detail ? (
                    <Text className="font-mono text-xs text-rose-800 dark:text-rose-200">
                        {` [${detail.displayCode}]`}
                    </Text>
                ) : null}
            </Text>

            <View className="mt-3 flex-row flex-wrap items-center gap-2">
                <Pressable
                    accessibilityRole="button"
                    disabled={retrying}
                    onPress={onRetry}
                    className={`flex-row items-center gap-2 rounded-lg border border-rose-300 bg-white px-3 py-2 dark:border-rose-700 dark:bg-zinc-900 ${retrying ? 'opacity-60' : ''}`}
                >
                    <Icon
                        name="arrow-path"
                        size={16}
                        className="text-rose-700 dark:text-rose-300"
                    />
                    <Text className="text-sm font-medium text-rose-700 dark:text-rose-300">
                        {retrying ? '重試中…' : '重試'}
                    </Text>
                </Pressable>

                {detail ? (
                    <Pressable
                        accessibilityRole="button"
                        accessibilityState={{ expanded }}
                        onPress={() => setExpanded(!expanded)}
                        className="px-2 py-2"
                    >
                        <Text className="text-xs font-medium text-rose-700 underline dark:text-rose-300">
                            {expanded ? '隱藏詳細資料' : '詳細資料'}
                        </Text>
                    </Pressable>
                ) : null}
            </View>

            {detail && expanded ? (
                <View className="mt-3 gap-1 border-t border-rose-200 pt-3 dark:border-rose-800">
                    {rows.map(([label, value]) => (
                        <View key={label} className="flex-row gap-3">
                            <Text className="w-16 text-xs font-medium text-rose-700 dark:text-rose-300">
                                {label}
                            </Text>
                            <Text className="flex-1 font-mono text-xs text-rose-700 dark:text-rose-300">
                                {value}
                            </Text>
                        </View>
                    ))}
                    <View className="mt-2 flex-row flex-wrap gap-2">
                        {onCopy ? (
                            <Pressable
                                accessibilityRole="button"
                                onPress={copy}
                                className="rounded-lg border border-rose-300 bg-white px-3 py-1.5 dark:border-rose-700 dark:bg-zinc-900"
                            >
                                <Text className="text-xs font-medium text-rose-700 dark:text-rose-300">
                                    {copied ? '已複製' : '複製診斷資料'}
                                </Text>
                            </Pressable>
                        ) : null}
                        {onOpenLog ? (
                            <Pressable
                                accessibilityRole="button"
                                onPress={onOpenLog}
                                className="rounded-lg border border-rose-300 bg-white px-3 py-1.5 dark:border-rose-700 dark:bg-zinc-900"
                            >
                                <Text className="text-xs font-medium text-rose-700 dark:text-rose-300">
                                    開啟診斷記錄
                                </Text>
                            </Pressable>
                        ) : null}
                    </View>
                </View>
            ) : null}
        </View>
    );
}

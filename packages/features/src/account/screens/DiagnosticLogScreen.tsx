import type { DiagnosticEventListViewModel } from '@altuu/core';
import { ConfirmDialog, Text } from '@altuu/ui';
import { keepPreviousData, useQueryClient } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import {
    useServiceMutation,
    useServiceQuery,
} from '../../services/useServiceQuery';
import { AccountIcon } from '../components/AccountIcon';
import { DiagnosticEventRow } from '../components/DiagnosticEventRow';
import { SubPage } from '../components/SubPage';
import {
    Card,
    CardTitle,
    ErrorText,
    FlashBanner,
    OutlineButton,
    PillSwitch,
    useFlash,
} from '../components/primitives';
import { useDiagnosticRecording } from '../hooks/useDiagnosticRecording';
import { saveTextFile } from '../lib/files';

function FilterChip({
    label,
    selected,
    onPress,
}: {
    label: string;
    selected: boolean;
    onPress: () => void;
}) {
    return (
        <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={onPress}
            className={`rounded-lg px-2.5 py-1.5 ${
                selected ? 'bg-theme-200 dark:bg-zinc-700' : ''
            }`}
        >
            <Text
                className={`text-xs font-medium ${
                    selected
                        ? 'text-theme-900 dark:text-zinc-100'
                        : 'text-theme-700 dark:text-zinc-400'
                }`}
            >
                {label}
            </Text>
        </Pressable>
    );
}

/** Legacy Settings/DiagnosticLog.vue. */
export function DiagnosticLogScreen() {
    const queryClient = useQueryClient();
    const recording = useDiagnosticRecording();
    const { flash, show } = useFlash();
    const [problemsOnly, setProblemsOnly] = useState(false);
    const [confirmClearOpen, setConfirmClearOpen] = useState(false);
    const [actionError, setActionError] = useState<string | null>(null);

    const log = useServiceQuery<DiagnosticEventListViewModel>({
        op: 'diagnostics.log',
        queryKey: ['diagnostics', 'log', problemsOnly],
        queryFn: (services) =>
            services.diagnostics.listEvents({ problemsOnly }),
        staleTime: 0,
        placeholderData: keepPreviousData,
    });
    const share = useServiceMutation<boolean>({
        op: 'diagnostics.log',
        mutationFn: async (_variables, services) => {
            const bundle = await services.diagnostics.buildBundle();

            return saveTextFile(
                bundle.filename,
                bundle.content,
                'text/markdown',
            );
        },
    });
    const copy = useServiceMutation<boolean>({
        op: 'diagnostics.log',
        mutationFn: async (_variables, services) => {
            const bundle = await services.diagnostics.buildBundle();

            try {
                return await Clipboard.setStringAsync(bundle.content);
            } catch {
                return false;
            }
        },
    });
    const clear = useServiceMutation<void>({
        op: 'diagnostics.log',
        mutationFn: (_variables, services) =>
            services.diagnostics.clearEvents(),
    });

    const events = log.data?.events ?? [];

    const onShare = async () => {
        setActionError(null);

        try {
            if (await share.mutateAsync()) {
                show('已匯出診斷記錄');
            }
        } catch (error) {
            setActionError(
                error instanceof Error
                    ? error.message
                    : '匯出失敗，請稍後再試。',
            );
        }
    };

    const onCopy = async () => {
        setActionError(null);

        try {
            const copied = await copy.mutateAsync();
            show(
                copied ? '已複製診斷記錄' : '複製失敗，請改用分享',
                copied ? 'success' : 'error',
            );
        } catch (error) {
            setActionError(
                error instanceof Error
                    ? error.message
                    : '複製失敗，請稍後再試。',
            );
        }
    };

    const onConfirmClear = async () => {
        setConfirmClearOpen(false);
        setActionError(null);

        try {
            await clear.mutateAsync();
            await queryClient.invalidateQueries({
                queryKey: ['diagnostics', 'log'],
            });
            show('已清除診斷記錄');
        } catch (error) {
            setActionError(
                error instanceof Error
                    ? error.message
                    : '清除失敗，請稍後再試。',
            );
        }
    };

    const onToggleRecording = async (enabled: boolean) => {
        await recording.setRecording(enabled);
        await log.refetch();
    };

    return (
        <SubPage title="診斷記錄" backHref="/settings" wide>
            <FlashBanner flash={flash} />

            {recording.status?.available !== false ? (
                <View
                    className={`rounded-xl border p-4 ${
                        recording.isRecording
                            ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950'
                            : 'border-theme-200 bg-white dark:border-zinc-700 dark:bg-zinc-900'
                    }`}
                >
                    <View className="flex-row items-start justify-between gap-4">
                        <View className="min-w-0 flex-1">
                            <CardTitle>
                                {recording.isRecording
                                    ? '記錄中'
                                    : '診斷記錄未開啟'}
                            </CardTitle>
                            <Text className="mt-1 text-xs leading-relaxed text-theme-700 dark:text-zinc-400">
                                {recording.isRecording
                                    ? `約 ${recording.minutesRemaining} 分鐘後自動關閉。請重現一次問題，再回到這裡分享記錄。`
                                    : `為了節省效能與空間，平常不會記錄。開啟後會記錄 ${recording.status?.windowMinutes ?? 30} 分鐘，接著自動關閉。`}
                            </Text>
                            {recording.error ? (
                                <Text className="mt-1 text-xs text-rose-600 dark:text-rose-400">
                                    {recording.error}
                                </Text>
                            ) : null}
                        </View>
                        <PillSwitch
                            label="切換診斷記錄"
                            tone="green"
                            value={recording.isRecording}
                            disabled={recording.isBusy}
                            onValueChange={(value) =>
                                void onToggleRecording(value)
                            }
                        />
                    </View>
                </View>
            ) : null}

            <Card>
                <Text className="text-xs text-theme-700 dark:text-zinc-400">
                    這裡記錄了 App
                    最近的請求與錯誤。回報問題時，請一併附上這份記錄，可以大幅加快找出問題的速度。
                </Text>
                <Text className="mt-2 text-xs text-theme-700 dark:text-zinc-400">
                    記錄中的帳號資訊已以代號取代，密碼、Cookie
                    與登入憑證則完全不會被記錄。
                </Text>
                <View className="mt-3 gap-2">
                    <OutlineButton
                        icon="arrow-down-tray"
                        label={share.isPending ? '匯出中…' : '分享'}
                        disabled={share.isPending}
                        onPress={() => void onShare()}
                    />
                    <OutlineButton
                        icon="clipboard-document"
                        label={copy.isPending ? '複製中…' : '複製'}
                        disabled={copy.isPending}
                        onPress={() => void onCopy()}
                    />
                    <OutlineButton
                        icon="trash"
                        label="清除"
                        onPress={() => setConfirmClearOpen(true)}
                    />
                </View>
                {actionError ? (
                    <View className="mt-2">
                        <ErrorText>{actionError}</ErrorText>
                    </View>
                ) : null}
            </Card>

            <Card>
                <View className="flex-row items-center justify-between gap-2">
                    <View className="flex-row items-center gap-2">
                        <FilterChip
                            label="全部"
                            selected={!problemsOnly}
                            onPress={() => setProblemsOnly(false)}
                        />
                        <FilterChip
                            label="僅錯誤"
                            selected={problemsOnly}
                            onPress={() => setProblemsOnly(true)}
                        />
                    </View>
                    <Pressable
                        accessibilityRole="button"
                        disabled={log.isFetching}
                        onPress={() => void log.refetch()}
                        className="flex-row items-center gap-1.5"
                    >
                        <AccountIcon
                            name="arrow-path"
                            size={16}
                            className="text-theme-700 dark:text-zinc-400"
                        />
                        <Text className="text-xs text-theme-700 dark:text-zinc-400">
                            重新整理
                        </Text>
                    </Pressable>
                </View>

                {log.error ? (
                    <Text className="mt-3 text-xs text-rose-600 dark:text-rose-400">
                        {log.error.message || '載入診斷記錄失敗。'}
                    </Text>
                ) : !log.isPending && events.length === 0 ? (
                    <Text className="mt-3 text-xs text-theme-700 dark:text-zinc-400">
                        {recording.isRecording
                            ? '目前沒有任何記錄，請重現一次問題。'
                            : '目前沒有任何記錄。請先於上方開啟診斷記錄，再重現一次問題。'}
                    </Text>
                ) : (
                    <View className="mt-2">
                        {events.map((event) => (
                            <DiagnosticEventRow key={event.id} event={event} />
                        ))}
                    </View>
                )}

                {events.length > 0 ? (
                    <Text className="mt-3 text-xs text-theme-700 dark:text-zinc-400">
                        {`顯示 ${events.length} 筆，共 ${log.data?.total ?? 0} 筆。`}
                    </Text>
                ) : null}
            </Card>

            <ConfirmDialog
                isOpen={confirmClearOpen}
                danger
                title="清除診斷記錄"
                message="清除後將無法復原，且先前的錯誤記錄將不再能用於回報問題。"
                confirmLabel="清除"
                onConfirm={() => void onConfirmClear()}
                onCancel={() => setConfirmClearOpen(false)}
            />
        </SubPage>
    );
}

import { Text } from '@altuu/ui';
import { View } from 'react-native';

import {
    Card,
    CardButton,
    EmptyNotice,
    Skeleton,
} from '../components/primitives';
import { useCourseSelfExams } from '../courseQueries';
import { ErrorRetry } from '../../shell/ErrorRetry';
import { openInAppBrowser } from '../../shell/openUrl';

export interface CourseSelfExamTabProps {
    cid: string;
    onOpenedInAppBrowser?: () => void;
}

/** 自我練習 list; exam pages open in the in-app browser with the homework CSS. */
export function CourseSelfExamTab({
    cid,
    onOpenedInAppBrowser,
}: CourseSelfExamTabProps) {
    const exams = useCourseSelfExams(cid, true);

    if (exams.isPending) {
        return (
            <Card accessibilityLabel="載入自我練習中">
                {[0, 1, 2, 3].map((row) => (
                    <Skeleton key={row} className="mb-3 h-5 w-3/5" />
                ))}
            </Card>
        );
    }

    if (exams.isError) {
        return (
            <ErrorRetry
                error={exams.error}
                retrying={exams.isFetching}
                onRetry={() => void exams.refetch()}
            />
        );
    }

    if (exams.data.length === 0) {
        return <EmptyNotice>目前沒有可顯示的自我練習。</EmptyNotice>;
    }

    const open = (url: string) => {
        onOpenedInAppBrowser?.();
        openInAppBrowser(url, { cssPreset: 'homework' });
    };

    return (
        <View className="gap-3">
            {exams.data.map((item, index) => (
                <Card key={`${item.type}-${item.title}-${index}`}>
                    <View className="flex-row items-start justify-between gap-2">
                        <Text className="min-w-0 flex-1 text-base font-semibold text-theme-900 dark:text-zinc-100">
                            {item.title}
                        </Text>
                        {item.isSubmitted ? (
                            <View className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 dark:bg-emerald-900/40">
                                <Text className="text-xs font-medium text-emerald-800 dark:text-emerald-300">
                                    繳交完成
                                </Text>
                            </View>
                        ) : null}
                    </View>

                    <View className="mt-3 flex-row flex-wrap gap-2">
                        <CardButton
                            label="進行練習"
                            disabled={!item.actionUrl}
                            onPress={() =>
                                item.actionUrl && open(item.actionUrl)
                            }
                        />
                        <CardButton
                            label="檢視結果"
                            variant="outline"
                            disabled={!item.resultUrl}
                            onPress={() =>
                                item.resultUrl && open(item.resultUrl)
                            }
                        />
                    </View>

                    {!item.resultUrl && item.resultUnavailableReason ? (
                        <Text className="mt-2 text-xs text-theme-600 dark:text-zinc-400">
                            無法檢視結果：{item.resultUnavailableReason}
                        </Text>
                    ) : null}
                </Card>
            ))}
        </View>
    );
}

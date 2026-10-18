import type {
    CourseHomeworkItem,
    CourseSchoolPortalHomeworkNotice,
} from '@altuu/core';
import { Text } from '@altuu/ui';
import { useState } from 'react';
import { View } from 'react-native';

import { NoViewerSheet } from '../attachments/NoViewerSheet';
import { useAttachmentDownload } from '../attachments/useAttachmentDownload';
import {
    Card,
    CardButton,
    EmptyNotice,
    Skeleton,
} from '../components/primitives';
import { useCourseHomeworks } from '../courseQueries';
import { ErrorRetry } from '../../shell/ErrorRetry';
import { openInAppBrowser } from '../../shell/openUrl';

/** Legacy `extractDownloadFilename`: the portal's `filename` query value + .pdf. */
export function extractDownloadFilename(url: string): string | null {
    const match = /[?&]filename=([^&#]*)/.exec(url);

    if (!match) {
        return null;
    }

    try {
        const filename = decodeURIComponent(match[1].replace(/\+/g, ' '));

        return filename ? `${filename}.pdf` : null;
    } catch {
        return null;
    }
}

export interface CourseHomeworkTabProps {
    cid: string;
    /** Called when a homework page was opened, so the screen can refresh on return. */
    onOpenedInAppBrowser?: () => void;
}

/** 作業: HUNGU homework items plus school portal attachment notices. */
export function CourseHomeworkTab({
    cid,
    onOpenedInAppBrowser,
}: CourseHomeworkTabProps) {
    const homeworks = useCourseHomeworks(cid, true);
    const attachment = useAttachmentDownload();
    const [activeIndex, setActiveIndex] = useState<number | null>(null);

    if (homeworks.isPending) {
        return (
            <Card accessibilityLabel="載入作業中">
                {[0, 1, 2, 3].map((row) => (
                    <View key={row} className="mb-3">
                        <Skeleton className="h-5 w-3/5" />
                        <Skeleton className="mt-2 h-4 w-2/5" />
                    </View>
                ))}
            </Card>
        );
    }

    if (homeworks.isError) {
        return (
            <ErrorRetry
                error={homeworks.error}
                retrying={homeworks.isFetching}
                onRetry={() => void homeworks.refetch()}
            />
        );
    }

    const items: CourseHomeworkItem[] = homeworks.data.homeworkItems;
    const notices: CourseSchoolPortalHomeworkNotice[] =
        homeworks.data.schoolPortalNotices;

    if (items.length === 0 && notices.length === 0) {
        return <EmptyNotice>目前沒有可顯示的作業。</EmptyNotice>;
    }

    const downloading = attachment.state.status === 'downloading';

    const downloadNotice = async (index: number, url: string) => {
        if (downloading) {
            return;
        }

        setActiveIndex(index);
        await attachment.start({
            source: 'schoolPortal',
            url,
            fileName: extractDownloadFilename(url),
        });
    };

    const openHomework = (url: string) => {
        onOpenedInAppBrowser?.();
        openInAppBrowser(url, { cssPreset: 'homework' });
    };

    return (
        <View className="gap-6">
            {notices.length > 0 ? (
                <View className="gap-3">
                    <Text className="text-sm font-semibold text-theme-700 dark:text-zinc-300">
                        教務系統作業附件
                    </Text>
                    {notices.map((notice, index) => {
                        const isDownloading =
                            downloading && activeIndex === index;
                        const progress =
                            attachment.state.status === 'downloading'
                                ? attachment.state.progress
                                : null;

                        return (
                            <Card
                                key={`school-portal-${notice.title}-${index}`}
                            >
                                <Text className="text-base font-semibold text-theme-900 dark:text-zinc-100">
                                    {notice.title}
                                </Text>
                                {notice.dueDate ? (
                                    <Text className="mt-1 text-sm text-theme-700 dark:text-zinc-300">
                                        {notice.dueDate}
                                    </Text>
                                ) : null}
                                {notice.submissionMethod ? (
                                    <Text className="mt-1 text-xs text-theme-700 dark:text-zinc-400">
                                        繳交方式：{notice.submissionMethod}
                                    </Text>
                                ) : null}
                                {attachment.state.status === 'error' &&
                                activeIndex === index ? (
                                    <Text className="mt-1 text-xs text-rose-600 dark:text-rose-400">
                                        {attachment.state.message}
                                    </Text>
                                ) : null}
                                <View className="mt-3 flex-row items-center gap-3">
                                    <CardButton
                                        label={
                                            isDownloading
                                                ? '下載中...'
                                                : '下載附件'
                                        }
                                        disabled={
                                            !notice.downloadUrl || downloading
                                        }
                                        onPress={() =>
                                            notice.downloadUrl &&
                                            void downloadNotice(
                                                index,
                                                notice.downloadUrl,
                                            )
                                        }
                                    />
                                    {isDownloading && progress !== null ? (
                                        <Text className="text-xs text-theme-700 dark:text-zinc-400">
                                            {Math.round(progress * 100)}%
                                        </Text>
                                    ) : null}
                                </View>
                            </Card>
                        );
                    })}
                </View>
            ) : null}

            {items.length > 0 ? (
                <View className="gap-3">
                    {notices.length > 0 ? (
                        <Text className="text-sm font-semibold text-theme-700 dark:text-zinc-300">
                            數位學習平台作業
                        </Text>
                    ) : null}
                    {items.map((item, index) => (
                        <Card key={`${item.type}-${item.title}-${index}`}>
                            <View className="flex-row flex-wrap items-center gap-2">
                                <Text className="text-base font-semibold text-theme-900 dark:text-zinc-100">
                                    {item.title}
                                </Text>
                                {item.percent ? (
                                    <View className="rounded-full bg-theme-100 px-2 py-0.5 dark:bg-zinc-800">
                                        <Text className="text-xs text-theme-800 dark:text-zinc-300">
                                            {item.percent}
                                        </Text>
                                    </View>
                                ) : null}
                            </View>
                            {item.status ? (
                                <Text className="mt-1 text-sm text-theme-700 dark:text-zinc-300">
                                    {item.status}
                                </Text>
                            ) : null}
                            {item.window ? (
                                <Text className="mt-1 text-xs text-theme-700 dark:text-zinc-400">
                                    {item.window}
                                </Text>
                            ) : null}
                            <View className="mt-3 flex-row flex-wrap gap-2">
                                <CardButton
                                    label="進行作業"
                                    disabled={!item.actionUrl}
                                    onPress={() =>
                                        item.actionUrl &&
                                        openHomework(item.actionUrl)
                                    }
                                />
                                <CardButton
                                    label="檢視結果"
                                    variant="outline"
                                    disabled={!item.resultUrl}
                                    onPress={() =>
                                        item.resultUrl &&
                                        openHomework(item.resultUrl)
                                    }
                                />
                            </View>
                        </Card>
                    ))}
                </View>
            ) : null}

            <NoViewerSheet
                visible={attachment.state.status === 'noViewer'}
                onSave={() => void attachment.saveFile()}
                onDismiss={attachment.dismiss}
            />
        </View>
    );
}

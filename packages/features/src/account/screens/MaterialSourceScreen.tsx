import type {
    CourseItem,
    MaterialDirectoryInspectionViewModel,
    MaterialDirectoryNodeViewModel,
    MaterialSourceInspectionViewModel,
} from '@altuu/core';
import { Sheet, Text } from '@altuu/ui';
import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { useAppConfig } from '../../services/hooks';
import { useServiceQuery } from '../../services/useServiceQuery';
import { ErrorRetry } from '../../shell/ErrorRetry';
import { AccountIcon } from '../components/AccountIcon';
import { SubPage } from '../components/SubPage';
import {
    Card,
    CardDescription,
    CardTitle,
    FlashBanner,
    OutlineButton,
    useFlash,
} from '../components/primitives';
import { LoadingCard } from '../components/states';
import {
    PARSE_KIND_LABEL,
    directoryReport,
    sourceReport,
    verdictFor,
} from '../lib/materialReport';

function Mono({
    children,
    className = '',
}: {
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <Text
            selectable
            className={`font-mono text-[11px] text-theme-700 dark:text-zinc-400 ${className}`}
        >
            {children}
        </Text>
    );
}

function CodeBlock({ children }: { children: string }) {
    return (
        <ScrollView
            nestedScrollEnabled
            className="mt-2 max-h-96 rounded-lg bg-theme-50 p-3 dark:bg-zinc-800"
        >
            <Text
                selectable
                className="font-mono text-[11px] leading-relaxed text-theme-800 dark:text-zinc-200"
            >
                {children}
            </Text>
        </ScrollView>
    );
}

function FactRow({
    label,
    children,
}: {
    label: string;
    children: React.ReactNode;
}) {
    return (
        <View className="flex-row gap-3">
            <Text className="w-24 text-xs font-medium">{label}</Text>
            <View className="min-w-0 flex-1">{children}</View>
        </View>
    );
}

/** Legacy Settings/MaterialSource.vue (only linked when the build flag is on). */
export function MaterialSourceScreen() {
    const config = useAppConfig();
    const { flash, show } = useFlash();
    const [selectedCid, setSelectedCid] = useState('');
    const [pickerOpen, setPickerOpen] = useState(false);
    const [activeScoid, setActiveScoid] = useState('');
    const [showRawJson, setShowRawJson] = useState(false);

    const courses = useServiceQuery<CourseItem[]>({
        op: 'courses.list',
        queryKey: ['account', 'material-source', 'courses'],
        queryFn: (services) => services.course.listCourses(),
    });
    const directory = useServiceQuery<MaterialDirectoryInspectionViewModel>({
        op: 'diagnostics.material',
        queryKey: ['account', 'material-source', 'directory', selectedCid],
        queryFn: (services) =>
            services.diagnostics.inspectMaterialDirectory(selectedCid),
        enabled: selectedCid !== '',
        staleTime: 0,
    });
    const source = useServiceQuery<MaterialSourceInspectionViewModel>({
        op: 'diagnostics.material',
        queryKey: [
            'account',
            'material-source',
            'source',
            selectedCid,
            activeScoid,
        ],
        queryFn: (services) =>
            services.diagnostics.inspectMaterialSource(
                selectedCid,
                activeScoid,
            ),
        enabled: selectedCid !== '' && activeScoid !== '',
        staleTime: 0,
    });

    const selectedCourseName = courses.data?.find(
        (course) => course.courseId === selectedCid,
    )?.name;
    const isViewingSource = activeScoid !== '';
    const sourceData = source.data;
    const verdict = sourceData ? verdictFor(sourceData) : null;

    const copy = async (text: string, label: string) => {
        let copied = false;

        try {
            copied = await Clipboard.setStringAsync(text);
        } catch {
            copied = false;
        }

        show(
            copied ? `已複製${label}` : '複製失敗，請稍後再試',
            copied ? 'success' : 'error',
        );
    };

    const selectCourse = (cid: string) => {
        setSelectedCid(cid);
        setActiveScoid('');
        setShowRawJson(false);
        setPickerOpen(false);
    };

    // Not enabled in this build: the Settings screen never links here.
    if (config.data && !config.data.materialSourceViewerEnabled) {
        return (
            <SubPage title="教材來源檢視" backHref="/settings" wide>
                <Card>
                    <CardDescription>
                        此版本未開啟教材來源檢視。
                    </CardDescription>
                </Card>
            </SubPage>
        );
    }

    return (
        <SubPage
            title="教材來源檢視"
            backHref="/settings"
            onBack={isViewingSource ? () => setActiveScoid('') : undefined}
            wide
        >
            <FlashBanner flash={flash} />

            {isViewingSource ? null : (
                <Card>
                    <CardDescription>
                        當教材目錄或內容顯示不出來時，可以在這裡看到學校實際送來的資料：目錄中每個節點的網址，以及每個節點頁面的原始碼與解析結果。
                    </CardDescription>
                    <CardDescription className="mt-2">
                        原始碼中的密碼、Cookie
                        與登入憑證已遮蔽，但頁面內容可能包含您的姓名或學號，分享前請先檢查。
                    </CardDescription>

                    <View className="mt-4">
                        <CardTitle>選擇課程</CardTitle>
                        <Pressable
                            accessibilityRole="button"
                            accessibilityLabel="選擇課程"
                            disabled={courses.isPending}
                            onPress={() => setPickerOpen(true)}
                            className="mt-1 flex-row items-center justify-between rounded-lg border border-theme-300 bg-theme-50 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-800"
                        >
                            <Text
                                numberOfLines={1}
                                className="min-w-0 flex-1 text-sm text-theme-900 dark:text-zinc-100"
                            >
                                {courses.isPending
                                    ? '載入課程中…'
                                    : (selectedCourseName ?? '請選擇課程')}
                            </Text>
                            <AccountIcon
                                name="chevron-down"
                                size={16}
                                className="text-theme-700 dark:text-zinc-400"
                            />
                        </Pressable>
                        {courses.error ? (
                            <Text className="mt-2 text-xs text-rose-600 dark:text-rose-400">
                                {courses.error.message}
                            </Text>
                        ) : null}
                    </View>
                </Card>
            )}

            {!isViewingSource && selectedCid !== '' ? (
                directory.isFetching && !directory.data ? (
                    <LoadingCard>載入教材目錄中…</LoadingCard>
                ) : directory.error ? (
                    <ErrorRetry
                        error={directory.error}
                        retrying={directory.isFetching}
                        onRetry={() => void directory.refetch()}
                    />
                ) : directory.data ? (
                    <Card>
                        <View className="flex-row items-start justify-between gap-2">
                            <View className="min-w-0 flex-1">
                                <CardTitle>
                                    {`教材目錄（${directory.data.nodeCount} 個節點）`}
                                </CardTitle>
                                <CardDescription>
                                    {`學校回應：code=${directory.data.apiCode ?? '無'}${directory.data.apiMessage ? ` · ${directory.data.apiMessage}` : ''}`}
                                </CardDescription>
                            </View>
                            <OutlineButton
                                icon="clipboard-document"
                                label="複製目錄"
                                onPress={() =>
                                    void copy(
                                        directoryReport(
                                            directory.data,
                                            selectedCid,
                                            selectedCourseName,
                                        ),
                                        '教材目錄',
                                    )
                                }
                                className="shrink-0"
                            />
                        </View>

                        {directory.data.nodeCount === 0 ? (
                            <CardDescription className="mt-3">
                                學校沒有回傳任何節點。這通常代表目錄本身是空的，或學校的回應格式有變，請展開下方原始
                                JSON 檢視。
                            </CardDescription>
                        ) : (
                            <View className="mt-3">
                                {directory.data.nodes.map(
                                    (
                                        node: MaterialDirectoryNodeViewModel,
                                        index,
                                    ) => (
                                        <View
                                            key={`${node.identifier}-${index}`}
                                            className="flex-row items-start justify-between gap-3 border-t border-theme-200 py-2 dark:border-zinc-700"
                                            style={{
                                                paddingLeft: node.level * 16,
                                            }}
                                        >
                                            <View className="min-w-0 flex-1">
                                                <Text className="text-sm text-theme-900 dark:text-zinc-100">
                                                    {node.text || '（無標題）'}
                                                    {node.itemDisabled
                                                        ? '  [已停用]'
                                                        : ''}
                                                </Text>
                                                <Mono>{node.identifier}</Mono>
                                                <Mono>
                                                    {node.href ?? '（無連結）'}
                                                </Mono>
                                            </View>
                                            {node.isInspectable ? (
                                                <OutlineButton
                                                    label="檢視內容"
                                                    onPress={() =>
                                                        setActiveScoid(
                                                            node.identifier,
                                                        )
                                                    }
                                                    className="shrink-0"
                                                />
                                            ) : null}
                                        </View>
                                    ),
                                )}
                            </View>
                        )}

                        <View className="mt-4 border-t border-theme-200 pt-3 dark:border-zinc-700">
                            <View className="flex-row items-center justify-between gap-2">
                                <Pressable
                                    accessibilityRole="button"
                                    accessibilityState={{
                                        expanded: showRawJson,
                                    }}
                                    onPress={() =>
                                        setShowRawJson((value) => !value)
                                    }
                                >
                                    <Text className="text-xs font-medium text-theme-700 underline dark:text-zinc-300">
                                        {showRawJson
                                            ? '隱藏原始 JSON'
                                            : '顯示原始 JSON'}
                                    </Text>
                                </Pressable>
                                {showRawJson ? (
                                    <Pressable
                                        accessibilityRole="button"
                                        onPress={() =>
                                            void copy(
                                                directory.data.rawJson,
                                                '原始 JSON',
                                            )
                                        }
                                        className="flex-row items-center gap-1.5"
                                    >
                                        <AccountIcon
                                            name="clipboard-document"
                                            size={16}
                                            className="text-theme-700 dark:text-zinc-400"
                                        />
                                        <Text className="text-xs text-theme-700 dark:text-zinc-400">
                                            複製
                                        </Text>
                                    </Pressable>
                                ) : null}
                            </View>
                            {showRawJson ? (
                                <>
                                    <CodeBlock>
                                        {directory.data.rawJson}
                                    </CodeBlock>
                                    {directory.data.rawJsonTruncated ? (
                                        <CardDescription>
                                            內容過長，已截斷。
                                        </CardDescription>
                                    ) : null}
                                </>
                            ) : null}
                        </View>
                    </Card>
                ) : null
            ) : null}

            {isViewingSource ? (
                source.isFetching && !sourceData ? (
                    <LoadingCard>載入教材原始碼中…</LoadingCard>
                ) : source.error ? (
                    <ErrorRetry
                        error={source.error}
                        retrying={source.isFetching}
                        onRetry={() => void source.refetch()}
                    />
                ) : sourceData ? (
                    <>
                        <Card>
                            <View className="flex-row items-start justify-between gap-2">
                                <View className="min-w-0 flex-1">
                                    <CardTitle>
                                        {sourceData.nodeText ||
                                            sourceData.scoid}
                                    </CardTitle>
                                </View>
                                <OutlineButton
                                    icon="clipboard-document"
                                    label="複製全部"
                                    onPress={() =>
                                        void copy(
                                            sourceReport(
                                                sourceData,
                                                selectedCourseName,
                                            ),
                                            '教材來源',
                                        )
                                    }
                                    className="shrink-0"
                                />
                            </View>

                            {verdict ? (
                                <View className="mt-3 rounded-lg bg-amber-50 p-3 dark:bg-amber-950">
                                    <Text className="text-xs text-amber-800 dark:text-amber-200">
                                        {verdict}
                                    </Text>
                                </View>
                            ) : null}

                            <View className="mt-3 gap-1">
                                <FactRow label="網址">
                                    <Mono>{sourceData.url}</Mono>
                                </FactRow>
                                <FactRow label="HTTP 狀態">
                                    <Mono>
                                        {String(
                                            sourceData.fetchStatus ??
                                                '無（未取得回應）',
                                        )}
                                    </Mono>
                                </FactRow>
                                <FactRow label="Content-Type">
                                    <Mono>
                                        {sourceData.contentType ?? '未知'}
                                    </Mono>
                                </FactRow>
                                <FactRow label="大小">
                                    <Mono>{`${sourceData.bodyBytes} bytes`}</Mono>
                                </FactRow>
                                <FactRow label="解析結果">
                                    <Text className="text-xs">
                                        {PARSE_KIND_LABEL[
                                            sourceData.parse.kind
                                        ] ?? sourceData.parse.kind}
                                        {sourceData.parse.kind === 'html'
                                            ? `（${sourceData.parse.htmlLength} 字元）`
                                            : ''}
                                    </Text>
                                </FactRow>
                                {sourceData.parse.videoUrl ? (
                                    <FactRow label="影片網址">
                                        <Mono>{sourceData.parse.videoUrl}</Mono>
                                    </FactRow>
                                ) : null}
                                {sourceData.fetchError ? (
                                    <FactRow label="取得失敗">
                                        <Mono className="text-rose-700 dark:text-rose-300">
                                            {sourceData.fetchError}
                                        </Mono>
                                    </FactRow>
                                ) : null}
                                {sourceData.parse.errorClass ? (
                                    <FactRow label="解析錯誤">
                                        <Mono className="text-rose-700 dark:text-rose-300">
                                            {`${sourceData.parse.errorClass}: ${sourceData.parse.errorMessage}\n${sourceData.parse.errorLocation}`}
                                        </Mono>
                                    </FactRow>
                                ) : null}
                            </View>
                        </Card>

                        <Card>
                            <CardTitle>原始碼</CardTitle>
                            {sourceData.body === null ? (
                                <CardDescription className="mt-2">
                                    {sourceData.fetchError
                                        ? '沒有取得任何內容。'
                                        : '這不是文字內容（例如 PDF 或圖片），因此不顯示原始碼。'}
                                </CardDescription>
                            ) : sourceData.body === '' ? (
                                <CardDescription className="mt-2">
                                    學校回傳的內容是空的。
                                </CardDescription>
                            ) : (
                                <>
                                    <CodeBlock>{sourceData.body}</CodeBlock>
                                    {sourceData.bodyTruncated ? (
                                        <CardDescription>
                                            {`內容過長，已截斷；完整大小為 ${sourceData.bodyBytes} bytes。`}
                                        </CardDescription>
                                    ) : null}
                                </>
                            )}
                        </Card>
                    </>
                ) : null
            ) : null}

            <Sheet visible={pickerOpen} onClose={() => setPickerOpen(false)}>
                <View className="px-5 py-4">
                    <Text className="text-lg font-semibold text-theme-900 dark:text-zinc-100">
                        選擇課程
                    </Text>
                </View>
                <ScrollView
                    className="max-h-80 border-t border-theme-200 dark:border-zinc-700"
                    bounces={false}
                >
                    {(courses.data ?? []).map((course) => (
                        <Pressable
                            key={course.courseId}
                            accessibilityRole="button"
                            onPress={() => selectCourse(course.courseId)}
                            className="px-5 py-3 active:bg-theme-50 dark:active:bg-zinc-800"
                        >
                            <Text
                                className={`text-sm ${
                                    course.courseId === selectedCid
                                        ? 'font-semibold'
                                        : ''
                                }`}
                            >
                                {course.name}
                            </Text>
                        </Pressable>
                    ))}
                </ScrollView>
            </Sheet>
        </SubPage>
    );
}

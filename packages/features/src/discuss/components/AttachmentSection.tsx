import type { AttachmentViewModel } from '@altuu/core';
import { ConfirmDialog, Sheet, Text, Icon } from '@altuu/ui';
import { Image, type ImageSource } from 'expo-image';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import {
    isImageAttachment,
    useAttachmentRequest,
    useOpenAttachment,
} from '../attachments';

export interface AttachmentSectionProps {
    cid: string;
    attachments: AttachmentViewModel[];
    onOpenImage: (source: ImageSource, alt: string | null) => void;
}

const attachmentKey = (attachment: AttachmentViewModel): string =>
    attachment.href ?? attachment.filename ?? '';

/**
 * Legacy attachment block: image attachments as 96px thumbnails that open the
 * lightbox, everything else as a link that asks before downloading and then
 * opens the file with the OS viewer.
 */
export function AttachmentSection({
    cid,
    attachments,
    onOpenImage,
}: AttachmentSectionProps) {
    const [failedImages, setFailedImages] = useState<ReadonlySet<string>>(
        new Set(),
    );
    const [pending, setPending] = useState<AttachmentViewModel | null>(null);
    const opener = useOpenAttachment(cid);

    const isDisplayableImage = (attachment: AttachmentViewModel): boolean =>
        !!attachment.href &&
        isImageAttachment(attachment.filename, attachment.href) &&
        !failedImages.has(attachmentKey(attachment));
    const images = attachments.filter(isDisplayableImage);
    const files = attachments.filter(
        (attachment) => !isDisplayableImage(attachment),
    );

    const confirmDownload = () => {
        const target = pending;

        setPending(null);

        if (target?.href) {
            opener.mutate({
                href: target.href,
                filename: target.filename,
            });
        }
    };

    return (
        <View className="mt-3 rounded-lg border border-theme-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900">
            <Text className="mb-2 text-xs font-semibold text-theme-700 dark:text-zinc-300">
                附件 ({attachments.length})
            </Text>

            {images.length > 0 ? (
                <View className="mb-2 flex-row flex-wrap gap-2">
                    {images.map((attachment, index) => (
                        <AttachmentThumbnail
                            key={attachmentKey(attachment) || index}
                            cid={cid}
                            attachment={attachment}
                            onOpen={onOpenImage}
                            onFailed={() =>
                                setFailedImages(
                                    (current) =>
                                        new Set([
                                            ...current,
                                            attachmentKey(attachment),
                                        ]),
                                )
                            }
                        />
                    ))}
                </View>
            ) : null}

            {files.length > 0 ? (
                <View className="gap-1">
                    {files.map((attachment, index) => (
                        <View
                            key={attachmentKey(attachment) || index}
                            className="flex-row items-center gap-2"
                        >
                            <Icon
                                name="paper-clip"
                                size={16}
                                className="text-theme-700 dark:text-zinc-500"
                            />
                            {attachment.href ? (
                                <Pressable
                                    accessibilityRole="link"
                                    onPress={() => setPending(attachment)}
                                    className="min-w-0 flex-1"
                                >
                                    <Text className="text-sm text-theme-700 underline dark:text-zinc-300">
                                        {attachment.filename ?? attachment.href}
                                    </Text>
                                </Pressable>
                            ) : (
                                <Text className="min-w-0 flex-1 text-sm text-theme-700 dark:text-zinc-300">
                                    {attachment.filename ?? '檔案'}
                                </Text>
                            )}
                        </View>
                    ))}
                </View>
            ) : null}

            <ConfirmDialog
                isOpen={pending !== null}
                title="下載附件"
                message={`確定要下載並開啟「${pending?.filename ?? '此附件'}」嗎？`}
                confirmLabel="確認下載"
                onConfirm={confirmDownload}
                onCancel={() => setPending(null)}
            />

            <Sheet
                visible={opener.isPending}
                onClose={() => undefined}
                dismissOnBackdrop={false}
                placement="center"
            >
                <View className="flex-row items-center gap-3 px-5 py-4">
                    <ActivityIndicator />
                    <View className="min-w-0 flex-1">
                        <Text className="text-sm font-semibold text-theme-900 dark:text-zinc-100">
                            正在處理附件
                        </Text>
                        <Text className="mt-1 text-xs text-theme-700 dark:text-zinc-400">
                            正在下載附件，請稍候…
                        </Text>
                    </View>
                </View>
            </Sheet>

            <ConfirmDialog
                isOpen={opener.isError}
                title="下載失敗"
                message={opener.error?.message ?? ''}
                confirmLabel="確定"
                cancelLabel="關閉"
                onConfirm={() => opener.reset()}
                onCancel={() => opener.reset()}
            />
        </View>
    );
}

interface AttachmentThumbnailProps {
    cid: string;
    attachment: AttachmentViewModel;
    onOpen: (source: ImageSource, alt: string | null) => void;
    onFailed: () => void;
}

function AttachmentThumbnail({
    cid,
    attachment,
    onOpen,
    onFailed,
}: AttachmentThumbnailProps) {
    const request = useAttachmentRequest(cid, attachment.href as string, true);

    const failed = request.isError;

    useEffect(() => {
        if (failed) {
            onFailed();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [failed]);

    if (failed) {
        return null;
    }

    if (request.data === undefined) {
        return (
            <View className="size-24 items-center justify-center rounded-lg border border-theme-200 dark:border-zinc-700">
                <ActivityIndicator />
            </View>
        );
    }

    const source: ImageSource = {
        uri: request.data.url,
        headers: request.data.headers,
    };
    const alt = attachment.filename ?? '附件圖片';

    return (
        <Pressable
            accessibilityRole="imagebutton"
            accessibilityLabel={alt}
            onPress={() => onOpen(source, alt)}
            className="overflow-hidden rounded-lg border border-theme-200 dark:border-zinc-700"
        >
            <Image
                source={source}
                accessibilityLabel={alt}
                contentFit="cover"
                onError={onFailed}
                style={{ width: 96, height: 96 }}
            />
        </Pressable>
    );
}

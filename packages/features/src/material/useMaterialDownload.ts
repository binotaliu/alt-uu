import {
    isAttachmentBridgeError,
    previewFile,
    saveFile,
    startDownload,
    type DownloadResult,
} from '@altuu/attachment-bridge';
import type { MaterialFetchDescriptor } from '@altuu/core';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useAppServices } from '../services/AppServicesProvider';
import { descriptorToDownloadRequest } from './materialCookies';

export const DOWNLOAD_FAILED_MESSAGE = '下載失敗，請稍後再試。';

export interface MaterialDownloadRequest {
    cid: string;
    /** `content.downloadUrl` (the upstream material URL). */
    url: string;
    /** `content.download`, used when a fresh descriptor cannot be prepared. */
    descriptor: MaterialFetchDescriptor | null;
    fileName: string;
}

export interface MaterialDownloadState {
    isDownloading: boolean;
    /** 0–1, or null while the size is unknown. */
    progress: number | null;
    error: string | null;
    download: (request: MaterialDownloadRequest) => Promise<void>;
}

/**
 * Downloads a PDF / file material through the attachment bridge with the
 * HUNGU session (legacy queued `DownloadAttachmentJob` + poll), then
 * previews it; when nothing can preview the type the save dialog opens.
 */
export function useMaterialDownload(): MaterialDownloadState {
    const services = useAppServices();
    const [isDownloading, setIsDownloading] = useState(false);
    const [progress, setProgress] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);
    const busyRef = useRef(false);
    const cancelRef = useRef<(() => Promise<boolean>) | null>(null);

    useEffect(
        () => () => {
            void cancelRef.current?.();
        },
        [],
    );

    const download = useCallback(
        async (request: MaterialDownloadRequest) => {
            if (busyRef.current) {
                return;
            }

            busyRef.current = true;
            setIsDownloading(true);
            setProgress(null);
            setError(null);

            try {
                let descriptor = request.descriptor;

                try {
                    // Fresh cookies, and go-course first like legacy `?cid=`.
                    descriptor = await services.course.prepareMaterialFetch(
                        request.url,
                        { cid: request.cid },
                    );
                } catch (prepareError) {
                    if (descriptor === null) {
                        throw prepareError;
                    }
                }

                const started = startDownload({
                    ...descriptorToDownloadRequest(
                        descriptor ?? { url: request.url, headers: {} },
                    ),
                    fileName: request.fileName,
                    onProgress: (event) => {
                        setProgress(
                            event.totalBytes > 0
                                ? Math.min(
                                      1,
                                      event.bytesWritten / event.totalBytes,
                                  )
                                : null,
                        );
                    },
                });

                cancelRef.current = started.cancel;
                const result: DownloadResult = await started.promise;

                cancelRef.current = null;
                await presentDownloadedFile(result);
            } catch (caught) {
                if (
                    !isAttachmentBridgeError(caught, 'ERR_DOWNLOAD_CANCELLED')
                ) {
                    setError(
                        caught instanceof Error && caught.message
                            ? caught.message
                            : DOWNLOAD_FAILED_MESSAGE,
                    );
                }
            } finally {
                busyRef.current = false;
                setIsDownloading(false);
            }
        },
        [services],
    );

    return { isDownloading, progress, error, download };
}

/** Preview, or the save dialog when no viewer handles the type. */
export async function presentDownloadedFile(
    result: DownloadResult,
): Promise<void> {
    try {
        await previewFile(result.uri, result.mimeType);
    } catch (previewError) {
        if (!isAttachmentBridgeError(previewError, 'ERR_NO_VIEWER')) {
            throw previewError;
        }

        await saveFile(result.uri, result.fileName, result.mimeType);
    }
}

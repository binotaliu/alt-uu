import {
    download,
    type BridgeCookie,
    isAttachmentBridgeError,
    previewFile,
    saveFile,
    type DownloadResult,
} from '@altuu/attachment-bridge';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useServiceRuntime } from '../../services/AppServicesProvider';
import { toDownloadOptions, type FetchDescriptor } from './downloadRequest';

export type AttachmentRequest =
    | { source: 'schoolPortal'; url: string; fileName?: string | null }
    /** Caller already has the request pieces (in-app browser downloads). */
    | {
          source: 'direct';
          url: string;
          fileName?: string | null;
          headers?: Record<string, string>;
          cookies?: BridgeCookie[];
      }
    | { source: 'hungu'; url: string; fileName?: string | null; cid?: string };

export type AttachmentDownloadState =
    | { status: 'idle' }
    | {
          status: 'downloading';
          /** 0..1, or null while the size is unknown. */
          progress: number | null;
      }
    | { status: 'error'; message: string }
    /** Downloaded, but no installed app can open it: offer to save it. */
    | { status: 'noViewer'; file: DownloadResult };

const DOWNLOAD_FAILED = '下載失敗，請稍後再試。';

export interface AttachmentDownload {
    state: AttachmentDownloadState;
    start: (request: AttachmentRequest) => Promise<void>;
    /** Exports the file of a `noViewer` state through the system picker. */
    saveFile: () => Promise<void>;
    dismiss: () => void;
}

/**
 * Download → preview flow for attachments (school portal homework files,
 * HUNGU materials): fetches the session descriptor from the services, runs
 * the cookie-isolated attachment-bridge download with progress, then opens
 * the file. `ERR_NO_VIEWER` leaves the file around so the UI can offer
 * `saveFile`. Replaces the legacy download-task queue and its polling.
 */
export function useAttachmentDownload(): AttachmentDownload {
    const runtime = useServiceRuntime();
    const [state, setState] = useState<AttachmentDownloadState>({
        status: 'idle',
    });
    const busy = useRef(false);
    const mounted = useRef(true);

    useEffect(() => {
        mounted.current = true;

        return () => {
            mounted.current = false;
        };
    }, []);

    const update = useCallback((next: AttachmentDownloadState) => {
        if (mounted.current) {
            setState(next);
        }
    }, []);

    const start = useCallback(
        async (request: AttachmentRequest) => {
            if (busy.current) {
                return;
            }

            busy.current = true;
            update({ status: 'downloading', progress: null });

            try {
                const options =
                    request.source === 'direct'
                        ? {
                              url: request.url,
                              headers: request.headers,
                              cookies: request.cookies,
                              fileName: request.fileName ?? undefined,
                          }
                        : toDownloadOptions(
                              await runtime.run<FetchDescriptor>(
                                  'attachments.tasks',
                                  async () =>
                                      request.source === 'schoolPortal'
                                          ? runtime.services.schoolPortal.proxy.downloadHandoff(
                                                request.url,
                                            )
                                          : runtime.services.course.prepareMaterialFetch(
                                                request.url,
                                                { cid: request.cid },
                                            ),
                              ),
                              request.fileName,
                          );
                const file = await download({
                    ...options,
                    onProgress: ({ bytesWritten, totalBytes }) =>
                        update({
                            status: 'downloading',
                            progress:
                                totalBytes > 0
                                    ? Math.min(bytesWritten / totalBytes, 1)
                                    : null,
                        }),
                });

                try {
                    await previewFile(file.uri, file.mimeType);
                    update({ status: 'idle' });
                } catch (error) {
                    if (isAttachmentBridgeError(error, 'ERR_NO_VIEWER')) {
                        update({ status: 'noViewer', file });
                    } else {
                        throw error;
                    }
                }
            } catch (error) {
                update({
                    status: 'error',
                    message:
                        error instanceof Error && error.message
                            ? error.message
                            : DOWNLOAD_FAILED,
                });
            } finally {
                busy.current = false;
            }
        },
        [runtime, update],
    );

    const save = useCallback(async () => {
        if (state.status !== 'noViewer') {
            return;
        }

        const { file } = state;

        try {
            await saveFile(file.uri, file.fileName, file.mimeType);
            update({ status: 'idle' });
        } catch (error) {
            update({
                status: 'error',
                message:
                    error instanceof Error && error.message
                        ? error.message
                        : '儲存失敗，請稍後再試。',
            });
        }
    }, [state, update]);

    const dismiss = useCallback(() => update({ status: 'idle' }), [update]);

    return { state, start, saveFile: save, dismiss };
}

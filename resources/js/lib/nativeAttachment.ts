const baseUrl = '/_native/api/call';

import { apiFetch } from '@/composables/useApi';

interface BridgeResult {
    status?: string;
    message?: string;
    data?: {
        data?: unknown;
    };
}

interface HunguCookie {
    name: string;
    value: string;
    domain: string;
}

interface DiscussAttachmentPayload {
    cid: string;
    bid: string;
    nid: string;
    attachmentUrl: string;
}

interface QueueAttachmentDownloadPayload {
    cid: string;
    sourceUrl: string;
    filename?: string | null;
}

export interface AttachmentDownloadTask {
    taskId: number;
    status: string;
    fileName: string | null;
    mimeType: string | null;
    fileSize: number | null;
    errorMessage: string | null;
    localFilePath: string | null;
    expiresAt: string | null;
}

export interface AttachmentDownloadCleanupResult {
    ok: boolean;
    clearedTasks: number;
    deletedFiles: number;
}

const COMPLETED_STATUS = 'completed';
const FAILED_STATUS = 'failed';

async function bridgeCall(
    method: string,
    params: Record<string, unknown> = {},
): Promise<unknown | null> {
    try {
        const response = await fetch(baseUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ method, params }),
        });

        const result = (await response.json()) as BridgeResult;

        if (result.status === 'error') {
            throw new Error(result.message || 'Native bridge call failed');
        }

        if (result.data && result.data.data !== undefined) {
            return result.data.data;
        }

        return result.data ?? null;
    } catch {
        return null;
    }
}

export async function downloadAttachmentWithNativeBridge(
    url: string,
    filename?: string | null,
): Promise<boolean> {
    const payload: Record<string, unknown> = { url };

    if (filename) {
        payload.filename = filename;
    }

    const result = await bridgeCall('AttachmentBridge.Download', payload);

    return result !== null;
}

export function isNativeAttachmentBridgeAvailable(): boolean {
    if (typeof window === 'undefined') {
        return false;
    }

    return (
        document.body.classList.contains('device-android') ||
        document.body.classList.contains('device-ios')
    );
}

export async function openLocalAttachmentWithNativeBridge(
    localFilePath: string,
    mimeType?: string | null,
): Promise<boolean> {
    const result = await bridgeCall('AttachmentBridge.OpenLocalFile', {
        path: localFilePath,
        mimeType: mimeType ?? undefined,
    });

    return result !== null;
}

export async function queueAttachmentDownloadTask(
    payload: QueueAttachmentDownloadPayload,
): Promise<AttachmentDownloadTask> {
    return apiFetch<AttachmentDownloadTask>('/api/attachments/download-tasks', {
        method: 'POST',
        body: JSON.stringify(payload),
    });
}

export async function getAttachmentDownloadTaskStatus(
    taskId: number,
): Promise<AttachmentDownloadTask> {
    return apiFetch<AttachmentDownloadTask>(
        `/api/attachments/download-tasks/${taskId}`,
    );
}

export async function clearDownloadedAttachments(): Promise<AttachmentDownloadCleanupResult> {
    return apiFetch<AttachmentDownloadCleanupResult>(
        '/api/attachments/download-tasks/cleanup',
        {
            method: 'POST',
        },
    );
}

export async function waitForAttachmentDownloadCompletion(
    taskId: number,
    options: {
        timeoutMs?: number;
        pollIntervalMs?: number;
    } = {},
): Promise<AttachmentDownloadTask> {
    const timeoutMs = options.timeoutMs ?? 120000;
    const pollIntervalMs = options.pollIntervalMs ?? 1000;
    const startedAt = Date.now();

    while (true) {
        const task = await getAttachmentDownloadTaskStatus(taskId);

        if (task.status === COMPLETED_STATUS || task.status === FAILED_STATUS) {
            return task;
        }

        if (Date.now() - startedAt >= timeoutMs) {
            throw new Error('附件下載逾時，請稍後再試。');
        }

        await new Promise((resolve) => {
            window.setTimeout(resolve, pollIntervalMs);
        });
    }
}

export async function openAttachmentInBrowser(url: string): Promise<boolean> {
    return openUrlInNativeBrowser(url);
}

export async function openUrlInNativeBrowser(
    url: string,
    options: {
        method?: 'GET' | 'POST';
        postForm?: Record<string, string>;
    } = {},
): Promise<boolean> {
    const cookies = await fetchHunguCookies();
    const method = (options.method || 'GET').toUpperCase();
    const result = await bridgeCall('AttachmentBridge.OpenURL', {
        url,
        cookies,
        method,
        postForm: options.postForm ?? {},
    });

    // Backward compatibility for older native builds that only expose OpenInBrowser.
    if (result === null) {
        const legacyResult = await bridgeCall(
            'AttachmentBridge.OpenInBrowser',
            {
                url,
                cookies,
                method,
                postForm: options.postForm ?? {},
            },
        );

        return legacyResult !== null;
    }

    return result !== null;
}

export async function openDiscussAttachmentInBrowser(
    payload: DiscussAttachmentPayload,
): Promise<boolean> {
    const cookies = await fetchHunguCookies();
    const result = await bridgeCall('AttachmentBridge.OpenDiscussAttachment', {
        cid: payload.cid,
        bid: payload.bid,
        nid: payload.nid,
        attachmentUrl: payload.attachmentUrl,
        cookies,
    });

    return result !== null;
}

export async function openTronclassUrl(url: string): Promise<boolean> {
    const result = await bridgeCall('AttachmentBridge.OpenTronclass', { url });

    return result !== null;
}

async function fetchHunguCookies(): Promise<HunguCookie[]> {
    try {
        const response = await fetch('/api/hungu-cookies', {
            headers: {
                Accept: 'application/json',
            },
            credentials: 'same-origin',
        });

        if (!response.ok) {
            return [];
        }

        const payload = (await response.json()) as {
            cookies?: Array<Partial<HunguCookie>>;
        };

        if (!Array.isArray(payload.cookies)) {
            return [];
        }

        return payload.cookies
            .filter((cookie): cookie is HunguCookie =>
                Boolean(cookie?.name && cookie?.value && cookie?.domain),
            )
            .map((cookie) => ({
                name: cookie.name,
                value: cookie.value,
                domain: cookie.domain,
            }));
    } catch {
        return [];
    }
}

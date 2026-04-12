const baseUrl = '/_native/api/call';

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

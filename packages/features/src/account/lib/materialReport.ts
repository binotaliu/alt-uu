import type {
    MaterialDirectoryInspectionViewModel,
    MaterialDirectoryNodeViewModel,
    MaterialSourceInspectionViewModel,
} from '@altuu/core';

export const PARSE_KIND_LABEL: Record<string, string> = {
    html: '解析出文字內容',
    video: '解析出影片',
    youtube: '解析出 YouTube 影片',
    download: '判定為檔案下載',
    empty: '解析後沒有可顯示的內容',
    error: '解析時發生錯誤',
};

/**
 * A one-line reading of the two halves, so the user does not have to know
 * what to look for. It only ever says what the data shows.
 */
export function verdictFor(
    source: MaterialSourceInspectionViewModel,
): string | null {
    if (source.fetchError) {
        return '無法取得學校的頁面，問題出在連線，而不是解析。';
    }

    if (source.fetchStatus !== null && source.fetchStatus >= 400) {
        return `學校伺服器回應了 ${source.fetchStatus}，頁面本身就取不到。`;
    }

    if (source.parse.kind === 'error') {
        return 'App 在解析這個頁面時發生錯誤，這是 App 的問題。';
    }

    if (source.parse.kind === 'empty' && source.bodyBytes === 0) {
        return '學校回傳了空白頁面，App 沒有東西可以顯示。';
    }

    if (source.parse.kind === 'empty') {
        return '學校頁面有內容，但 App 解析後沒有可顯示的部分。請檢視下方原始碼，並將它回報給作者。';
    }

    return null;
}

function indent(node: MaterialDirectoryNodeViewModel): string {
    return '  '.repeat(node.level);
}

export function directoryReport(
    directory: MaterialDirectoryInspectionViewModel,
    courseId: string,
    courseName: string | undefined,
): string {
    return [
        '# Alt UU 教材目錄',
        `課程：${courseId} ${courseName ?? ''}`.trim(),
        `學校回應：code=${directory.apiCode ?? '無'} message=${directory.apiMessage ?? '無'}`,
        `節點數：${directory.nodeCount}`,
        '',
        ...directory.nodes.map(
            (node) =>
                `${indent(node)}- [${node.identifier}] ${node.text} → ${node.href ?? '（無連結）'}${node.itemDisabled ? ' (disabled)' : ''}`,
        ),
    ].join('\n');
}

export function sourceReport(
    source: MaterialSourceInspectionViewModel,
    courseName: string | undefined,
): string {
    const lines = [
        '# Alt UU 教材來源',
        `課程：${source.cid} ${courseName ?? ''}`.trim(),
        `節點：${source.scoid} ${source.nodeText}`,
        `網址：${source.url}`,
        `HTTP 狀態：${source.fetchStatus ?? '無（未取得回應）'}`,
        `Content-Type：${source.contentType ?? '未知'}`,
        `大小：${source.bodyBytes} bytes${source.bodyTruncated ? '（下方原始碼已截斷）' : ''}`,
        `解析結果：${PARSE_KIND_LABEL[source.parse.kind] ?? source.parse.kind}`,
    ];

    if (source.parse.kind === 'html') {
        lines.push(`解析後 HTML 長度：${source.parse.htmlLength}`);
    }

    if (source.parse.videoUrl) {
        lines.push(`影片網址：${source.parse.videoUrl}`);
    }

    if (source.fetchError) {
        lines.push(`取得頁面失敗：${source.fetchError}`);
    }

    if (source.parse.errorClass) {
        lines.push(
            `解析錯誤：${source.parse.errorClass}: ${source.parse.errorMessage ?? ''}`,
            `位置：${source.parse.errorLocation ?? ''}`,
        );
    }

    lines.push('', '## 原始碼', '', source.body ?? '（非文字內容，未顯示）');

    return lines.join('\n');
}

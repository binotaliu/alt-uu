export interface ReleaseNote {
    text: string;
    /** Whether the feature is exclusive to Alt UU+ subscribers. */
    plus?: boolean;
}

export interface Release {
    version: string;
    notes: ReleaseNote[];
}

/**
 * Newest first. The first launch of a version that has an entry here shows the
 * "What's new" screen once; versions without an entry are skipped silently.
 */
export const releases: Release[] = [
    {
        version: '1.1.0',
        notes: [
            {
                text: '教材列表中現在會標示「上次看到」的教材，並顯示上次在影片中看到的時間與影片總長度',
            },
            {
                text: '支援多帳號登入，現在，你可以在 Alt UU 中登入多達 5 個帳號，並隨時切換',
            },
            { text: '整合 NOU 教務行政資訊系統，顯示成績與作業' },
            {
                text: '使用行動網路時，進入課程顯示提示，並可在設定中選擇不再提醒',
            },
            {
                text: '在檢視教材時，下方提供「上一篇教材」與「下一篇教材」連結',
            },
            {
                text: 'Alt UU 現在會根據系統設定的字級，自動調整界面的字體大小',
            },
            {
                text: '不再顯示「啟動中」畫面。現在開啟 App 後將直接進入課程選單',
            },
            { text: '無法登入時，現在會顯示錯誤訊息' },
            { text: '支援部分使用 YouTube 的課程播放' },
            {
                text: 'Alt UU 現在除了預設的主題色外，另外提供了六種主題色可供選擇',
                plus: true,
            },
            {
                text: '學習活動統計功能，讓你瞭解自己最近的學習狀況',
                plus: true,
            },
        ],
    },
];

export function findRelease(version: string): Release | undefined {
    return releases.find((release) => release.version === version);
}

/**
 * Whether the user should be taken to the "What's new" screen: this version
 * has release notes and the user hasn't seen them yet.
 */
export function hasUnseenRelease(
    currentVersion: string,
    seenVersion: string,
): boolean {
    return (
        findRelease(currentVersion) !== undefined &&
        seenVersion !== currentVersion
    );
}

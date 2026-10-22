import type { IconName } from '@altuu/ui';

export interface ReleaseHighlight {
  icon: IconName;
  title: string;
  description: string;
  /** Whether the feature is exclusive to Alt UU+ subscribers. */
  plus?: boolean;
}

export interface Release {
  version: string;
  /** A handful of notable changes to feature, not an exhaustive changelog. */
  highlights: ReleaseHighlight[];
}

/**
 * Newest first. The first launch of a version that has an entry here shows the
 * "What's new" screen once; versions without an entry are skipped silently.
 */
export const releases: Release[] = [
  {
    version: '2.0.0',
    highlights: [
      {
        icon: 'arrow-up-circle',
        title: '全新打造的 Alt UU',
        description: '我們使用新技術重新打造了 Alt UU，用起來更流暢、更穩定',
      },
      {
        icon: 'book-open',
        title: '教材目錄更好找',
        description: '目錄會自動捲動到尚未觀看的教材，並可隨時切換到另一個教材',
      },
      {
        icon: 'video-camera',
        title: '沉浸式播放',
        description: '開啟沉浸式播放後，即可不需手動操作，專心觀看教材影片',
        plus: true,
      },
    ],
  },
  {
    version: '1.1.0',
    highlights: [
      {
        icon: 'book-open',
        title: '追蹤觀看進度',
        description:
          '教材列表會標示「上次看到」的教材，並顯示上次觀看的時間與影片總長度',
      },
      {
        icon: 'user-group',
        title: '支援多帳號登入',
        description: '最多可登入 5 個帳號，隨時切換身份',
      },
      {
        icon: 'academic-cap',
        title: '整合教務行政系統',
        description: '在 App 中直接檢視成績與作業，不用再另外登入',
      },
      {
        icon: 'swatch',
        title: '個人化主題色',
        description: '除了預設主題色，另外提供六種主題色可供選擇',
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
    findRelease(currentVersion) !== undefined && seenVersion !== currentVersion
  );
}

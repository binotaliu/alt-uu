import { REPORT_TYPES, type ReportType } from '@altuu/core';

/** Legacy `REASON_LABELS` (stores/moderation.ts). */
export const REASON_LABELS: Record<ReportType, string> = {
  s: '垃圾訊息',
  i: '不適當的內容',
  c: '受版權保護的內容',
  p: '散播個人資訊',
  l: '違法內容',
  m: '偽冒他人',
  o: '其他',
};

/** The report modal's options, in the legacy order (the API's REPORT_TYPES). */
export const REPORT_REASONS = REPORT_TYPES.map((value) => ({
  value,
  label: REASON_LABELS[value],
}));

/** Label for a stored block reason code; unknown codes read as 其他. */
export function getReasonLabel(reason: string | null | undefined): string {
  return REASON_LABELS[(reason ?? '') as ReportType] ?? REASON_LABELS.o;
}

/** Legacy `isUserBlocked`: both fields must be present and match a block. */
export function isUserBlocked(
  blockedUsers: ReadonlyArray<{ poster: string; realname: string }>,
  poster: string | null | undefined,
  realname: string | null | undefined,
): boolean {
  if (!poster || !realname) {
    return false;
  }

  return blockedUsers.some(
    (blocked) => blocked.poster === poster && blocked.realname === realname,
  );
}

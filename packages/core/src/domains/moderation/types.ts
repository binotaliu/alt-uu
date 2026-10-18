export interface BlockedUserViewModel {
  poster: string;
  realname: string;
}

/** Reason codes accepted by the moderation API (ReportModerationController). */
export const REPORT_TYPES = ['s', 'i', 'c', 'p', 'l', 'm', 'o'] as const;

export type ReportType = (typeof REPORT_TYPES)[number];

export interface ReportContentInput {
  boardId: string;
  nodeId: string;
  content: string;
  type: ReportType;
}

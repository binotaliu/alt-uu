import type { AccountId } from '../../session/types';

/** Request of the legacy `POST /study-time` (both camelCase and snake_case were accepted). */
export interface StudyTimeInput {
  cid: string;
  activityId: string;
  url: string;
  seconds?: number | null;
  /** ISO-8601 time the viewing started; used when `seconds` is absent. */
  startedAt?: string | null;
  positionSeconds?: number | null;
  mediaDurationSeconds?: number | null;
}

/** Legacy StudyTimeResultViewModel. */
export interface StudyTimeResult {
  ok: boolean;
  seconds: number;
  message: string | null;
}

/** Legacy StudyTimeRecorded event. */
export interface StudyTimeRecordedEvent {
  accountId: AccountId | null;
  cid: string;
  activityId: string;
  seconds: number;
}

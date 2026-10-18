import { and, eq, isNull, sql } from 'drizzle-orm';
import type { AccountActiveProfile } from '../../accounts';
import { accountDailyActivities, playbackProgress } from '../../db/schema';
import type { AltUUDatabase } from '../../db/types';
import { dataGet } from '../../http/encoding';
import type { HunguStudyTimeClient } from '../../hungu';
import type { Clock } from '../../platform';
import { ValidationError } from '../account/validation';
import {
  formatTaipeiDateTime,
  parseTaipeiDateTime,
  taipeiDateString,
} from './taipeiTime';
import type {
  StudyTimeInput,
  StudyTimeRecordedEvent,
  StudyTimeResult,
} from './types';

const MAX_SECONDS = 28_800;

export interface StudyTimeServicesDeps {
  db: AltUUDatabase;
  activeProfile: AccountActiveProfile;
  studyTime: Pick<HunguStudyTimeClient, 'fetchServerTime' | 'recordStudyTime'>;
  clock: Clock;
  /**
   * Fired after a successful HUNGU upload (legacy StudyTimeRecorded event).
   * The orchestrator wires it to the course domain's path-info cache bust.
   */
  onStudyTimeRecorded?: (event: StudyTimeRecordedEvent) => Promise<void> | void;
}

/** RecordStudyTime: HUNGU upload + playback_progress upsert + daily activity. */
export function createStudyTimeServices(deps: StudyTimeServicesDeps) {
  const { db, clock } = deps;

  async function upsertPlaybackProgress(values: {
    accountId: number | null;
    cid: string;
    activityId: string;
    seconds: number;
    positionSeconds: number | null;
    mediaDurationSeconds: number | null;
    uploadOk: boolean;
  }): Promise<void> {
    const now = clock.now();
    const accountMatch =
      values.accountId === null
        ? isNull(playbackProgress.accountId)
        : eq(playbackProgress.accountId, values.accountId);
    const key = and(
      accountMatch,
      eq(playbackProgress.cid, values.cid),
      eq(playbackProgress.activityId, values.activityId),
    );
    const changes = {
      durationSeconds: values.seconds,
      positionSeconds: values.positionSeconds ?? 0,
      hunguUploadSuccess: values.uploadOk,
      ...(values.mediaDurationSeconds !== null
        ? { mediaDurationSeconds: values.mediaDurationSeconds }
        : {}),
      updatedAt: now,
    };

    const existing = await db
      .select({ id: playbackProgress.id })
      .from(playbackProgress)
      .where(key)
      .limit(1);

    if (existing[0] === undefined) {
      await db.insert(playbackProgress).values({
        accountId: values.accountId,
        cid: values.cid,
        activityId: values.activityId,
        ...changes,
        createdAt: now,
      });

      return;
    }

    await db
      .update(playbackProgress)
      .set(changes)
      .where(eq(playbackProgress.id, existing[0].id));
  }

  async function recordDailyActivity(
    accountId: number,
    seconds: number,
  ): Promise<void> {
    const now = clock.now();

    await db
      .insert(accountDailyActivities)
      .values({
        accountId,
        activityDate: taipeiDateString(now),
        totalSeconds: seconds,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [
          accountDailyActivities.accountId,
          accountDailyActivities.activityDate,
        ],
        set: {
          totalSeconds: sql`${accountDailyActivities.totalSeconds} + ${seconds}`,
          updatedAt: now,
        },
      });
  }

  return {
    async record(rawInput: StudyTimeInput): Promise<StudyTimeResult> {
      const input = validateStudyTimeInput(rawInput);
      const now = clock.now();
      let seconds = input.seconds ?? 0;

      if (seconds <= 0 && input.startedAt !== null) {
        seconds = Math.max(
          1,
          Math.floor((now.getTime() - input.startedAt.getTime()) / 1000),
        );
      }

      seconds = Math.max(1, Math.min(MAX_SECONDS, seconds));

      const timeResult = await deps.studyTime.fetchServerTime();
      const serverTime = dataGet(timeResult.payload, 'data.server_time');
      const serverNow =
        typeof serverTime === 'string'
          ? (parseTaipeiDateTime(serverTime) ?? now)
          : now;
      const payload = {
        cid: input.cid,
        url: input.url,
        st: formatTaipeiDateTime(
          new Date(serverNow.getTime() - seconds * 1000),
        ),
        activity_id: input.activityId,
      };

      let result = await deps.studyTime.recordStudyTime(payload);

      if ((result.payload.code ?? 500) !== 0) {
        result = await deps.studyTime.recordStudyTime({
          ...payload,
          et: formatTaipeiDateTime(clock.now()),
        });
      }

      const uploadPayload = result.payload;
      const ok = (uploadPayload.code ?? 500) === 0;
      const accountId = await deps.activeProfile.get();

      if (ok) {
        await deps.onStudyTimeRecorded?.({
          accountId,
          cid: input.cid,
          activityId: input.activityId,
          seconds,
        });
      }

      await upsertPlaybackProgress({
        accountId,
        cid: input.cid,
        activityId: input.activityId,
        seconds,
        positionSeconds: input.positionSeconds,
        mediaDurationSeconds: input.mediaDurationSeconds,
        uploadOk: ok,
      });

      if (accountId !== null) {
        await recordDailyActivity(accountId, seconds);
      }

      const uploadedSeconds = dataGet(uploadPayload, 'data.seconds');

      return {
        ok,
        seconds:
          uploadedSeconds === undefined ? seconds : toInt(uploadedSeconds),
        message:
          typeof uploadPayload.message === 'string'
            ? uploadPayload.message
            : null,
      };
    },
  };
}

export type StudyTimeServices = ReturnType<typeof createStudyTimeServices>;

interface ValidatedStudyTimeInput {
  cid: string;
  activityId: string;
  url: string;
  seconds: number | null;
  startedAt: Date | null;
  positionSeconds: number | null;
  mediaDurationSeconds: number | null;
}

function validateStudyTimeInput(
  input: StudyTimeInput,
): ValidatedStudyTimeInput {
  const errors: Record<string, string[]> = {};
  const fail = (field: string, message: string): void => {
    errors[field] = [message];
  };

  const cid = input.cid;
  if (typeof cid !== 'string' || cid === '' || [...cid].length > 64) {
    fail('cid', 'cid 不正確。');
  }

  const activityId = input.activityId;
  if (
    typeof activityId !== 'string' ||
    activityId === '' ||
    [...activityId].length > 191
  ) {
    fail('activityId', 'activityId 不正確。');
  }

  if (
    typeof input.url !== 'string' ||
    input.url.length > 2000 ||
    !isUrl(input.url)
  ) {
    fail('url', 'url 不正確。');
  }

  const seconds = input.seconds ?? null;
  if (
    seconds !== null &&
    (!Number.isInteger(seconds) || seconds < 1 || seconds > MAX_SECONDS)
  ) {
    fail('seconds', 'seconds 必須是 1 到 28800 的整數。');
  }

  let startedAt: Date | null = null;
  if (input.startedAt !== undefined && input.startedAt !== null) {
    const parsed = new Date(input.startedAt);

    if (Number.isNaN(parsed.getTime())) {
      fail('startedAt', 'startedAt 不是有效的日期。');
    } else {
      startedAt = parsed;
    }
  }

  const positionSeconds = input.positionSeconds ?? null;
  if (
    positionSeconds !== null &&
    (!Number.isFinite(positionSeconds) || positionSeconds < 0)
  ) {
    fail('positionSeconds', 'positionSeconds 不可小於 0。');
  }

  const mediaDurationSeconds = input.mediaDurationSeconds ?? null;
  if (
    mediaDurationSeconds !== null &&
    (!Number.isFinite(mediaDurationSeconds) || mediaDurationSeconds <= 0)
  ) {
    fail('mediaDurationSeconds', 'mediaDurationSeconds 必須大於 0。');
  }

  if (Object.keys(errors).length > 0) {
    throw new ValidationError(errors);
  }

  return {
    cid,
    activityId,
    url: input.url,
    seconds,
    startedAt,
    positionSeconds,
    mediaDurationSeconds,
  };
}

function isUrl(value: string): boolean {
  try {
    const parsed = new URL(value);

    return parsed.protocol !== '' && parsed.host !== '';
  } catch {
    return false;
  }
}

/** PHP `(int)` cast for scalars decoded from JSON. */
function toInt(value: unknown): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? Math.trunc(value) : 0;
  }

  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10);

    return Number.isNaN(parsed) ? 0 : parsed;
  }

  return typeof value === 'boolean' ? Number(value) : 0;
}

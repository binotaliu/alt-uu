import { and, desc, eq, isNull } from 'drizzle-orm';
import { playbackProgress } from '../../db/schema';
import type { AltUUDatabase } from '../../db/types';
import { dataGet, isRecord } from '../../http/encoding';
import type { HunguPayloadResult } from '../../hungu/types';
import { phpInt } from './support/php';
import type {
  CourseLastSeenMaterial,
  CourseMaterialResource,
  CoursePlaybackProgress,
} from './types';

const COURSE_NODE_RESOURCES_CACHE_PREFIX = 'alt-uu:courses:node-resources:';

export interface GetNodeResourcesDeps {
  client: {
    fetchCourseNodeResources(
      cid: string,
      scoid: string,
    ): Promise<HunguPayloadResult>;
  };
  currentAccountId: () => Promise<number | null>;
}

/**
 * Port of GetNodeResources. Legacy kept the list in the Laravel session for
 * the app's lifetime; here it lives in memory for the service's lifetime.
 */
export function createGetNodeResources(deps: GetNodeResourcesDeps) {
  const loaded = new Map<string, unknown[]>();

  return async (
    cid: string,
    scoid: string,
  ): Promise<CourseMaterialResource[]> => {
    const accountId = (await deps.currentAccountId()) ?? 0;
    const key = `${COURSE_NODE_RESOURCES_CACHE_PREFIX}${accountId}.${cid}.${scoid}`;
    let resources = loaded.get(key);

    if (resources === undefined) {
      const { payload } = await deps.client.fetchCourseNodeResources(
        cid,
        scoid,
      );
      const list = dataGet(payload, 'data.list');
      resources = Array.isArray(list) ? list : [];
      loaded.set(key, resources);
    }

    return resources
      .filter(
        (resource): resource is Record<string, unknown> =>
          isRecord(resource) && !Array.isArray(resource),
      )
      .map(toMaterialResource);
  };
}

/** CourseMaterialResourceViewModel::fromPayload */
export function toMaterialResource(
  payload: Record<string, unknown>,
): CourseMaterialResource {
  const stringOrNull = (value: unknown): string | null =>
    typeof value === 'string' ? value : null;

  return {
    downloadPath: stringOrNull(payload.download_path),
    relativePath: stringOrNull(payload.relative_path),
    updateDatetime: phpInt(payload.update_datetime ?? 0),
    size: phpInt(payload.size ?? 0),
    metadata: typeof payload.metadata === 'string' ? payload.metadata : '',
    filename: stringOrNull(payload.filename),
    title: stringOrNull(payload.title),
    href: stringOrNull(payload.href),
  };
}

/** Port of CourseLastSeenMaterialController. */
export async function getLastSeenMaterial(
  db: AltUUDatabase,
  accountId: number | null,
  cid: string,
): Promise<CourseLastSeenMaterial> {
  const rows = await db
    .select()
    .from(playbackProgress)
    .where(and(accountCondition(accountId), eq(playbackProgress.cid, cid)))
    .orderBy(desc(playbackProgress.updatedAt))
    .limit(1);
  const progress = rows[0];

  return {
    activityId: progress?.activityId ?? null,
    positionSeconds: progress?.positionSeconds ?? null,
    mediaDurationSeconds: progress?.mediaDurationSeconds ?? null,
  };
}

/** Port of PlaybackProgressController::show. */
export async function getPlaybackProgress(
  db: AltUUDatabase,
  accountId: number | null,
  cid: string,
  activityId: string,
): Promise<CoursePlaybackProgress | null> {
  const rows = await db
    .select()
    .from(playbackProgress)
    .where(
      and(
        accountCondition(accountId),
        eq(playbackProgress.cid, cid),
        eq(playbackProgress.activityId, activityId),
      ),
    )
    .limit(1);
  const progress = rows[0];

  if (progress === undefined) {
    return null;
  }

  return {
    cid: progress.cid,
    activityId: progress.activityId,
    studySeconds: progress.durationSeconds,
    positionSeconds: progress.positionSeconds,
    mediaDurationSeconds: progress.mediaDurationSeconds,
    hunguUploadSuccess: progress.hunguUploadSuccess,
    updatedAt:
      progress.updatedAt === null ? null : toIso8601(progress.updatedAt),
  };
}

/** `where('account_id', null)` in Eloquent matches `account_id IS NULL`. */
function accountCondition(accountId: number | null) {
  return accountId === null
    ? isNull(playbackProgress.accountId)
    : eq(playbackProgress.accountId, accountId);
}

/** Carbon `toIso8601String()` in UTC: `2026-01-02T03:04:05+00:00`. */
function toIso8601(date: Date): string {
  return `${date.toISOString().slice(0, 19)}+00:00`;
}

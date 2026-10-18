import type { CacheRepository } from '../../db/cache';
import { dataGet, isRecord } from '../../http/encoding';
import type { HunguPayloadResult } from '../../hungu/types';
import { phpBool, phpInt, phpString, phpValues } from './support/php';
import { phpTrim } from './support/phpUrl';
import type { CourseMaterialNode, CoursePath, CoursePathInfo } from './types';

const COURSE_PATH_INFO_CACHE_PREFIX = 'alt-uu:courses:path-info:';
const COURSE_PATH_INFO_IDS_KEY_PREFIX = 'alt-uu:courses:path-info:ids:';
const COURSE_PATH_INFO_CACHE_TTL_SECONDS = 30 * 60;

export interface GetCoursePathDeps {
  client: {
    fetchCoursePathInfo(cid: string): Promise<HunguPayloadResult>;
  };
  cache: Pick<CacheRepository, 'get' | 'put'>;
  /** Active account id (legacy `currentAccountId() ?? 0`). */
  currentAccountId: () => Promise<number | null>;
}

/**
 * Port of GetCoursePathInfo: the course's material tree (cached 30 minutes
 * per account and course), flattened with a `level` per node.
 */
export function createGetCoursePath(deps: GetCoursePathDeps) {
  return async (cid: string): Promise<CoursePath> => {
    const accountId = (await deps.currentAccountId()) ?? 0;
    const cacheKey = `${COURSE_PATH_INFO_CACHE_PREFIX}${accountId}:${cid}`;
    let pathInfo: unknown = await deps.cache.get(cacheKey);

    if (!isRecord(pathInfo) || phpValues(pathInfo).length === 0) {
      pathInfo = (await deps.client.fetchCoursePathInfo(cid)).payload;
      await deps.cache.put(
        cacheKey,
        pathInfo,
        COURSE_PATH_INFO_CACHE_TTL_SECONDS,
      );
      await registerPathInfoKey(deps.cache, accountId, cid);
    }

    return {
      pathInfo: toPathInfo(pathInfo as Record<string, unknown>),
      materialNodes: flattenNodes(
        phpValues(dataGet(pathInfo, 'data.path.item')),
      ).map(toMaterialNode),
    };
  };
}

export type GetCoursePath = ReturnType<typeof createGetCoursePath>;

/**
 * Port of StudyTime's ClearCoursePathInfoCache listener: after study time
 * is recorded the node `readed` flags change, so the cached tree goes.
 */
export async function clearCoursePathInfoCache(
  cache: Pick<CacheRepository, 'get' | 'put' | 'forget'>,
  accountId: number | null,
  cid: string,
): Promise<void> {
  const account = accountId ?? 0;

  await cache.forget(`${COURSE_PATH_INFO_CACHE_PREFIX}${account}:${cid}`);

  const idsKey = `${COURSE_PATH_INFO_IDS_KEY_PREFIX}${account}`;
  const ids = await cache.get<unknown>(idsKey, []);

  await cache.put(
    idsKey,
    (Array.isArray(ids) ? ids : []).filter((id) => id !== cid),
    COURSE_PATH_INFO_CACHE_TTL_SECONDS,
  );
}

async function registerPathInfoKey(
  cache: Pick<CacheRepository, 'get' | 'put'>,
  accountId: number,
  cid: string,
): Promise<void> {
  const idsKey = `${COURSE_PATH_INFO_IDS_KEY_PREFIX}${accountId}`;
  const stored = await cache.get<unknown>(idsKey, []);
  const ids = Array.isArray(stored) ? stored : [];

  if (!ids.includes(cid)) {
    await cache.put(idsKey, [...ids, cid], COURSE_PATH_INFO_CACHE_TTL_SECONDS);
  }
}

function flattenNodes(
  nodes: unknown[],
  level = 0,
): Array<Record<string, unknown>> {
  const result: Array<Record<string, unknown>> = [];

  for (const node of nodes) {
    if (!isRecord(node) || Array.isArray(node)) {
      continue;
    }

    const { item: children, ...entry } = node;
    result.push({ ...entry, level });

    const childList = phpValues(children);

    if (childList.length > 0) {
      result.push(...flattenNodes(childList, level + 1));
    }
  }

  return result;
}

/** CoursePathInfoViewModel::fromPayload */
export function toPathInfo(payload: Record<string, unknown>): CoursePathInfo {
  const baseUrl = dataGet(payload, 'data.base_url');

  return {
    code: phpInt(payload.code ?? 0),
    message: typeof payload.message === 'string' ? payload.message : '',
    courseId: phpString(dataGet(payload, 'data.course_id') ?? ''),
    baseUrl: typeof baseUrl === 'string' ? baseUrl : null,
    progress: phpInt(dataGet(payload, 'data.progress') ?? 0),
    pathText: phpString(dataGet(payload, 'data.path.text') ?? ''),
  };
}

/** CourseMaterialNodeViewModel::fromPayload */
export function toMaterialNode(
  payload: Record<string, unknown>,
): CourseMaterialNode {
  let href = typeof payload.href === 'string' ? phpTrim(payload.href) : null;
  let itemDisabled = phpBool(payload.itemDisabled ?? false);

  // Placeholder URLs like "about:blank" mark folder / group nodes.
  if (href !== null && href.toLowerCase().startsWith('about:blank')) {
    href = null;
    itemDisabled = true;
  }

  return {
    identifier: phpString(payload.identifier ?? ''),
    href,
    text: typeof payload.text === 'string' ? payload.text : '',
    readed: phpBool(payload.readed ?? false),
    level: phpInt(payload.level ?? 0),
    leaf: phpBool(payload.leaf ?? false),
    itemDisabled,
  };
}

import type { CacheRepository } from '../../db/cache';
import { dataGet, isRecord } from '../../http/encoding';
import type { HunguPayloadResult } from '../../hungu/types';
import type { AccountId } from '../../session/types';
import { isScalar, phpString, phpTruthyOrNull } from './support/php';
import { phpTrim } from './support/phpUrl';
import type { CourseItem } from './types';

const COURSE_LIST_CACHE_KEY_PREFIX = 'alt-uu:courses:list:';
const ANONYMOUS_CACHE_SEGMENT = 'anonymous';
const COURSE_LIST_CACHE_TTL_SECONDS = 30 * 60;
const APP_COURSE_PATTERN = /-(?<type>語音|網頁|影音|影音語音|其他)APP$/u;
const TITLE_PATTERN =
  /^\((?<semester>[^)]+)\)(?<name>.+?)(?:-(?<className>.+))?$/u;

export interface CourseTypeData {
  courseType: string;
  commonCourseId: string | null;
}

export interface ListCoursesDeps {
  client: {
    fetchCourseList(accountId?: AccountId): Promise<HunguPayloadResult>;
  };
  cache: Pick<CacheRepository, 'get' | 'put'>;
  /** HUNGU profile username of the active account, for the cache key. */
  getProfileUsername: () => Promise<string | null>;
}

/**
 * Port of ListCourses: the HUNGU course list (cached 30 minutes), without
 * the companion "-語音APP"-style courses, whose type and id are attached to
 * the matching course instead.
 */
export function createListCourses(deps: ListCoursesDeps) {
  const resolveCacheKey = async (accountId?: AccountId): Promise<string> => {
    if (accountId !== undefined) {
      return `${COURSE_LIST_CACHE_KEY_PREFIX}account:${accountId}`;
    }

    const username = phpTrim((await deps.getProfileUsername()) ?? '');

    return (
      COURSE_LIST_CACHE_KEY_PREFIX +
      (username === '' ? ANONYMOUS_CACHE_SEGMENT : username)
    );
  };

  return async (
    options: { accountId?: AccountId } = {},
  ): Promise<CourseItem[]> => {
    const cacheKey = await resolveCacheKey(options.accountId);
    let courses: unknown = await deps.cache.get(cacheKey, []);

    if (!Array.isArray(courses)) {
      courses = [];
    }

    if ((courses as unknown[]).length === 0) {
      const { payload } = await deps.client.fetchCourseList(options.accountId);
      const list = dataGet(payload, 'data.list');
      courses = Array.isArray(list) ? list : [];

      if ((courses as unknown[]).length > 0) {
        await deps.cache.put(cacheKey, courses, COURSE_LIST_CACHE_TTL_SECONDS);
      }
    }

    const rows = (courses as unknown[]).filter(isRecord);
    const courseTypesByTitleKey = buildCourseTypeMap(rows);

    return rows
      .filter(shouldIncludeCourse)
      .map((course) => makeCourseItem(course, courseTypesByTitleKey));
  };
}

export type ListCourses = ReturnType<typeof createListCourses>;

/** Port of CourseTypeMatcher. */
export function matchCourseType(
  course: Record<string, unknown>,
  courseTypesByTitleKey: Record<string, CourseTypeData>,
): { courseType: string | null; commonCourseId: string | null } {
  const titleKey = resolveTitleKey(course);

  if (titleKey !== null && titleKey in courseTypesByTitleKey) {
    const match = courseTypesByTitleKey[titleKey];

    return {
      courseType: match.courseType,
      commonCourseId: match.commonCourseId,
    };
  }

  const value = isScalar(course.course_type)
    ? phpTrim(phpString(course.course_type))
    : '';

  return { courseType: value !== '' ? value : null, commonCourseId: null };
}

function buildCourseTypeMap(
  courses: Array<Record<string, unknown>>,
): Record<string, CourseTypeData> {
  const result: Record<string, CourseTypeData> = {};

  for (const course of courses) {
    const title = course.title;

    if (typeof title !== 'string' || title === '') {
      continue;
    }

    const type = phpTrim(APP_COURSE_PATTERN.exec(title)?.groups?.type ?? '');

    if (type === '') {
      continue;
    }

    const titleKey = resolveTitleKey(course);

    if (titleKey === null) {
      continue;
    }

    const courseId = isScalar(course.course_id)
      ? phpString(course.course_id)
      : '';

    result[titleKey] = {
      courseType: type,
      commonCourseId: courseId !== '' ? courseId : null,
    };
  }

  return result;
}

function shouldIncludeCourse(course: Record<string, unknown>): boolean {
  const title = course.title;

  return (
    typeof title !== 'string' || title === '' || !APP_COURSE_PATTERN.test(title)
  );
}

function makeCourseItem(
  course: Record<string, unknown>,
  courseTypesByTitleKey: Record<string, CourseTypeData>,
): CourseItem {
  const courseId = isScalar(course.course_id)
    ? phpString(course.course_id)
    : '';
  const title = typeof course.title === 'string' ? phpTrim(course.title) : '';
  let semester: string | null = null;
  let name = '';
  let className: string | null = null;
  const groups = title !== '' ? TITLE_PATTERN.exec(title)?.groups : undefined;

  if (groups !== undefined) {
    semester = phpTruthyOrNull(phpTrim(groups.semester ?? ''));
    name = phpTrim(groups.name ?? '');
    className = phpTruthyOrNull(phpTrim(groups.className ?? ''));
  }

  if (name === '') {
    name = title !== '' ? title : '未命名課程';
  }

  const courseType = matchCourseType(course, courseTypesByTitleKey);

  return {
    courseId,
    commonCourseId: courseType.commonCourseId,
    semester: semester ?? '其他',
    name,
    className,
    courseType: courseType.courseType,
  };
}

function resolveTitleKey(course: Record<string, unknown>): string | null {
  const title = course.title;

  if (typeof title !== 'string' || title === '') {
    return null;
  }

  const groups = TITLE_PATTERN.exec(title)?.groups;

  if (groups === undefined) {
    return null;
  }

  const name = phpTrim(groups.name ?? '');

  return name === '' ? null : `${phpTrim(groups.semester ?? '')}|${name}`;
}

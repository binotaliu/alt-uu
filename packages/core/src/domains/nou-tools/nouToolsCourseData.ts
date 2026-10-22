import { isRecord } from '../../http/encoding';
import {
  normalizeCourseName,
  normalizeTermCode,
} from '../course/support/courseNameMatcher';
import type { JsonObject, NouToolsClient } from './nouToolsClient';

export const UNDIVIDED_CLASS_CODE = '不分班';
/**
 * 統一面授: when a course has only this one class, every student uses it
 * for video sessions regardless of their own class.
 */
export const UNIFIED_IN_PERSON_CLASS_CODE = 'ZZZ000';

/** The slice of the course domain's course item that matching needs. */
export interface NouToolsUserCourse {
  courseId: string;
  name: string;
  semester: string | null;
  className: string | null;
}

/** Legacy GetNouToolsCourseData result row. */
export interface NouToolsCourseData {
  courseId: string;
  name: string;
  semester: string | null;
  className: string | null;
  nouToolsCourseId: number | null;
  detail: JsonObject | null;
  matchedClass: JsonObject | null;
}

/** Legacy GetNouToolsCourseData: matches the user's courses to nou-tools courses. */
export async function getNouToolsCourseData(
  client: Pick<NouToolsClient, 'listCourses' | 'getCourseDetail'>,
  userCourses: NouToolsUserCourse[],
): Promise<NouToolsCourseData[]> {
  const termCodes = new Set<string>();

  for (const course of userCourses) {
    const termCode = normalizeTermCode(course.semester);

    if (termCode !== null) {
      termCodes.add(termCode);
    }
  }

  const termMaps = new Map<string, Map<string, number[]>>();

  for (const term of termCodes) {
    termMaps.set(term, buildSummaryMap(await client.listCourses(term)));
  }

  const results: NouToolsCourseData[] = [];

  for (const course of userCourses) {
    const termCode = normalizeTermCode(course.semester);
    const normalizedName = normalizeCourseName(course.name);
    const summaryIds =
      termCode === null || normalizedName === ''
        ? []
        : (termMaps.get(termCode)?.get(normalizedName) ?? []);
    const base = {
      courseId: course.courseId,
      name: course.name,
      semester: course.semester,
      className: course.className,
    };

    if (summaryIds.length === 0) {
      results.push({
        ...base,
        nouToolsCourseId: null,
        detail: null,
        matchedClass: null,
      });
      continue;
    }

    results.push({
      ...base,
      ...(await findCourseByClass(client, summaryIds, course.className)),
    });
  }

  return results;
}

/** nou-tools may list several courses under one name, so keep every id. */
function buildSummaryMap(summaries: JsonObject[]): Map<string, number[]> {
  const map = new Map<string, number[]>();

  for (const summary of summaries) {
    const id = Number.parseInt(String(summary.id ?? 0), 10) || 0;
    const name = typeof summary.name === 'string' ? summary.name.trim() : '';
    const normalizedName = normalizeCourseName(name);

    if (id <= 0 || normalizedName === '') {
      continue;
    }

    map.set(normalizedName, [...(map.get(normalizedName) ?? []), id]);
  }

  return map;
}

type CourseMatch = Pick<
  NouToolsCourseData,
  'nouToolsCourseId' | 'detail' | 'matchedClass'
>;

/**
 * Walks the same-named nou-tools courses until one has the user's class.
 * Falls back to the first course with an undivided class, then to the first
 * course without a matched class.
 */
async function findCourseByClass(
  client: Pick<NouToolsClient, 'getCourseDetail'>,
  summaryIds: number[],
  className: string | null,
): Promise<CourseMatch> {
  let fallback: CourseMatch | null = null;

  for (const summaryId of summaryIds) {
    const detail = await client.getCourseDetail(summaryId);
    const { exact, undivided } = resolveMatchedClass(detail, className);

    if (exact !== null) {
      return { nouToolsCourseId: summaryId, detail, matchedClass: exact };
    }

    if (
      fallback === null ||
      (fallback.matchedClass === null && undivided !== null)
    ) {
      fallback = {
        nouToolsCourseId: summaryId,
        detail,
        matchedClass: undivided,
      };
    }
  }

  // summaryIds is never empty, so at least one candidate was recorded.
  return fallback as CourseMatch;
}

function resolveMatchedClass(
  detail: JsonObject | null,
  className: string | null,
): { exact: JsonObject | null; undivided: JsonObject | null } {
  const none = { exact: null, undivided: null };

  if (detail === null || !isRecord(detail.classes)) {
    return none;
  }

  const classes = Array.isArray(detail.classes)
    ? detail.classes
    : Object.values(detail.classes);

  if (classes.length === 1 && isRecord(classes[0])) {
    const only = classes[0] as JsonObject;

    if (classCode(only) === UNIFIED_IN_PERSON_CLASS_CODE) {
      return { exact: only, undivided: null };
    }
  }

  const expectedCode = resolveClassCode(className);
  let undivided: JsonObject | null = null;

  for (const item of classes) {
    if (!isRecord(item)) {
      continue;
    }

    const code = classCode(item as JsonObject);

    if (expectedCode !== null && code === expectedCode) {
      return { exact: item as JsonObject, undivided: null };
    }

    if (code === UNDIVIDED_CLASS_CODE) {
      undivided = item as JsonObject;
    }
  }

  return { exact: null, undivided };
}

function classCode(item: JsonObject): string {
  return typeof item.code === 'string' ? item.code.trim().toUpperCase() : '';
}

function resolveClassCode(className: string | null): string | null {
  if (typeof className !== 'string') {
    return null;
  }

  const trimmed = className.trim().replace(/班$/u, '').trim();

  return trimmed === '' ? null : trimmed.toUpperCase();
}

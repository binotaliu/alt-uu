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

  const termMaps = new Map<string, Map<string, number>>();

  for (const term of termCodes) {
    termMaps.set(term, buildSummaryMap(await client.listCourses(term)));
  }

  const results: NouToolsCourseData[] = [];

  for (const course of userCourses) {
    const termCode = normalizeTermCode(course.semester);
    const normalizedName = normalizeCourseName(course.name);
    const summaryId =
      termCode === null || normalizedName === ''
        ? undefined
        : termMaps.get(termCode)?.get(normalizedName);
    const base = {
      courseId: course.courseId,
      name: course.name,
      semester: course.semester,
      className: course.className,
    };

    if (summaryId === undefined) {
      results.push({
        ...base,
        nouToolsCourseId: null,
        detail: null,
        matchedClass: null,
      });
      continue;
    }

    const detail = await client.getCourseDetail(summaryId);

    results.push({
      ...base,
      nouToolsCourseId: summaryId,
      detail,
      matchedClass: resolveMatchedClass(detail, course.className),
    });
  }

  return results;
}

function buildSummaryMap(summaries: JsonObject[]): Map<string, number> {
  const map = new Map<string, number>();

  for (const summary of summaries) {
    const id = Number.parseInt(String(summary.id ?? 0), 10) || 0;
    const name = typeof summary.name === 'string' ? summary.name.trim() : '';
    const normalizedName = normalizeCourseName(name);

    if (id <= 0 || normalizedName === '') {
      continue;
    }

    map.set(normalizedName, id);
  }

  return map;
}

function resolveMatchedClass(
  detail: JsonObject | null,
  className: string | null,
): JsonObject | null {
  if (detail === null || !isRecord(detail.classes)) {
    return null;
  }

  const classes = Array.isArray(detail.classes)
    ? detail.classes
    : Object.values(detail.classes);

  if (classes.length === 1 && isRecord(classes[0])) {
    const only = classes[0] as JsonObject;

    if (classCode(only) === UNIFIED_IN_PERSON_CLASS_CODE) {
      return only;
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
      return item as JsonObject;
    }

    if (code === UNDIVIDED_CLASS_CODE) {
      undivided = item as JsonObject;
    }
  }

  return undivided;
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

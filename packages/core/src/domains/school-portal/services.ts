import {
  normalizeCourseName,
  normalizeTermCode,
} from '../course/support/courseNameMatcher';
import { createGetCourseClassSessionInfo } from './classSessionInfo';
import type { SchoolPortalDomainDeps } from './deps';
import { SchoolPortalExamInfoRepository } from './examInfoRepository';
import {
  SchoolPortalGradeRepository,
  gradeToViewModel,
} from './gradeRepository';
import { createGetSchoolPortalHomeworkNotices } from './homeworkNotices';
import type {
  CourseSchoolPortalInfo,
  SchoolPortalCourseRef,
  SchoolPortalExamAgendaItem,
  SchoolPortalCourseExamScopes,
  SchoolPortalExamInfo,
  SchoolPortalGrade,
} from './types';

/** Only 正考 categories are regular exams; 補考/重補修考 are excluded. */
const REGULAR_EXAM_MARKER = '正考';

/**
 * Builds the school portal domain operations. Replaces the legacy
 * `/api/grades`, `/api/exam-agenda`, `/api/courses/{cid}/grades` and
 * `/api/courses/{cid}/school-portal-info` endpoints plus their Actions.
 */
export function createSchoolPortalDomainServices(deps: SchoolPortalDomainDeps) {
  const gradeRepository = new SchoolPortalGradeRepository(deps);
  const examInfoRepository = new SchoolPortalExamInfoRepository(deps);
  const getCourseClassSessionInfo = createGetCourseClassSessionInfo(deps);
  const getSchoolPortalHomeworkNotices =
    createGetSchoolPortalHomeworkNotices(deps);

  const findCourse = async (
    courseId: string,
  ): Promise<SchoolPortalCourseRef | null> =>
    (await deps.listCourses()).find((item) => item.courseId === courseId) ??
    null;

  /** GetAllCourseGrades (GET /api/grades). */
  const getAllCourseGrades = async (): Promise<SchoolPortalGrade[]> => {
    const rows = [];
    const seenKeys = new Set<string>();

    for (const grade of await gradeRepository.currentSemesterGrades()) {
      seenKeys.add(`${grade.termCode}|${grade.normalizedCourseName}`);
      rows.push(grade);
    }

    // The historical page also tends to list the current semester.
    for (const grade of await gradeRepository.historicalGrades()) {
      const key = `${grade.termCode}|${grade.normalizedCourseName}`;

      if (seenKeys.has(key)) {
        continue;
      }

      seenKeys.add(key);
      rows.push(grade);
    }

    rows.sort((a, b) => compareStrings(b.termCode ?? '', a.termCode ?? ''));

    return rows.map(gradeToViewModel);
  };

  /** GetCourseSemesterGrade. */
  const getCourseSemesterGrade = async (
    course: SchoolPortalCourseRef,
  ): Promise<SchoolPortalGrade | null> => {
    const targetName = normalizeCourseName(course.name);
    const targetTerm = normalizeTermCode(course.semester);

    if (targetName === '' || targetTerm === null) {
      return null;
    }

    const matches = (grade: {
      termCode: string | null;
      normalizedCourseName: string;
    }): boolean =>
      grade.termCode === targetTerm &&
      grade.normalizedCourseName === targetName;

    const current = (await gradeRepository.currentSemesterGrades()).find(
      matches,
    );

    if (current !== undefined) {
      return gradeToViewModel(current);
    }

    // Past semesters are only on the historical page (coarser fields).
    const historical = (await gradeRepository.historicalGrades()).find(matches);

    return historical === undefined ? null : gradeToViewModel(historical);
  };

  /** GetCourseExamInfo. */
  const getCourseExamInfo = async (
    course: SchoolPortalCourseRef,
  ): Promise<SchoolPortalExamInfo | null> => {
    const targetName = normalizeCourseName(course.name);
    const targetTerm = normalizeTermCode(course.semester);

    if (targetName === '' || targetTerm === null) {
      return null;
    }

    const page = await examInfoRepository.currentSemesterExamInfo();
    const matched = page.courses.find(
      (item) => item.normalizedName === targetName,
    );

    if (page.termCode !== targetTerm || matched === undefined) {
      return null;
    }

    return {
      courseName: matched.courseName,
      semesterLabel: page.semesterLabel,
      schedules: matched.schedules.map((schedule) => ({ ...schedule })),
      scopes: matched.scopes.map((scope) => ({ ...scope })),
    };
  };

  /** 考試命題範圍 per course, for the 考試資訊 page (no legacy counterpart). */
  const getExamScopes = async (): Promise<SchoolPortalCourseExamScopes[]> => {
    const page = await examInfoRepository.currentSemesterExamInfo();

    return page.courses
      .filter((course) => course.scopes.length > 0)
      .map((course) => ({
        courseName: course.courseName,
        scopes: course.scopes.map((scope) => ({ ...scope })),
      }));
  };

  /** GetExamAgenda (GET /api/exam-agenda): the `items` array. */
  const getExamAgenda = async (): Promise<SchoolPortalExamAgendaItem[]> => {
    const page = await examInfoRepository.currentSemesterExamInfo();
    const items: SchoolPortalExamAgendaItem[] = [];

    for (const course of page.courses) {
      for (const schedule of course.schedules) {
        if (!schedule.category.includes(REGULAR_EXAM_MARKER)) {
          continue;
        }

        // Non-scheduled exams (note only) have nothing to schedule.
        if (schedule.time === null) {
          continue;
        }

        items.push({
          courseName: course.courseName,
          category: schedule.category,
          date: schedule.date,
          time: schedule.time,
          room: schedule.room,
        });
      }
    }

    return items
      .map((item) => ({ item, key: agendaSortKey(item) }))
      .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
      .map(({ item }) => item);
  };

  /** GET /api/courses/{cid}/grades: `grade` or null on unknown course / failure. */
  const getCourseGrade = async (
    courseId: string,
  ): Promise<SchoolPortalGrade | null> => {
    const course = await findCourse(courseId);

    if (course === null) {
      return null;
    }

    try {
      return await getCourseSemesterGrade(course);
    } catch {
      return null;
    }
  };

  /** GET /api/courses/{cid}/school-portal-info; each half degrades to null. */
  const getCourseSchoolPortalInfo = async (
    courseId: string,
  ): Promise<CourseSchoolPortalInfo> => {
    const course = await findCourse(courseId);

    if (course === null) {
      return { classSessionInfo: null, examInfo: null };
    }

    let classSessionInfo = null;
    let examInfo = null;

    try {
      classSessionInfo = await getCourseClassSessionInfo(course);
    } catch {
      classSessionInfo = null;
    }

    try {
      examInfo = await getCourseExamInfo(course);
    } catch {
      examInfo = null;
    }

    return { classSessionInfo, examInfo };
  };

  return {
    getAllCourseGrades,
    getCourseGrade,
    getCourseSemesterGrade,
    getCourseSchoolPortalInfo,
    getCourseClassSessionInfo,
    getCourseExamInfo,
    getExamAgenda,
    getExamScopes,
    getSchoolPortalHomeworkNotices,
  };
}

export type SchoolPortalDomainServices = ReturnType<
  typeof createSchoolPortalDomainServices
>;

function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Sortable "YYYYMMDDHHmm" key from the portal's free-form date/time
 * ("2026年11月07日(星期六)", "1500~1610第5節"); unparseable sorts last.
 */
function agendaSortKey(item: SchoolPortalExamAgendaItem): number {
  const { date, time } = item;

  if (date === null || time === null) {
    return Number.POSITIVE_INFINITY;
  }

  const dateMatch = date.match(/^(\d+)年(\d+)月(\d+)日/u);
  const timeMatch = time.match(/^(\d{2})(\d{2})/);

  if (dateMatch === null || timeMatch === null) {
    return Number.POSITIVE_INFINITY;
  }

  const [year, month, day] = dateMatch.slice(1).map(Number) as [
    number,
    number,
    number,
  ];
  const [hour, minute] = timeMatch.slice(1).map(Number) as [number, number];

  return year * 100000000 + month * 1000000 + day * 10000 + hour * 100 + minute;
}

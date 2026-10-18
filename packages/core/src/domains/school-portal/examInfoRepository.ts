import { textContent } from 'domutils';
import type { Element } from 'domhandler';
import {
  normalizeCourseName,
  normalizeTermCode,
} from '../course/support/courseNameMatcher';
import type { SchoolPortalDomainDeps } from './deps';
import { CACHE_TTL_SECONDS } from './deps';
import {
  anonymousScope,
  descendants,
  divsWithClass,
  elementChildren,
  firstTitleButtonText,
  hasClass,
  normalizeText,
  parsePortalHtml,
  splitDetail,
} from './html';
import type { SchoolPortalExamSchedule, SchoolPortalExamScope } from './types';

const CACHE_KEY_PREFIX = 'alt-uu:school-portal:exam-info:';
const SCHEDULE_CONTAINER_ID = 'accordion-courses-exmtime';
const SCOPE_CONTAINER_ID = 'accordion-courses-range';

export interface ParsedExamCourse {
  normalizedName: string;
  courseName: string;
  schedules: SchoolPortalExamSchedule[];
  scopes: SchoolPortalExamScope[];
}

export interface ParsedExamInfoPage {
  termCode: string | null;
  semesterLabel: string;
  /** Insertion-ordered (a plain array, so it survives the JSON cache). */
  courses: ParsedExamCourse[];
}

const emptyPage = (): ParsedExamInfoPage => ({
  termCode: null,
  semesterLabel: '',
  courses: [],
});

/** Port of SchoolPortalExamInfoRepository (qryexm, current semester only). */
export class SchoolPortalExamInfoRepository {
  constructor(private readonly deps: SchoolPortalDomainDeps) {}

  async currentSemesterExamInfo(): Promise<ParsedExamInfoPage> {
    const key =
      CACHE_KEY_PREFIX + anonymousScope(await this.deps.getProfileUsername());

    return this.deps.cache.remember(key, CACHE_TTL_SECONDS, async () => {
      const page = await this.deps.client.fetchExamInfoPage();

      return page.status >= 400 ? emptyPage() : parseExamInfo(page.body);
    });
  }
}

export function parseExamInfo(html: string): ParsedExamInfoPage {
  if (html === '') {
    return emptyPage();
  }

  const nodes = parsePortalHtml(html);
  const yearNode = descendants(
    nodes,
    (element) => element.name === 'div' && hasClass(element, 'year-box'),
  )
    .flatMap((box) => divsWithClass(box, 'year'))
    .at(0);
  const semesterLabel =
    yearNode === undefined ? '' : normalizeText(textContent(yearNode));
  const courses: ParsedExamCourse[] = [];

  eachLeafCategory(nodes, SCHEDULE_CONTAINER_ID, (category, body) =>
    collectScheduleEntries(body, category, courses),
  );
  eachLeafCategory(nodes, SCOPE_CONTAINER_ID, (category, body) =>
    collectScopeEntries(body, category, courses),
  );

  return {
    termCode: normalizeTermCode(semesterLabel),
    semesterLabel,
    courses,
  };
}

function eachLeafCategory(
  nodes: ReturnType<typeof parsePortalHtml>,
  containerId: string,
  callback: (category: string, body: Element) => void,
): void {
  const container = descendants(
    nodes,
    (element) =>
      element.name === 'div' && element.attribs['id'] === containerId,
  )[0];

  if (container === undefined) {
    return;
  }

  const leaves = divsWithClass(container, 'accordion-item').filter(
    (item) => divsWithClass(item, 'accordion').length === 0,
  );

  for (const leaf of leaves) {
    const category = firstTitleButtonText(leaf);
    const body = divsWithClass(leaf, 'accordion-body')[0];

    if (category === '' || body === undefined) {
      continue;
    }

    callback(category, body);
  }
}

function courseFor(
  courses: ParsedExamCourse[],
  courseName: string,
): ParsedExamCourse | null {
  const normalizedName = normalizeCourseName(courseName);

  if (normalizedName === '') {
    return null;
  }

  let course = courses.find((item) => item.normalizedName === normalizedName);

  if (course === undefined) {
    course = { normalizedName, courseName, schedules: [], scopes: [] };
    courses.push(course);
  }

  return course;
}

function collectScheduleEntries(
  body: Element,
  category: string,
  courses: ParsedExamCourse[],
): void {
  let currentCourseName: string | null = null;
  let currentEntry: SchoolPortalExamSchedule | null = null;

  const flush = (): void => {
    if (currentCourseName === null || currentEntry === null) {
      return;
    }

    courseFor(courses, currentCourseName)?.schedules.push(currentEntry);
  };

  for (const child of elementChildren(body)) {
    if (hasClass(child, 'title')) {
      flush();
      currentCourseName = stripCourseTitleMarker(
        normalizeText(textContent(child)),
      );
      currentEntry = {
        category,
        date: null,
        time: null,
        room: null,
        note: null,
      };

      continue;
    }

    if (currentEntry === null || !hasClass(child, 'detail')) {
      continue;
    }

    const [label, value] = splitDetail(textContent(child));

    switch (label) {
      case '日期':
        currentEntry.date = value;
        break;
      case '時間':
        currentEntry.time = value;
        break;
      case '教室代號':
        currentEntry.room = value;
        break;
      default:
        currentEntry.note = label !== '' ? `${label}：${value}` : value;
    }
  }

  flush();
}

function collectScopeEntries(
  body: Element,
  category: string,
  courses: ParsedExamCourse[],
): void {
  let currentCourseName: string | null = null;
  let currentScope: string | null = null;

  const flush = (): void => {
    if (currentCourseName === null) {
      return;
    }

    courseFor(courses, currentCourseName)?.scopes.push({
      category,
      scope: currentScope,
    });
  };

  for (const child of elementChildren(body)) {
    if (hasClass(child, 'title')) {
      flush();
      currentCourseName = stripCourseTitleMarker(
        normalizeText(textContent(child)),
      );
      currentScope = null;

      continue;
    }

    if (currentCourseName === null || !hasClass(child, 'detail')) {
      continue;
    }

    const text = normalizeText(textContent(child));
    currentScope = currentScope === null ? text : `${currentScope} ${text}`;
  }

  flush();
}

/** Course titles under "考試資訊" are prefixed with a "◉ " bullet. */
function stripCourseTitleMarker(title: string): string {
  return title.replace(/^◉\s*/u, '').trim();
}

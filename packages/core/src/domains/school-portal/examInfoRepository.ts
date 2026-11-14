import { isTag, isText, type Element } from 'domhandler';
import { textContent } from 'domutils';
import {
  normalizeCourseName,
  normalizeTermCode,
} from '../course/support/courseNameMatcher';
import type { SchoolPortalAccountScope, SchoolPortalDomainDeps } from './deps';
import { CACHE_TTL_SECONDS } from './deps';
import {
  anonymousScope,
  descendants,
  divsWithClass,
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

  async currentSemesterExamInfo(
    scope: SchoolPortalAccountScope = {},
  ): Promise<ParsedExamInfoPage> {
    const key =
      CACHE_KEY_PREFIX +
      anonymousScope(
        scope.accountId === undefined
          ? await this.deps.getProfileUsername()
          : scope.username,
      );

    return this.deps.cache.remember(key, CACHE_TTL_SECONDS, async () => {
      const page = await this.deps.client.fetchExamInfoPage(scope.accountId);

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

  for (const row of entryRows(body)) {
    if (hasClass(row, 'title')) {
      flush();
      currentCourseName = stripCourseTitleMarker(
        normalizeText(textContent(row)),
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

    if (currentEntry === null) {
      continue;
    }

    for (const line of detailLines(row)) {
      applyScheduleLine(currentEntry, line);
    }
  }

  flush();
}

function applyScheduleLine(
  entry: SchoolPortalExamSchedule,
  line: string,
): void {
  const [label, value] = splitDetail(line);

  switch (label) {
    case '日期':
      entry.date = value;
      break;
    case '時間':
      entry.time = value;
      break;
    case '教室代號':
      entry.room = value;
      break;
    case '考試校區':
      entry.campus = value;
      appendNote(entry, label, value);
      break;
    case '考試地址':
      entry.address = value;
      appendNote(entry, label, value);
      break;
    default:
      appendNote(entry, label, value);
  }
}

function appendNote(
  entry: SchoolPortalExamSchedule,
  label: string,
  value: string,
): void {
  const formatted = label !== '' ? `${label}：${value}` : value;

  if (formatted === '') {
    return;
  }

  entry.note = entry.note === null ? formatted : `${entry.note}\n${formatted}`;
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

  for (const row of entryRows(body)) {
    if (hasClass(row, 'title')) {
      flush();
      currentCourseName = stripCourseTitleMarker(
        normalizeText(textContent(row)),
      );
      currentScope = null;

      continue;
    }

    if (currentCourseName === null) {
      continue;
    }

    const text = normalizeText(textContent(row));
    currentScope = currentScope === null ? text : `${currentScope} ${text}`;
  }

  flush();
}

/**
 * Title and detail rows under an accordion body, in document order.
 *
 * The captured qryexm page puts them directly in `.accordion-body`. A later
 * page can wrap each course (`div` around `.title` + `.detail`) and look the
 * same: the beige/gray bars are the title and detail themselves. Only walking
 * direct children then drops every exam, and the screen shows 查無考試資訊.
 * A title or detail nested inside another is the inner markup of that row,
 * not a new row.
 */
function entryRows(body: Element): Element[] {
  return descendants(body, (element) => {
    if (!hasClass(element, 'title') && !hasClass(element, 'detail')) {
      return false;
    }

    let parent = element.parent;

    while (parent !== null && parent !== body) {
      if (
        isTag(parent) &&
        (hasClass(parent, 'title') || hasClass(parent, 'detail'))
      ) {
        return false;
      }

      parent = parent.parent;
    }

    return true;
  });
}

/**
 * One label/value line per block inside a detail. The live page uses one
 * `.detail` per field, but also nests the text in an inner `div`, and a
 * single detail can hold several lines. Reading only the first colon of the
 * whole text leaves `time` null, and a 正考 with no time is dropped.
 */
function detailLines(detail: Element): string[] {
  const lines: string[] = [];
  let directText = '';

  const flushDirect = (): void => {
    const line = normalizeText(directText);

    if (line !== '') {
      lines.push(line);
    }

    directText = '';
  };

  for (const node of detail.children) {
    if (isTag(node)) {
      if (node.name === 'br') {
        flushDirect();
        continue;
      }

      const line = normalizeText(textContent(node));

      if (line !== '') {
        lines.push(line);
      }

      continue;
    }

    if (isText(node)) {
      directText += node.data;
    }
  }

  flushDirect();

  if (lines.length > 0) {
    return lines;
  }

  const text = normalizeText(textContent(detail));

  return text === '' ? [] : [text];
}

/**
 * Course titles under 考試資訊 are prefixed with a circle bullet. The captured
 * page uses "◉ "; the 115上 page renders a "◎"-like marker. Either way the
 * name used to match 命題範圍 must not include it.
 */
function stripCourseTitleMarker(title: string): string {
  return title.replace(/^[◉◎○●•∙◦]\s*/u, '').trim();
}

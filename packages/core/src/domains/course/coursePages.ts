import type { Element } from 'domhandler';
import { UserFacingHttpError } from '../../errors/errors';
import type { HunguPageResult } from '../../hungu/types';
import {
  attr,
  classContains,
  findElements,
  hasAttr,
  hasClassToken,
  nodeText,
  normalizeText,
  parseHtml,
} from './support/html';
import { phpInt } from './support/php';
import { phpTrim } from './support/phpUrl';
import type {
  CourseMaterialNode,
  CourseHomeworkItem,
  CourseLearningTimeItem,
  CourseTasksCount,
} from './types';

// ---------------------------------------------------------------------------
// GetCourseTasksCount

export interface TasksCountClient {
  fetchPendingHomeworkPage(): Promise<HunguPageResult>;
  fetchUnreadArticlesPage(): Promise<HunguPageResult>;
}

/**
 * Port of GetCourseTasksCount: pending homeworks (my_homework.php, column 3)
 * and unread articles (my_forum.php, column 2) per course.
 */
export async function getCourseTasksCount(
  client: TasksCountClient,
): Promise<CourseTasksCount[]> {
  let pendingHomeworks = new Map<string, number>();
  let unreadArticles = new Map<string, number>();

  // The first request after app start sometimes sees an unstable cookie
  // state and gets empty pages, so try once more when both are empty.
  for (let attempt = 0; attempt < 2; attempt++) {
    pendingHomeworks = parseTaskPage(
      await client.fetchPendingHomeworkPage(),
      3,
    );
    unreadArticles = parseTaskPage(await client.fetchUnreadArticlesPage(), 2);

    if (pendingHomeworks.size > 0 || unreadArticles.size > 0) {
      break;
    }
  }

  const merged: CourseTasksCount[] = [];

  for (const [courseId, count] of pendingHomeworks) {
    merged.push({
      courseId,
      pendingHomeworks: count,
      unreadArticles: unreadArticles.get(courseId) ?? 0,
    });
  }

  for (const [courseId, count] of unreadArticles) {
    if (!pendingHomeworks.has(courseId)) {
      merged.push({
        courseId,
        pendingHomeworks: 0,
        unreadArticles: count,
      });
    }
  }

  return merged;
}

function parseTaskPage(
  page: HunguPageResult,
  countColumnIndex: number,
): Map<string, number> {
  const results = new Map<string, number>();

  if ((page.status ?? 500) >= 400 || page.body === '') {
    return results;
  }

  // `div.data2 table.table.subject tr`
  const rows = findElements(
    findElements(
      findElements(
        parseHtml(page.body),
        (element) => element.name === 'div' && hasClassToken(element, 'data2'),
      ),
      (element) =>
        element.name === 'table' &&
        hasClassToken(element, 'table') &&
        hasClassToken(element, 'subject'),
    ),
    (element) => element.name === 'tr',
  );

  for (const row of unique(rows)) {
    const cells = findElements(row, (element) => element.name === 'td');

    if (cells.length < countColumnIndex + 1) {
      continue;
    }

    const courseId = collapseWhitespace(nodeText(cells[0]));

    if (courseId === '') {
      continue;
    }

    results.set(
      courseId,
      phpInt(collapseWhitespace(nodeText(cells[countColumnIndex]))),
    );
  }

  return results;
}

/** `trim(preg_replace('/\s+/', ' ', $text))` (ASCII whitespace). */
function collapseWhitespace(value: string): string {
  return phpTrim(value.replace(/[ \t\n\r\v\f]+/g, ' '));
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

// ---------------------------------------------------------------------------
// GetCourseLearningTimeItems

/** Port of GetCourseLearningTimeItems' page parsing and node matching. */
export function mapLearningTimes(
  page: HunguPageResult,
  nodes: CourseMaterialNode[],
): CourseLearningTimeItem[] {
  if ((page.status ?? 500) >= 400) {
    throw new UserFacingHttpError(502, '讀取學習時數失敗。');
  }

  const durationsByText = parseDurationsByText(page.body ?? '');

  return nodes.map((node) => {
    const text = normalizeText(node.text);

    return {
      identifier: node.identifier,
      href: node.href,
      text: node.text,
      level: node.level,
      itemDisabled: node.itemDisabled,
      duration: text === '' ? null : (durationsByText.get(text) ?? null),
    };
  });
}

function parseDurationsByText(html: string): Map<string, string> {
  const results = new Map<string, string>();

  if (html === '') {
    return results;
  }

  const rows = findElements(
    findElements(
      parseHtml(html),
      (element) =>
        element.name === 'table' && hasClassToken(element, 'subject'),
    ),
    (element) => element.name === 'tr',
  );

  for (const row of unique(rows)) {
    const columns = findElements(row, (element) => element.name === 'td');

    if (columns.length < 2) {
      continue;
    }

    const title = normalizeText(nodeText(columns[0]));
    const duration = normalizeDuration(nodeText(columns[1]));

    if (title !== '' && duration !== '') {
      results.set(title, duration);
    }
  }

  return results;
}

function normalizeDuration(raw: string): string {
  let value = raw.replace(/[ \t\n\r\v\f]+/g, '');
  value = /^\d{2}:\d{2}:\d{2}$/.test(value) ? value : '';

  // Strip leading zeros (legacy behaviour, including its quirks).
  if (value.startsWith('00:')) {
    return value.slice(3);
  }

  return value.startsWith('0') ? value.slice(1) : value;
}

// ---------------------------------------------------------------------------
// GetCourseHomeworks / GetCourseSelfExams

/** Port of GetCourseHomeworks' page parsing. */
export function parseHomeworkItems(
  page: HunguPageResult,
  baseUrl: string,
): CourseHomeworkItem[] {
  if ((page.status ?? 500) >= 400) {
    throw new UserFacingHttpError(502, '讀取作業列表失敗。');
  }

  if ((page.body ?? '') === '') {
    return [];
  }

  const nodes = parseHtml(page.body);
  const resultUrlSuffix = extractResultUrlSuffix(nodes);
  const items: CourseHomeworkItem[] = [];

  for (const box of boxes(nodes)) {
    let title = '';
    let percent: string | null = null;
    const hasTitle =
      findElements(
        box,
        (element) => element.name === 'div' && hasClassToken(element, 'title'),
      ).length > 0;

    if (hasTitle) {
      const percentNode = findElements(
        box,
        (element) =>
          (element.name === 'span' || element.name === 'div') &&
          (hasClassToken(element, 'sparkpie') ||
            hasClassToken(element, 'exam-percent-tips')),
      )[0];

      if (percentNode !== undefined && hasAttr(percentNode, 'title')) {
        percent = normalizeText(attr(percentNode, 'title'));
      }

      const titleNode = findElements(
        box,
        (element) =>
          element.name === 'span' &&
          hasAttr(element, 'title') &&
          !hasClassToken(element, 'sparkpie'),
      )[0];

      if (titleNode !== undefined) {
        title = normalizeText(nodeText(titleNode));
      }
    }

    if (title === '') {
      continue;
    }

    const type = normalizeText(attr(box, 'data-type') ?? '');
    const { status, window, actionNode, resultNode } = processButtons(box);
    const actionUrl =
      actionNode === undefined
        ? null
        : homeworkActionUrl(actionNode, baseUrl, type);
    const resultUrl =
      resultNode === undefined
        ? null
        : homeworkResultUrl(resultNode, baseUrl, resultUrlSuffix);

    items.push({
      title,
      percent: percent ?? '',
      type: type === '' ? 'homework' : type,
      status: status === '' ? null : status,
      window: window === '' ? null : window,
      actionUrl,
      resultUrl,
      source: 'homework',
      isSubmitted: false,
      resultUnavailableReason: null,
    });
  }

  return items;
}

/** Port of GetCourseSelfExams' page parsing. */
export function parseSelfExamItems(
  page: HunguPageResult,
  baseUrl: string,
): CourseHomeworkItem[] {
  if ((page.status ?? 500) >= 400) {
    throw new UserFacingHttpError(502, '讀取自我練習列表失敗。');
  }

  if ((page.body ?? '') === '') {
    return [];
  }

  const nodes = parseHtml(page.body);
  const resultUrlSuffix = extractResultUrlSuffix(nodes);
  const items: CourseHomeworkItem[] = [];

  for (const box of boxes(nodes)) {
    const titleNode = findElements(
      box,
      (element) => element.name === 'span' && hasAttr(element, 'title'),
    )[0];
    const title =
      titleNode !== undefined ? normalizeText(nodeText(titleNode)) : '';

    if (title === '') {
      continue;
    }

    const { status, window, actionNode, resultNode } = processButtons(box);
    let actionUrl: string | null = null;
    let resultUrl: string | null = null;
    let resultUnavailableReason: string | null = null;

    if (actionNode !== undefined) {
      const id = extractOnclickArgument(actionNode, /togo\('([^']+)'/);
      actionUrl =
        id === '' ? null : `${baseUrl}/learn/exam/exam_start.php?${id}+0`;
    }

    if (resultNode !== undefined) {
      resultUrl = selfExamResultUrl(resultNode, baseUrl, resultUrlSuffix);

      if (resultUrl === null) {
        const reasonNode = firstSubText(resultNode);
        const reason =
          reasonNode !== undefined ? normalizeText(nodeText(reasonNode)) : '';
        resultUnavailableReason = reason === '' ? null : reason;
      }
    }

    const isSubmitted =
      findElements(
        box,
        (element) =>
          element.name === 'img' &&
          ((attr(element, 'src') ?? '').includes('answer_submit') ||
            attr(element, 'title') === '繳交完成'),
      ).length > 0;

    items.push({
      title,
      percent: '',
      type: 'self-exam',
      status: status === '' ? null : status,
      window: window === '' ? null : window,
      actionUrl,
      resultUrl,
      source: 'self-exam',
      isSubmitted,
      resultUnavailableReason,
    });
  }

  return items;
}

/** `//div[contains(concat(" ", normalize-space(@class), " "), " box2 ")]` */
function boxes(nodes: ReturnType<typeof parseHtml>): Element[] {
  return findElements(
    nodes,
    (element) => element.name === 'div' && hasClassToken(element, 'box2'),
  );
}

function processButtons(box: Element): {
  status: string | null;
  window: string | null;
  actionNode: Element | undefined;
  resultNode: Element | undefined;
} {
  const button = (kind: string): Element | undefined =>
    findElements(
      box,
      (element) =>
        element.name === 'div' &&
        hasClassToken(element, 'process-btn') &&
        hasClassToken(element, kind),
    )[0];
  const actionNode = button('pay');
  const resultNode = button('score');
  let status: string | null = null;
  let window: string | null = null;

  if (actionNode !== undefined) {
    const statusNode = findElements(
      actionNode,
      (element) =>
        element.name === 'div' && classContains(element, 'main-text'),
    )[0];
    const windowNode = firstSubText(actionNode);
    status =
      statusNode !== undefined ? normalizeText(nodeText(statusNode)) : null;
    window =
      windowNode !== undefined ? normalizeText(nodeText(windowNode)) : null;
  }

  return { status, window, actionNode, resultNode };
}

function firstSubText(node: Element): Element | undefined {
  return findElements(
    node,
    (element) => element.name === 'div' && classContains(element, 'sub-text'),
  )[0];
}

function homeworkActionUrl(
  actionNode: Element,
  baseUrl: string,
  type: string,
): string | null {
  const id = extractOnclickArgument(actionNode, /togo\('([^']+)'/);

  if (id === '') {
    return null;
  }

  const folder = type.toLowerCase() === 'peer' ? 'peer' : 'homework';

  return `${baseUrl}/learn/${folder}/exam_pre_start.php?${id}+0`;
}

function homeworkResultUrl(
  resultNode: Element,
  baseUrl: string,
  resultUrlSuffix: string | null,
): string | null {
  const onclick = attr(resultNode, 'onclick') ?? '';

  if (onclick === '') {
    return null;
  }

  const match = /view_homework\('([^']+)'\s*,\s*'([^']+)'/.exec(onclick);

  if (match === null) {
    return null;
  }

  const type = phpTrim(match[1]);
  const eid = phpTrim(match[2]);

  if (type === '' || eid === '') {
    return null;
  }

  return `${baseUrl}/learn/${type}/view_exemplar.php?${eid}+${resultUrlSuffix ?? 'personal'}`;
}

function selfExamResultUrl(
  resultNode: Element,
  baseUrl: string,
  resultUrlSuffix: string | null,
): string | null {
  const viewResultId = extractOnclickArgument(
    resultNode,
    /viewResult\('([^']+)'\)/i,
  );

  if (viewResultId !== '') {
    return `${baseUrl}/learn/exam/view_result.php?${viewResultId}`;
  }

  const homeworkId = extractOnclickArgument(
    resultNode,
    /view_homework\('[^']+'\s*,\s*'([^']+)'/,
  );

  if (homeworkId === '') {
    return null;
  }

  return `${baseUrl}/learn/exam/co_self_exam_exemplar.php?${homeworkId}+${resultUrlSuffix ?? 'personal'}`;
}

/**
 * First capture of `pattern` in the node's own onclick, else in the LAST
 * descendant onclick that matches (the legacy loop kept overwriting).
 */
function extractOnclickArgument(node: Element, pattern: RegExp): string {
  const own = pattern.exec(attr(node, 'onclick') ?? '');

  if (own !== null) {
    return phpTrim(own[1] ?? '');
  }

  let found: string | null = null;

  for (const child of findElements(node, (element) =>
    hasAttr(element, 'onclick'),
  )) {
    const match = pattern.exec(attr(child, 'onclick') ?? '');

    if (match !== null) {
      found = match[1] ?? null;
    }
  }

  return found === null ? '' : phpTrim(found);
}

/** The `+suffix` the page's view_homework() appends to result URLs. */
function extractResultUrlSuffix(
  nodes: ReturnType<typeof parseHtml>,
): string | null {
  for (const script of findElements(
    nodes,
    (element) => element.name === 'script',
  )) {
    const content = nodeText(script);

    if (!content.includes('function view_homework')) {
      continue;
    }

    const match =
      /window\.open\([\s\S]*?view_exemplar\.php[\s\S]*?\s*eid\s*\+\s*'([^']*)'/.exec(
        content,
      );
    const suffix = phpTrim(match?.[1] ?? '');

    if (suffix !== '') {
      return suffix.replace(/^\++/, '');
    }
  }

  return null;
}

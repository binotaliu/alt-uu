import { textContent } from 'domutils';
import { normalizeCourseName, normalizeTermCode } from './courseNameMatcher';
import type { SchoolPortalDomainDeps } from './deps';
import { CACHE_TTL_SECONDS } from './deps';
import {
    anonymousScope,
    descendants,
    elementChildren,
    firstTitleButtonText,
    hasClass,
    normalizeText,
    parsePortalHtml,
    splitDetail,
    yearBoxesAndAccordionItems,
    yearLabel,
} from './html';
import type { Element } from 'domhandler';
import type {
    SchoolPortalCourseRef,
    SchoolPortalHomeworkNotice,
} from './types';

const CACHE_KEY_PREFIX = 'alt-uu:school-portal:homework-notices:';

interface ParsedNotice extends SchoolPortalHomeworkNotice {
    normalizedCourseName: string;
    termCode: string | null;
}

/**
 * Port of GetSchoolPortalHomeworkNotices. Output is the legacy
 * `SchoolPortalHomeworkNoticeViewModel[]` collection shape.
 */
export function createGetSchoolPortalHomeworkNotices(
    deps: SchoolPortalDomainDeps,
) {
    const allNotices = async (): Promise<ParsedNotice[]> => {
        const key =
            CACHE_KEY_PREFIX + anonymousScope(await deps.getProfileUsername());

        return deps.cache.remember(key, CACHE_TTL_SECONDS, async () => {
            const page = await deps.client.fetchHomeworkNoticesPage();

            return page.status >= 400
                ? []
                : parseNotices(page.body, deps.portalBaseUrl);
        });
    };

    return async (
        course: SchoolPortalCourseRef,
    ): Promise<SchoolPortalHomeworkNotice[]> => {
        const targetName = normalizeCourseName(course.name);
        const targetTerm = normalizeTermCode(course.semester);

        if (targetName === '' || targetTerm === null) {
            return [];
        }

        return (await allNotices())
            .filter(
                (notice) =>
                    notice.termCode === targetTerm &&
                    notice.normalizedCourseName === targetName,
            )
            .map((notice) => ({
                title: notice.title,
                dueDate: notice.dueDate,
                submissionMethod: notice.submissionMethod,
                downloadUrl: notice.downloadUrl,
            }));
    };
}

export function parseNotices(
    html: string,
    portalBaseUrl: string,
): ParsedNotice[] {
    if (html === '') {
        return [];
    }

    const notices: ParsedNotice[] = [];
    let termCode: string | null = null;

    for (const node of yearBoxesAndAccordionItems(parsePortalHtml(html))) {
        if (hasClass(node, 'year-box')) {
            termCode = normalizeTermCode(yearLabel(node));

            continue;
        }

        notices.push(...parseNoticeItem(node, termCode, portalBaseUrl));
    }

    return notices;
}

/**
 * One accordion item lists every course that has the assignment: a
 * `detail-title`, then that course's `detail` rows and `detail-url` link,
 * repeated per course. Each course block becomes its own notice.
 */
function parseNoticeItem(
    item: Element,
    termCode: string | null,
    portalBaseUrl: string,
): ParsedNotice[] {
    const title = firstTitleButtonText(item);

    if (title === '') {
        return [];
    }

    const notices: ParsedNotice[] = [];
    let current: ParsedNotice | null = null;

    const rows = descendants(
        item,
        (element) =>
            element.name === 'div' && hasClass(element, 'accordion-body'),
    ).flatMap((body) =>
        elementChildren(body).filter((child) => child.name === 'div'),
    );

    for (const row of rows) {
        if (hasClass(row, 'detail-title')) {
            if (current !== null) {
                notices.push(current);
            }

            const courseName = normalizeCourseName(
                normalizeText(textContent(row)),
            );

            current =
                courseName === ''
                    ? null
                    : {
                          title,
                          normalizedCourseName: courseName,
                          termCode,
                          dueDate: null,
                          submissionMethod: null,
                          downloadUrl: null,
                      };

            continue;
        }

        if (current === null) {
            continue;
        }

        if (hasClass(row, 'detail-url')) {
            current.downloadUrl = extractDownloadUrl(row, portalBaseUrl);

            continue;
        }

        if (hasClass(row, 'detail')) {
            const [label, value] = splitDetail(textContent(row));

            if (label === '繳交日期') {
                current.dueDate = value !== '' ? `繳交日期：${value}` : null;
            } else if (label === '繳交方式') {
                current.submissionMethod = value !== '' ? value : null;
            }
        }
    }

    if (current !== null) {
        notices.push(current);
    }

    return notices;
}

function extractDownloadUrl(
    urlRow: Element,
    portalBaseUrl: string,
): string | null {
    const link = descendants(urlRow, (element) => element.name === 'a')[0];
    const href = link?.attribs['href'] ?? '';

    if (href === '') {
        return null;
    }

    return href.startsWith('http')
        ? href
        : `${portalBaseUrl.replace(/\/+$/, '')}/${href.replace(/^\/+/, '')}`;
}

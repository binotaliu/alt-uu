import { normalizeCourseName, normalizeTermCode } from './courseNameMatcher';
import type { SchoolPortalDomainDeps } from './deps';
import { CACHE_TTL_SECONDS } from './deps';
import {
    anonymousScope,
    detailFields,
    firstTitleButtonText,
    hasClass,
    parsePortalHtml,
    yearBoxesAndAccordionItems,
    yearLabel,
} from './html';
import type {
    ParsedPortalItem,
    SchoolPortalClassSessionInfo,
    SchoolPortalCourseRef,
} from './types';

const CACHE_KEY_PREFIX = 'alt-uu:school-portal:class-session-info:';

/** Port of GetCourseClassSessionInfo. */
export function createGetCourseClassSessionInfo(deps: SchoolPortalDomainDeps) {
    const allClassSessions = async (): Promise<ParsedPortalItem[]> => {
        const key =
            CACHE_KEY_PREFIX + anonymousScope(await deps.getProfileUsername());

        return deps.cache.remember(key, CACHE_TTL_SECONDS, async () => {
            const page = await deps.client.fetchClassSessionInfoPage();

            return page.status >= 400 ? [] : parseClassSessions(page.body);
        });
    };

    return async (
        course: SchoolPortalCourseRef,
    ): Promise<SchoolPortalClassSessionInfo | null> => {
        const targetName = normalizeCourseName(course.name);
        const targetTerm = normalizeTermCode(course.semester);

        if (targetName === '' || targetTerm === null) {
            return null;
        }

        for (const item of await allClassSessions()) {
            if (
                item.termCode === targetTerm &&
                item.normalizedCourseName === targetName
            ) {
                return {
                    courseName: item.courseName,
                    semesterLabel: item.semesterLabel,
                    classDates: item.fields['授課日期'] ?? null,
                    classType: item.fields['班級類型'] ?? null,
                    classCode: item.fields['授課班級代碼'] ?? null,
                    teacher: item.fields['授課教師'] ?? null,
                    classTime: item.fields['上課時間'] ?? null,
                };
            }
        }

        return null;
    };
}

export function parseClassSessions(html: string): ParsedPortalItem[] {
    if (html === '') {
        return [];
    }

    const items: ParsedPortalItem[] = [];
    let semesterLabel = '';
    let termCode: string | null = null;

    for (const node of yearBoxesAndAccordionItems(parsePortalHtml(html))) {
        if (hasClass(node, 'year-box')) {
            semesterLabel = yearLabel(node);
            termCode = normalizeTermCode(semesterLabel);

            continue;
        }

        const courseName = stripTrailingSessionTypeSuffix(
            firstTitleButtonText(node),
        );

        if (courseName === '') {
            continue;
        }

        items.push({
            courseName,
            normalizedCourseName: normalizeCourseName(courseName),
            semesterLabel,
            termCode,
            fields: detailFields(node),
        });
    }

    return items;
}

/** The portal appends the session type, e.g. "課程名稱(網路面授)". */
function stripTrailingSessionTypeSuffix(title: string): string {
    return title.replace(/[（(][^（）()]*[）)]\s*$/u, '').trim();
}

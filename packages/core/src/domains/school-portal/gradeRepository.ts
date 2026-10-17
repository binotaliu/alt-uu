import { normalizeCourseName, normalizeTermCode } from './courseNameMatcher';
import type { SchoolPortalDomainDeps } from './deps';
import { CACHE_TTL_SECONDS, HISTORICAL_CACHE_TTL_SECONDS } from './deps';
import {
    anonymousScope,
    descendants,
    detailFields,
    divsWithClass,
    firstTitleButtonText,
    hasClass,
    normalizeText,
    parsePortalHtml,
    splitDetail,
    splitOnLastColon,
    yearBoxesAndAccordionItems,
    yearLabel,
} from './html';
import type { ParsedPortalItem, SchoolPortalGrade } from './types';
import { textContent } from 'domutils';

const CACHE_KEY_PREFIX = 'alt-uu:school-portal:semester-grades:';
const HISTORICAL_CACHE_KEY_PREFIX = 'alt-uu:school-portal:historical-grades:';

/** Port of SchoolPortalGradeRepository (qryscore / qryscore2). */
export class SchoolPortalGradeRepository {
    constructor(private readonly deps: SchoolPortalDomainDeps) {}

    async currentSemesterGrades(): Promise<ParsedPortalItem[]> {
        return this.deps.cache.remember(
            await this.cacheKey(CACHE_KEY_PREFIX),
            CACHE_TTL_SECONDS,
            async () => {
                const page =
                    await this.deps.client.fetchCurrentSemesterGradesPage();

                return page.status >= 400 ? [] : parseGrades(page.body);
            },
        );
    }

    async historicalGrades(): Promise<ParsedPortalItem[]> {
        return this.deps.cache.remember(
            await this.cacheKey(HISTORICAL_CACHE_KEY_PREFIX),
            HISTORICAL_CACHE_TTL_SECONDS,
            async () => {
                const page = await this.deps.client.fetchHistoricalGradesPage();

                return page.status >= 400
                    ? []
                    : parseHistoricalGrades(page.body);
            },
        );
    }

    private async cacheKey(prefix: string): Promise<string> {
        return prefix + anonymousScope(await this.deps.getProfileUsername());
    }
}

export function gradeToViewModel(grade: ParsedPortalItem): SchoolPortalGrade {
    const { fields } = grade;

    return {
        courseName: grade.courseName,
        semesterLabel: grade.semesterLabel,
        credits: fields['學分數'] ?? null,
        firstRegularScore: fields['第一次平時成績'] ?? null,
        secondRegularScore: fields['第二次平時成績'] ?? null,
        participationScore: fields['學習參與成績'] ?? null,
        regularAverage: fields['平時成績平均'] ?? null,
        midtermScore: fields['期中成績'] ?? null,
        finalScore: fields['期末成績'] ?? null,
        semesterGrade: fields['學期成績'] ?? null,
    };
}

export function parseGrades(html: string): ParsedPortalItem[] {
    if (html === '') {
        return [];
    }

    const grades: ParsedPortalItem[] = [];
    let semesterLabel = '';
    let termCode: string | null = null;

    for (const node of yearBoxesAndAccordionItems(parsePortalHtml(html))) {
        if (hasClass(node, 'year-box')) {
            semesterLabel = yearLabel(node);
            termCode = normalizeTermCode(semesterLabel);

            continue;
        }

        const courseName = firstTitleButtonText(node);

        if (courseName === '') {
            continue;
        }

        grades.push({
            courseName,
            normalizedCourseName: normalizeCourseName(courseName),
            semesterLabel,
            termCode,
            fields: detailFields(node),
        });
    }

    return grades;
}

/**
 * qryscore2 groups courses under one accordion per semester, titled like
 * "114下學期：總計修讀 13 學分", each line "課程名稱：分數 (X學分)".
 */
export function parseHistoricalGrades(html: string): ParsedPortalItem[] {
    if (html === '') {
        return [];
    }

    const grades: ParsedPortalItem[] = [];

    for (const node of descendants(parsePortalHtml(html), (element) =>
        hasClass(element, 'accordion-item'),
    )) {
        const [semesterLabel] = splitDetail(firstTitleButtonText(node));

        if (semesterLabel === '') {
            continue;
        }

        const termCode = normalizeTermCode(semesterLabel);

        for (const detail of divsWithClass(node, 'detail')) {
            // Course names may contain "：", so split on the last colon.
            const [courseName, value] = splitOnLastColon(
                normalizeText(textContent(detail)),
            );

            if (courseName === '') {
                continue;
            }

            const fields: Record<string, string> = {};
            const match = value.match(/^(.*?)\s*[(（](\d+)\s*學分[)）]\s*$/u);

            if (match !== null) {
                fields['學期成績'] = (match[1] ?? '').trim();
                fields['學分數'] = match[2] ?? '';
            } else {
                fields['學期成績'] = value;
            }

            grades.push({
                courseName,
                normalizedCourseName: normalizeCourseName(courseName),
                semesterLabel,
                termCode,
                fields,
            });
        }
    }

    return grades;
}

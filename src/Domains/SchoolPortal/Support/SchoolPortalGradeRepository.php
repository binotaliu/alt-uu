<?php

declare(strict_types=1);

namespace AltUU\Domains\SchoolPortal\Support;

use AltUU\Domains\Course\Support\CourseNameMatcher;
use AltUU\Domains\SchoolPortal\ViewModels\SchoolPortalGradeViewModel;
use App\Services\SchoolPortalClient;
use Illuminate\Support\Facades\Cache;
use Symfony\Component\DomCrawler\Crawler;

/**
 * Fetches and parses the school portal's grade pages (qryscore for the
 * current semester, qryscore2 for historical semesters). Shared by
 * GetCourseSemesterGrade (matches a single enrolled course) and
 * GetAllCourseGrades (returns everything the portal has, unmatched).
 */
final readonly class SchoolPortalGradeRepository
{
    use ParsesSchoolPortalHtml;

    private const CACHE_KEY_PREFIX = 'alt-uu:school-portal:semester-grades:';

    private const HISTORICAL_CACHE_KEY_PREFIX = 'alt-uu:school-portal:historical-grades:';

    private const ANONYMOUS_CACHE_SEGMENT = 'anonymous';

    private const CACHE_TTL_MINUTES = 10;

    /**
     * Past semesters' grades don't change once posted, unlike the current
     * semester's page which updates throughout the term, so this can be
     * cached far longer.
     */
    private const HISTORICAL_CACHE_TTL_MINUTES = 60;

    public function __construct(private SchoolPortalClient $schoolPortalClient) {}

    /**
     * @return array<int, array{courseName: string, normalizedCourseName: string, semesterLabel: string, termCode: ?string, fields: array<string, string>}>
     */
    public function currentSemesterGrades(): array
    {
        return Cache::remember(
            $this->cacheKey(self::CACHE_KEY_PREFIX),
            now()->addMinutes(self::CACHE_TTL_MINUTES),
            function (): array {
                $page = $this->schoolPortalClient->fetchCurrentSemesterGradesPage();
                $status = (int) ($page['status'] ?? 500);

                if ($status >= 400) {
                    return [];
                }

                return $this->parseGrades($this->ensureUtf8((string) ($page['body'] ?? '')));
            },
        );
    }

    /**
     * @return array<int, array{courseName: string, normalizedCourseName: string, semesterLabel: string, termCode: ?string, fields: array<string, string>}>
     */
    public function historicalGrades(): array
    {
        return Cache::remember(
            $this->cacheKey(self::HISTORICAL_CACHE_KEY_PREFIX),
            now()->addMinutes(self::HISTORICAL_CACHE_TTL_MINUTES),
            function (): array {
                $page = $this->schoolPortalClient->fetchHistoricalGradesPage();
                $status = (int) ($page['status'] ?? 500);

                if ($status >= 400) {
                    return [];
                }

                return $this->parseHistoricalGrades($this->ensureUtf8((string) ($page['body'] ?? '')));
            },
        );
    }

    /**
     * @param  array{courseName: string, normalizedCourseName: string, semesterLabel: string, termCode: ?string, fields: array<string, string>}  $grade
     */
    public static function toViewModel(array $grade): SchoolPortalGradeViewModel
    {
        return new SchoolPortalGradeViewModel(
            courseName: $grade['courseName'],
            semesterLabel: $grade['semesterLabel'],
            credits: $grade['fields']['學分數'] ?? null,
            firstRegularScore: $grade['fields']['第一次平時成績'] ?? null,
            secondRegularScore: $grade['fields']['第二次平時成績'] ?? null,
            participationScore: $grade['fields']['學習參與成績'] ?? null,
            regularAverage: $grade['fields']['平時成績平均'] ?? null,
            midtermScore: $grade['fields']['期中成績'] ?? null,
            finalScore: $grade['fields']['期末成績'] ?? null,
            semesterGrade: $grade['fields']['學期成績'] ?? null,
        );
    }

    /**
     * The historical grades page (qryscore2) groups courses under a single
     * accordion per semester, titled e.g. "114下學期：總計修讀 13 學分" (note:
     * no "學年" prefix, unlike the current-semester page), with each course
     * line reading "課程名稱：分數 (X學分)" — no per-component breakdown.
     *
     * @return array<int, array{courseName: string, normalizedCourseName: string, semesterLabel: string, termCode: ?string, fields: array<string, string>}>
     */
    private function parseHistoricalGrades(string $html): array
    {
        if ($html === '') {
            return [];
        }

        $crawler = new Crawler($this->stripXmlProlog($html));
        $grades = [];

        $crawler->filterXPath(
            '//*[contains(concat(" ", normalize-space(@class), " "), " accordion-item ")]'
        )->each(function (Crawler $node) use (&$grades): void {
            $titleNode = $node->filterXPath('.//button[contains(concat(" ", normalize-space(@class), " "), " accordion-button ")]')->first();
            $title = $titleNode->count() > 0 ? $this->normalizeText((string) $titleNode->text()) : '';

            if ($title === '') {
                return;
            }

            [$semesterLabel] = $this->splitDetail($title);

            if ($semesterLabel === '') {
                return;
            }

            $termCode = CourseNameMatcher::normalizeTermCode($semesterLabel);

            $node->filterXPath('.//div[contains(concat(" ", normalize-space(@class), " "), " detail ")]')->each(
                function (Crawler $detail) use ($semesterLabel, $termCode, &$grades): void {
                    $grade = $this->parseHistoricalGradeItem($detail, $semesterLabel, $termCode);

                    if ($grade !== null) {
                        $grades[] = $grade;
                    }
                }
            );
        });

        return $grades;
    }

    /**
     * @return array{courseName: string, normalizedCourseName: string, semesterLabel: string, termCode: ?string, fields: array<string, string>}|null
     */
    private function parseHistoricalGradeItem(Crawler $detail, string $semesterLabel, ?string $termCode): ?array
    {
        // Unlike splitDetail's label:value pairs (where the label never
        // contains a colon), a course name here can itself contain "："
        // (e.g. "安定與苦悶：冷戰時期的台灣（1949～1971）"), so the boundary
        // must be the *last* colon — the score that follows it never
        // contains one.
        [$courseName, $value] = $this->splitOnLastColon($this->normalizeText((string) $detail->text()));

        if ($courseName === '') {
            return null;
        }

        $fields = [];

        if (preg_match('/^(?<score>.*?)\s*[\(（](?<credits>\d+)\s*學分[\)）]\s*$/u', $value, $matches) === 1) {
            $fields['學期成績'] = trim($matches['score']);
            $fields['學分數'] = $matches['credits'];
        } else {
            $fields['學期成績'] = $value;
        }

        return [
            'courseName' => $courseName,
            'normalizedCourseName' => CourseNameMatcher::normalizeName($courseName),
            'semesterLabel' => $semesterLabel,
            'termCode' => $termCode,
            'fields' => $fields,
        ];
    }

    /**
     * @return array<int, array{courseName: string, normalizedCourseName: string, semesterLabel: string, termCode: ?string, fields: array<string, string>}>
     */
    private function parseGrades(string $html): array
    {
        if ($html === '') {
            return [];
        }

        $crawler = new Crawler($this->stripXmlProlog($html));
        $grades = [];
        $currentSemesterLabel = '';
        $currentTermCode = null;

        $crawler->filterXPath(
            '//*[contains(concat(" ", normalize-space(@class), " "), " year-box ")'
            .' or contains(concat(" ", normalize-space(@class), " "), " accordion-item ")]'
        )->each(function (Crawler $node) use (&$currentSemesterLabel, &$currentTermCode, &$grades): void {
            $class = (string) ($node->attr('class') ?? '');

            if (str_contains($class, 'year-box')) {
                $yearNode = $node->filterXPath('.//div[contains(concat(" ", normalize-space(@class), " "), " year ")]')->first();
                $currentSemesterLabel = $yearNode->count() > 0 ? $this->normalizeText((string) $yearNode->text()) : '';
                $currentTermCode = CourseNameMatcher::normalizeTermCode($currentSemesterLabel);

                return;
            }

            $grade = $this->parseGradeItem($node, $currentSemesterLabel, $currentTermCode);

            if ($grade !== null) {
                $grades[] = $grade;
            }
        });

        return $grades;
    }

    /**
     * @return array{courseName: string, normalizedCourseName: string, semesterLabel: string, termCode: ?string, fields: array<string, string>}|null
     */
    private function parseGradeItem(Crawler $item, string $semesterLabel, ?string $termCode): ?array
    {
        $titleNode = $item->filterXPath('.//button[contains(concat(" ", normalize-space(@class), " "), " accordion-button ")]')->first();
        $courseName = $titleNode->count() > 0 ? $this->normalizeText((string) $titleNode->text()) : '';

        if ($courseName === '') {
            return null;
        }

        $fields = [];

        $item->filterXPath('.//div[contains(concat(" ", normalize-space(@class), " "), " detail ")]')->each(
            function (Crawler $detail) use (&$fields): void {
                [$label, $value] = $this->splitDetail((string) $detail->text());

                if ($label !== '') {
                    $fields[$label] = $value;
                }
            }
        );

        return [
            'courseName' => $courseName,
            'normalizedCourseName' => CourseNameMatcher::normalizeName($courseName),
            'semesterLabel' => $semesterLabel,
            'termCode' => $termCode,
            'fields' => $fields,
        ];
    }

    /**
     * @return array{0: string, 1: string}
     */
    private function splitOnLastColon(string $text): array
    {
        $colonPos = mb_strrpos($text, '：');

        if ($colonPos === false) {
            $colonPos = mb_strrpos($text, ':');
        }

        if ($colonPos === false) {
            return ['', $text];
        }

        $label = trim(mb_substr($text, 0, $colonPos));
        $value = trim(mb_substr($text, $colonPos + 1));

        return [$label, $value];
    }

    private function cacheKey(string $prefix): string
    {
        $username = $this->schoolPortalClient->currentProfileUsername();

        return $prefix.($username !== '' ? $username : self::ANONYMOUS_CACHE_SEGMENT);
    }
}

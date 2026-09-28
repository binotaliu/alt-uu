<?php

declare(strict_types=1);

namespace AltUU\Domains\SchoolPortal\Support;

use AltUU\Domains\Course\Support\CourseNameMatcher;
use App\Services\SchoolPortalClient;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Symfony\Component\DomCrawler\Crawler;

/**
 * Fetches and parses the school portal's exam info page (qryexm), which
 * only ever covers the current semester. Shared by GetCourseExamInfo
 * (matches a single enrolled course) and GetExamAgenda (returns everything
 * the portal has, unmatched).
 */
final readonly class SchoolPortalExamInfoRepository
{
    use ParsesSchoolPortalHtml;

    private const CACHE_KEY_PREFIX = 'alt-uu:school-portal:exam-info:';

    private const ANONYMOUS_CACHE_SEGMENT = 'anonymous';

    private const CACHE_TTL_MINUTES = 10;

    /**
     * Container id for the "考試時間" (exam schedule) section — course
     * detail rows split into date/time/room fields.
     */
    private const SCHEDULE_CONTAINER_ID = 'accordion-courses-exmtime';

    /**
     * Container id for the "考試命題範圍" (exam scope) section — course
     * detail rows are free-form text.
     */
    private const SCOPE_CONTAINER_ID = 'accordion-courses-range';

    public function __construct(private SchoolPortalClient $schoolPortalClient) {}

    /**
     * @return array{
     *     termCode: ?string,
     *     semesterLabel: string,
     *     courses: array<string, array{
     *         courseName: string,
     *         schedules: array<int, array{category: string, date: ?string, time: ?string, room: ?string, note: ?string}>,
     *         scopes: array<int, array{category: string, scope: ?string}>,
     *     }>,
     * }
     */
    public function currentSemesterExamInfo(Request $request): array
    {
        return Cache::remember(
            $this->cacheKey($request),
            now()->addMinutes(self::CACHE_TTL_MINUTES),
            function (): array {
                $page = $this->schoolPortalClient->fetchExamInfoPage();
                $status = (int) ($page['status'] ?? 500);

                if ($status >= 400) {
                    return ['termCode' => null, 'semesterLabel' => '', 'courses' => []];
                }

                return $this->parseExamInfo($this->ensureUtf8((string) ($page['body'] ?? '')));
            },
        );
    }

    /**
     * @return array{
     *     termCode: ?string,
     *     semesterLabel: string,
     *     courses: array<string, array{
     *         courseName: string,
     *         schedules: array<int, array{category: string, date: ?string, time: ?string, room: ?string, note: ?string}>,
     *         scopes: array<int, array{category: string, scope: ?string}>,
     *     }>,
     * }
     */
    private function parseExamInfo(string $html): array
    {
        $empty = ['termCode' => null, 'semesterLabel' => '', 'courses' => []];

        if ($html === '') {
            return $empty;
        }

        $crawler = new Crawler($this->stripXmlProlog($html));

        $yearNode = $crawler->filterXPath(
            '//div[contains(concat(" ", normalize-space(@class), " "), " year-box ")]'
            .'//div[contains(concat(" ", normalize-space(@class), " "), " year ")]'
        )->first();
        $semesterLabel = $yearNode->count() > 0 ? $this->normalizeText((string) $yearNode->text()) : '';
        $termCode = CourseNameMatcher::normalizeTermCode($semesterLabel);

        $courses = [];

        $this->eachLeafCategory($crawler, self::SCHEDULE_CONTAINER_ID, function (string $category, Crawler $body) use (&$courses): void {
            $this->collectScheduleEntries($body, $category, $courses);
        });

        $this->eachLeafCategory($crawler, self::SCOPE_CONTAINER_ID, function (string $category, Crawler $body) use (&$courses): void {
            $this->collectScopeEntries($body, $category, $courses);
        });

        return ['termCode' => $termCode, 'semesterLabel' => $semesterLabel, 'courses' => $courses];
    }

    /**
     * Walks the "leaf" accordion categories (e.g. "期中考(正考)") under a
     * top-level container (identified by its unique id), skipping the
     * outer wrapper items which just nest another accordion rather than
     * course title/detail rows directly.
     *
     * @param  callable(string, Crawler): void  $callback
     */
    private function eachLeafCategory(Crawler $crawler, string $containerId, callable $callback): void
    {
        $container = $crawler->filterXPath(sprintf('//div[@id="%s"]', $containerId))->first();

        if ($container->count() === 0) {
            return;
        }

        $container->filterXPath(
            './/div[contains(concat(" ", normalize-space(@class), " "), " accordion-item ")'
            .' and not(.//div[contains(concat(" ", normalize-space(@class), " "), " accordion ")])]'
        )->each(function (Crawler $leaf) use ($callback): void {
            $titleNode = $leaf->filterXPath('.//button[contains(concat(" ", normalize-space(@class), " "), " accordion-button ")]')->first();
            $category = $titleNode->count() > 0 ? $this->normalizeText((string) $titleNode->text()) : '';

            $bodyNode = $leaf->filterXPath('.//div[contains(concat(" ", normalize-space(@class), " "), " accordion-body ")]')->first();

            if ($category === '' || $bodyNode->count() === 0) {
                return;
            }

            $callback($category, $bodyNode);
        });
    }

    /**
     * @param  array<string, array{courseName: string, schedules: array<int, array{category: string, date: ?string, time: ?string, room: ?string, note: ?string}>, scopes: array<int, array{category: string, scope: ?string}>}>  $courses
     */
    private function collectScheduleEntries(Crawler $body, string $category, array &$courses): void
    {
        $currentCourseName = null;
        $currentEntry = null;

        $flush = function () use (&$currentCourseName, &$currentEntry, &$courses): void {
            if ($currentCourseName === null || $currentEntry === null) {
                return;
            }

            $normalizedName = CourseNameMatcher::normalizeName($currentCourseName);

            if ($normalizedName === '') {
                return;
            }

            $courses[$normalizedName] ??= ['courseName' => $currentCourseName, 'schedules' => [], 'scopes' => []];
            $courses[$normalizedName]['schedules'][] = $currentEntry;
        };

        $body->children()->each(function (Crawler $child) use (&$currentCourseName, &$currentEntry, $category, $flush): void {
            $class = ' '.preg_replace('/\s+/', ' ', (string) ($child->attr('class') ?? '')).' ';

            if (str_contains($class, ' title ')) {
                $flush();
                $currentCourseName = $this->stripCourseTitleMarker($this->normalizeText((string) $child->text()));
                $currentEntry = ['category' => $category, 'date' => null, 'time' => null, 'room' => null, 'note' => null];

                return;
            }

            if ($currentEntry === null || ! str_contains($class, ' detail ')) {
                return;
            }

            [$label, $value] = $this->splitDetail((string) $child->text());

            match ($label) {
                '日期' => $currentEntry['date'] = $value,
                '時間' => $currentEntry['time'] = $value,
                '教室代號' => $currentEntry['room'] = $value,
                default => $currentEntry['note'] = $label !== '' ? $label.'：'.$value : $value,
            };
        });

        $flush();
    }

    /**
     * @param  array<string, array{courseName: string, schedules: array<int, array{category: string, date: ?string, time: ?string, room: ?string, note: ?string}>, scopes: array<int, array{category: string, scope: ?string}>}>  $courses
     */
    private function collectScopeEntries(Crawler $body, string $category, array &$courses): void
    {
        $currentCourseName = null;
        $currentScope = null;

        $flush = function () use (&$currentCourseName, &$currentScope, $category, &$courses): void {
            if ($currentCourseName === null) {
                return;
            }

            $normalizedName = CourseNameMatcher::normalizeName($currentCourseName);

            if ($normalizedName === '') {
                return;
            }

            $courses[$normalizedName] ??= ['courseName' => $currentCourseName, 'schedules' => [], 'scopes' => []];
            $courses[$normalizedName]['scopes'][] = ['category' => $category, 'scope' => $currentScope];
        };

        $body->children()->each(function (Crawler $child) use (&$currentCourseName, &$currentScope, $flush): void {
            $class = ' '.preg_replace('/\s+/', ' ', (string) ($child->attr('class') ?? '')).' ';

            if (str_contains($class, ' title ')) {
                $flush();
                $currentCourseName = $this->stripCourseTitleMarker($this->normalizeText((string) $child->text()));
                $currentScope = null;

                return;
            }

            if ($currentCourseName === null || ! str_contains($class, ' detail ')) {
                return;
            }

            $text = $this->normalizeText((string) $child->text());
            $currentScope = $currentScope === null ? $text : $currentScope.' '.$text;
        });

        $flush();
    }

    /**
     * Course titles under "考試資訊" are prefixed with a "◉ " bullet marker.
     */
    private function stripCourseTitleMarker(string $title): string
    {
        return trim(preg_replace('/^◉\s*/u', '', $title) ?? $title);
    }

    private function cacheKey(Request $request): string
    {
        $username = '';

        if ($request->hasSession()) {
            $username = trim((string) $request->session()->get('hungu.profile.username', ''));
        }

        return self::CACHE_KEY_PREFIX.($username !== '' ? $username : self::ANONYMOUS_CACHE_SEGMENT);
    }
}

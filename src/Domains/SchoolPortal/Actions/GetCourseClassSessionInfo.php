<?php

declare(strict_types=1);

namespace AltUU\Domains\SchoolPortal\Actions;

use AltUU\Domains\Course\Support\CourseNameMatcher;
use AltUU\Domains\Course\ViewModels\CourseItemViewModel;
use AltUU\Domains\SchoolPortal\Support\ParsesSchoolPortalHtml;
use AltUU\Domains\SchoolPortal\ViewModels\SchoolPortalClassSessionInfoViewModel;
use App\Services\SchoolPortalClient;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Symfony\Component\DomCrawler\Crawler;

final readonly class GetCourseClassSessionInfo
{
    use ParsesSchoolPortalHtml;

    private const CACHE_KEY_PREFIX = 'alt-uu:school-portal:class-session-info:';

    private const ANONYMOUS_CACHE_SEGMENT = 'anonymous';

    private const CACHE_TTL_MINUTES = 10;

    public function __construct(private SchoolPortalClient $schoolPortalClient) {}

    public function __invoke(Request $request, CourseItemViewModel $course): ?SchoolPortalClassSessionInfoViewModel
    {
        $targetName = CourseNameMatcher::normalizeName($course->name);
        $targetTerm = CourseNameMatcher::normalizeTermCode($course->semester);

        if ($targetName === '' || $targetTerm === null) {
            return null;
        }

        foreach ($this->allClassSessions($request) as $item) {
            if ($item['termCode'] === $targetTerm && $item['normalizedCourseName'] === $targetName) {
                return new SchoolPortalClassSessionInfoViewModel(
                    courseName: $item['courseName'],
                    semesterLabel: $item['semesterLabel'],
                    classDates: $item['fields']['授課日期'] ?? null,
                    classType: $item['fields']['班級類型'] ?? null,
                    classCode: $item['fields']['授課班級代碼'] ?? null,
                    teacher: $item['fields']['授課教師'] ?? null,
                    classTime: $item['fields']['上課時間'] ?? null,
                );
            }
        }

        return null;
    }

    /**
     * @return array<int, array{courseName: string, normalizedCourseName: string, semesterLabel: string, termCode: ?string, fields: array<string, string>}>
     */
    private function allClassSessions(Request $request): array
    {
        return Cache::remember(
            $this->cacheKey($request),
            now()->addMinutes(self::CACHE_TTL_MINUTES),
            function (): array {
                $page = $this->schoolPortalClient->fetchClassSessionInfoPage();
                $status = (int) ($page['status'] ?? 500);

                if ($status >= 400) {
                    return [];
                }

                return $this->parseClassSessions($this->ensureUtf8((string) ($page['body'] ?? '')));
            },
        );
    }

    /**
     * @return array<int, array{courseName: string, normalizedCourseName: string, semesterLabel: string, termCode: ?string, fields: array<string, string>}>
     */
    private function parseClassSessions(string $html): array
    {
        if ($html === '') {
            return [];
        }

        $crawler = new Crawler($this->stripXmlProlog($html));
        $items = [];
        $currentSemesterLabel = '';
        $currentTermCode = null;

        $crawler->filterXPath(
            '//*[contains(concat(" ", normalize-space(@class), " "), " year-box ")'
            .' or contains(concat(" ", normalize-space(@class), " "), " accordion-item ")]'
        )->each(function (Crawler $node) use (&$currentSemesterLabel, &$currentTermCode, &$items): void {
            $class = (string) ($node->attr('class') ?? '');

            if (str_contains($class, 'year-box')) {
                $yearNode = $node->filterXPath('.//div[contains(concat(" ", normalize-space(@class), " "), " year ")]')->first();
                $currentSemesterLabel = $yearNode->count() > 0 ? $this->normalizeText((string) $yearNode->text()) : '';
                $currentTermCode = CourseNameMatcher::normalizeTermCode($currentSemesterLabel);

                return;
            }

            $item = $this->parseClassSessionItem($node, $currentSemesterLabel, $currentTermCode);

            if ($item !== null) {
                $items[] = $item;
            }
        });

        return $items;
    }

    /**
     * @return array{courseName: string, normalizedCourseName: string, semesterLabel: string, termCode: ?string, fields: array<string, string>}|null
     */
    private function parseClassSessionItem(Crawler $item, string $semesterLabel, ?string $termCode): ?array
    {
        $titleNode = $item->filterXPath('.//button[contains(concat(" ", normalize-space(@class), " "), " accordion-button ")]')->first();
        $rawTitle = $titleNode->count() > 0 ? $this->normalizeText((string) $titleNode->text()) : '';
        $courseName = $this->stripTrailingSessionTypeSuffix($rawTitle);

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
     * The portal appends the class's session type in parentheses to the
     * course title on this page (e.g. "課程名稱(網路面授)"), which isn't part
     * of the course's actual name in Hongu (and is also already surfaced
     * separately via the "班級類型" detail field), so it has to be stripped
     * before name-matching against Hongu's course list.
     */
    private function stripTrailingSessionTypeSuffix(string $title): string
    {
        $stripped = preg_replace('/[（(][^（）()]*[）)]\s*$/u', '', $title) ?? $title;

        return trim($stripped);
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

<?php

declare(strict_types=1);

namespace AltUU\Domains\SchoolPortal\Actions;

use AltUU\Domains\Course\Support\CourseNameMatcher;
use AltUU\Domains\Course\ViewModels\CourseItemViewModel;
use AltUU\Domains\SchoolPortal\ViewModels\SchoolPortalHomeworkNoticeViewModel;
use App\Services\SchoolPortalClient;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Spatie\LaravelData\DataCollection;
use Symfony\Component\DomCrawler\Crawler;

final readonly class GetSchoolPortalHomeworkNotices
{
    private const CACHE_KEY_PREFIX = 'alt-uu:school-portal:homework-notices:';

    private const ANONYMOUS_CACHE_SEGMENT = 'anonymous';

    private const CACHE_TTL_MINUTES = 10;

    public function __construct(private SchoolPortalClient $schoolPortalClient) {}

    /**
     * @return DataCollection<SchoolPortalHomeworkNoticeViewModel>
     */
    public function __invoke(Request $request, CourseItemViewModel $course): DataCollection
    {
        $targetName = CourseNameMatcher::normalizeName($course->name);
        $targetTerm = CourseNameMatcher::normalizeTermCode($course->semester);

        if ($targetName === '' || $targetTerm === null) {
            return new DataCollection(SchoolPortalHomeworkNoticeViewModel::class, []);
        }

        $notices = $this->allNotices($request);

        $items = [];
        foreach ($notices as $notice) {
            if ($notice['termCode'] !== $targetTerm || $notice['normalizedCourseName'] !== $targetName) {
                continue;
            }

            $items[] = new SchoolPortalHomeworkNoticeViewModel(
                title: $notice['title'],
                dueDate: $notice['dueDate'],
                submissionMethod: $notice['submissionMethod'],
                downloadUrl: $notice['downloadUrl'],
            );
        }

        return new DataCollection(SchoolPortalHomeworkNoticeViewModel::class, $items);
    }

    /**
     * @return array<int, array{title: string, normalizedCourseName: string, termCode: ?string, dueDate: ?string, submissionMethod: ?string, downloadUrl: ?string}>
     */
    private function allNotices(Request $request): array
    {
        return Cache::remember(
            $this->cacheKey($request),
            now()->addMinutes(self::CACHE_TTL_MINUTES),
            function (): array {
                $page = $this->schoolPortalClient->fetchHomeworkNoticesPage();
                $status = (int) ($page['status'] ?? 500);

                if ($status >= 400) {
                    return [];
                }

                return $this->parseNotices($this->ensureUtf8((string) ($page['body'] ?? '')));
            },
        );
    }

    /**
     * @return array<int, array{title: string, normalizedCourseName: string, termCode: ?string, dueDate: ?string, submissionMethod: ?string, downloadUrl: ?string}>
     */
    private function parseNotices(string $html): array
    {
        if ($html === '') {
            return [];
        }

        $crawler = new Crawler($this->stripXmlProlog($html));
        $notices = [];
        $currentTermCode = null;

        $crawler->filterXPath(
            '//*[contains(concat(" ", normalize-space(@class), " "), " year-box ")'
            .' or contains(concat(" ", normalize-space(@class), " "), " accordion-item ")]'
        )->each(function (Crawler $node) use (&$currentTermCode, &$notices): void {
            $class = (string) ($node->attr('class') ?? '');

            if (str_contains($class, 'year-box')) {
                $yearNode = $node->filterXPath('.//div[contains(concat(" ", normalize-space(@class), " "), " year ")]')->first();
                $currentTermCode = $yearNode->count() > 0
                    ? CourseNameMatcher::normalizeTermCode($this->normalizeText((string) $yearNode->text()))
                    : null;

                return;
            }

            foreach ($this->parseNoticeItem($node, $currentTermCode) as $notice) {
                $notices[] = $notice;
            }
        });

        return $notices;
    }

    /**
     * The portal groups notices by assignment number, so a single accordion
     * item lists every course that has that assignment: one `detail-title`
     * followed by that course's `detail` rows and `detail-url` link, repeated
     * per course. Each course block becomes its own notice.
     *
     * @return array<int, array{title: string, normalizedCourseName: string, termCode: ?string, dueDate: ?string, submissionMethod: ?string, downloadUrl: ?string}>
     */
    private function parseNoticeItem(Crawler $item, ?string $termCode): array
    {
        $titleNode = $item->filterXPath('.//button[contains(concat(" ", normalize-space(@class), " "), " accordion-button ")]')->first();
        $title = $titleNode->count() > 0 ? $this->normalizeText((string) $titleNode->text()) : '';

        if ($title === '') {
            return [];
        }

        $notices = [];
        $current = null;

        $item->filterXPath('.//div[contains(concat(" ", normalize-space(@class), " "), " accordion-body ")]/div')->each(
            function (Crawler $row) use ($title, $termCode, &$notices, &$current): void {
                $class = ' '.preg_replace('/\s+/', ' ', (string) ($row->attr('class') ?? '')).' ';

                if (str_contains($class, ' detail-title ')) {
                    if ($current !== null) {
                        $notices[] = $current;
                    }

                    $courseName = CourseNameMatcher::normalizeName($this->normalizeText((string) $row->text()));

                    $current = $courseName === '' ? null : [
                        'title' => $title,
                        'normalizedCourseName' => $courseName,
                        'termCode' => $termCode,
                        'dueDate' => null,
                        'submissionMethod' => null,
                        'downloadUrl' => null,
                    ];

                    return;
                }

                if ($current === null) {
                    return;
                }

                if (str_contains($class, ' detail-url ')) {
                    $current['downloadUrl'] = $this->extractDownloadUrl($row);

                    return;
                }

                if (str_contains($class, ' detail ')) {
                    [$label, $value] = $this->splitDetail((string) $row->text());

                    match ($label) {
                        '繳交日期' => $current['dueDate'] = $value !== '' ? '繳交日期：'.$value : null,
                        '繳交方式' => $current['submissionMethod'] = $value !== '' ? $value : null,
                        default => null,
                    };
                }
            }
        );

        if ($current !== null) {
            $notices[] = $current;
        }

        return $notices;
    }

    private function extractDownloadUrl(Crawler $urlRow): ?string
    {
        $linkNode = $urlRow->filterXPath('.//a')->first();

        if ($linkNode->count() === 0) {
            return null;
        }

        $href = (string) ($linkNode->attr('href') ?? '');

        if ($href === '') {
            return null;
        }

        $baseUrl = rtrim((string) config('school_portal.base_url'), '/');

        return str_starts_with($href, 'http') ? $href : $baseUrl.'/'.ltrim($href, '/');
    }

    /**
     * @return array{0: string, 1: string}
     */
    private function splitDetail(string $text): array
    {
        $text = $this->normalizeText($text);
        $colonPos = mb_strpos($text, '：');

        if ($colonPos === false) {
            $colonPos = mb_strpos($text, ':');
        }

        if ($colonPos === false) {
            return ['', $text];
        }

        $label = trim(mb_substr($text, 0, $colonPos));
        $value = trim(mb_substr($text, $colonPos + 1));

        return [$label, $value];
    }

    private function cacheKey(Request $request): string
    {
        $username = '';

        if ($request->hasSession()) {
            $username = trim((string) $request->session()->get('hungu.profile.username', ''));
        }

        return self::CACHE_KEY_PREFIX.($username !== '' ? $username : self::ANONYMOUS_CACHE_SEGMENT);
    }

    private function normalizeText(?string $value): string
    {
        $value = $this->ensureUtf8(trim((string) $value));
        $value = preg_replace('/[\s\x{00A0}\x{3000}]+/u', ' ', $value) ?? $value;

        return trim($value);
    }

    /**
     * The portal serves its pages with a leading XML declaration
     * (`<?xml version="1.0" ...?>`), which makes Symfony's Crawler parse
     * the document as namespaced XHTML instead of plain HTML5 — under
     * which unprefixed CSS/XPath selectors like `div`/`button` silently
     * match nothing. Stripping it forces HTML5 parsing.
     */
    private function stripXmlProlog(string $html): string
    {
        return preg_replace('/^\s*<\?xml[^>]*\?>/', '', $html) ?? $html;
    }

    private function ensureUtf8(string $value): string
    {
        if ($value === '' || mb_check_encoding($value, 'UTF-8')) {
            return $value;
        }

        $detected = mb_detect_encoding($value, ['UTF-8', 'BIG-5', 'CP950', 'Windows-1252', 'ISO-8859-1'], true);

        if ($detected !== false && $detected !== 'UTF-8') {
            $converted = @mb_convert_encoding($value, 'UTF-8', $detected);

            if (is_string($converted) && $converted !== '') {
                return $converted;
            }
        }

        foreach (['BIG-5', 'CP950', 'Windows-1252', 'ISO-8859-1'] as $encoding) {
            $converted = @mb_convert_encoding($value, 'UTF-8', $encoding);

            if (is_string($converted) && $converted !== '' && mb_check_encoding($converted, 'UTF-8')) {
                return $converted;
            }
        }

        $converted = @iconv('UTF-8', 'UTF-8//IGNORE', $value);

        return is_string($converted) && $converted !== ''
            ? $converted
            : mb_convert_encoding($value, 'UTF-8', 'UTF-8');
    }
}

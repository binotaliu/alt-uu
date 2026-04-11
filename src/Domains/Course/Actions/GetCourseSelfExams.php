<?php

declare(strict_types=1);

namespace AltUU\Domains\Course\Actions;

use AltUU\Domains\Course\ViewModels\CourseHomeworkItemViewModel;
use App\Services\UUCourseClient;
use Illuminate\Http\Request;
use Spatie\LaravelData\DataCollection;
use Symfony\Component\DomCrawler\Crawler;

final readonly class GetCourseSelfExams
{
    public function __construct(private UUCourseClient $courseClient) {}

    /**
     * @return DataCollection<CourseHomeworkItemViewModel>
     */
    public function __invoke(Request $request): DataCollection
    {
        $selfExamPage = $this->courseClient->fetchSelfExamPage();
        $status = (int) ($selfExamPage['status'] ?? 500);

        abort_if($status >= 400, 502, '讀取自我練習列表失敗。');

        $baseUrl = $this->resolveBaseUrl($request);
        $items = $this->parseSelfExamItems(
            (string) ($selfExamPage['body'] ?? ''),
            $baseUrl,
        );

        return new DataCollection(CourseHomeworkItemViewModel::class, $items);
    }

    /**
     * @return array<int, CourseHomeworkItemViewModel>
     */
    private function parseSelfExamItems(string $html, string $baseUrl): array
    {
        $html = $this->ensureUtf8($html);

        if ($html === '') {
            return [];
        }

        $crawler = new Crawler($html);
        $items = [];
        $resultUrlSuffix = $this->extractResultUrlSuffix($crawler);

        $crawler->filterXPath('//div[contains(concat(" ", normalize-space(@class), " "), " box2 ")]')->each(function (Crawler $box) use ($baseUrl, &$items, $resultUrlSuffix): void {
            $titleNode = $box->filterXPath('.//span[@title]')->first();
            $title = $titleNode->count() > 0
                ? $this->normalizeText((string) $titleNode->text())
                : '';

            if ($title === '') {
                return;
            }

            $actionNode = $box->filterXPath('.//div[contains(concat(" ", normalize-space(@class), " "), " process-btn ") and contains(concat(" ", normalize-space(@class), " "), " pay ")][1]')->first();
            $resultNode = $box->filterXPath('.//div[contains(concat(" ", normalize-space(@class), " "), " process-btn ") and contains(concat(" ", normalize-space(@class), " "), " score ")][1]')->first();

            $status = null;
            $window = null;
            $actionUrl = null;
            $resultUrl = null;

            if ($actionNode->count() > 0) {
                $statusNode = $actionNode->filterXPath('.//div[contains(@class, "main-text")][1]')->first();
                $windowNode = $actionNode->filterXPath('.//div[contains(@class, "sub-text")][1]')->first();
                $status = $statusNode->count() > 0 ? $this->normalizeText((string) $statusNode->text()) : null;
                $window = $windowNode->count() > 0 ? $this->normalizeText((string) $windowNode->text()) : null;
                $actionUrl = $this->extractActionUrl($actionNode, $baseUrl);
            }

            if ($resultNode->count() > 0) {
                $resultUrl = $this->extractResultUrl($resultNode, $baseUrl, $resultUrlSuffix);
            }

            $items[] = new CourseHomeworkItemViewModel(
                title: $title,
                percent: '',
                type: 'self-exam',
                status: $status === '' ? null : $status,
                window: $window === '' ? null : $window,
                actionUrl: $actionUrl,
                resultUrl: $resultUrl,
                source: 'self-exam',
            );
        });

        return $items;
    }

    private function extractActionUrl(Crawler $actionNode, string $baseUrl): ?string
    {
        $id = $this->extractOnclickArgument($actionNode, "/togo\\('([^']+)'/");

        if ($id === '') {
            return null;
        }

        return $baseUrl.'/learn/exam/exam_start.php?'.$id.'+0';
    }

    private function extractResultUrl(Crawler $resultNode, string $baseUrl, ?string $resultUrlSuffix): ?string
    {
        $resultId = $this->extractOnclickArgument($resultNode, "/viewResult\\('([^']+)'\\)/i");

        if ($resultId !== '') {
            return $baseUrl.'/learn/exam/view_result.php?'.$resultId;
        }

        $resultId = $this->extractOnclickArgument($resultNode, "/view_homework\\('[^']+'\\s*,\\s*'([^']+)'/");

        if ($resultId === '') {
            return null;
        }

        $suffix = $resultUrlSuffix !== null ? $resultUrlSuffix : 'personal';

        return $baseUrl.'/learn/exam/co_self_exam_exemplar.php?'.$resultId.'+'.$suffix;
    }

    private function extractOnclickArgument(Crawler $node, string $pattern): string
    {
        $onclick = (string) ($node->attr('onclick') ?? '');

        if ($onclick !== '' && preg_match($pattern, $onclick, $matches)) {
            return trim((string) ($matches[1] ?? ''));
        }

        $node->filterXPath('.//*[@onclick]')->each(function (Crawler $child) use ($pattern, &$matches): void {
            $childOnclick = (string) ($child->attr('onclick') ?? '');

            if ($childOnclick !== '' && preg_match($pattern, $childOnclick, $match)) {
                $matches = $match;
            }
        });

        if (isset($matches) && isset($matches[1])) {
            return trim((string) $matches[1]);
        }

        return '';
    }

    private function extractResultUrlSuffix(Crawler $crawler): ?string
    {
        $scripts = $crawler->filterXPath('//script');

        foreach ($scripts as $scriptNode) {
            $scriptCrawler = new Crawler($scriptNode);
            $content = (string) $scriptCrawler->text();

            if (! str_contains($content, 'function view_homework')) {
                continue;
            }

            if (preg_match("/window\\.open\\(.*?view_exemplar\.php.*?\\s*eid\\s*\\+\\s*'([^']*)'/s", $content, $matches)) {
                $suffix = trim((string) ($matches[1] ?? ''));

                if ($suffix !== '') {
                    return ltrim($suffix, '+');
                }
            }
        }

        return null;
    }

    private function resolveBaseUrl(Request $request): string
    {
        $session = $request->hunguSession();
        $baseUrl = (string) ($session['base_url'] ?? '');

        if ($baseUrl === '') {
            return 'https://uu.nou.edu.tw';
        }

        return rtrim($baseUrl, '/');
    }

    private function normalizeText(?string $value): string
    {
        $value = $this->ensureUtf8(trim((string) $value));
        $value = preg_replace('/[\s\x{00A0}\x{3000}]+/u', ' ', $value) ?? $value;

        return trim($value);
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

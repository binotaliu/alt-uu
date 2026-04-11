<?php

declare(strict_types=1);

namespace AltUU\Domains\Course\Actions;

use AltUU\Domains\Course\ViewModels\CourseTasksCountViewModel;
use App\Services\UUCourseClient;
use Spatie\LaravelData\DataCollection;
use Symfony\Component\DomCrawler\Crawler;

final readonly class GetCourseTasksCount
{
    public function __construct(private UUCourseClient $courseClient) {}

    /**
     * @return DataCollection<CourseTasksCountViewModel>
     */
    public function __invoke(): DataCollection
    {
        $retried = 0;

        do {
            $pendingHomeworks = $this->parsePendingHomeworks();
            $unreadArticles = $this->parseUnreadArticles();

            // 有時候會因為 Cookie 的狀態不穩定，第一次開 App 會顯示空的。
            // 因此如果兩者都沒有資料，就再重試一次。
            $shouldRetry = empty($pendingHomeworks)
                && empty($unreadArticles)
                && $retried < 1;
            $retried++;
        } while ($shouldRetry);

        // Merge counts by courseId
        $merged = [];

        foreach ($pendingHomeworks as $courseId => $count) {
            $merged[$courseId] = new CourseTasksCountViewModel(
                courseId: (string) $courseId,
                pendingHomeworks: $count,
                unreadArticles: $unreadArticles[$courseId] ?? 0,
            );
        }

        // Add courses that only have unread articles
        foreach ($unreadArticles as $courseId => $count) {
            if (! isset($merged[$courseId])) {
                $merged[$courseId] = new CourseTasksCountViewModel(
                    courseId: (string) $courseId,
                    pendingHomeworks: 0,
                    unreadArticles: $count,
                );
            }
        }

        return new DataCollection(CourseTasksCountViewModel::class, array_values($merged));
    }

    /**
     * @return array<string, int>
     */
    private function parsePendingHomeworks(): array
    {
        $page = $this->courseClient->fetchPendingHomeworkPage();
        $status = (int) ($page['status'] ?? 500);

        if ($status >= 400) {
            return [];
        }

        return $this->parseTaskTable((string) ($page['body'] ?? ''), 3); // Index 3 = "未繳作業" column
    }

    /**
     * @return array<string, int>
     */
    private function parseUnreadArticles(): array
    {
        $page = $this->courseClient->fetchUnreadArticlesPage();
        $status = (int) ($page['status'] ?? 500);

        if ($status >= 400) {
            return [];
        }

        return $this->parseTaskTable((string) ($page['body'] ?? ''), 2); // Index 2 = "未看文章" column
    }

    /**
     * Parse task table and extract course ID and count.
     *
     * @param  string  $html  HTML content to parse
     * @param  int  $countColumnIndex  TD index (0-based) for the count value
     * @return array<string, int> Map of courseId => count
     */
    private function parseTaskTable(string $html, int $countColumnIndex): array
    {
        $html = $this->ensureUtf8($html);

        if ($html === '') {
            return [];
        }

        $crawler = new Crawler($html);
        $results = [];

        // Find all table rows in data2 containers (after the header)
        $crawler->filter('div.data2 table.table.subject tr')->each(function (Crawler $tr) use ($countColumnIndex, &$results) {
            $tds = $tr->filter('td');

            if ($tds->count() < ($countColumnIndex + 1)) {
                return;
            }

            // First column is course ID
            $courseId = $this->normalizeText((string) $tds->eq(0)->text());

            if ($courseId === '') {
                return;
            }

            // Get count from specified column
            $countText = $this->normalizeText((string) $tds->eq($countColumnIndex)->text());
            $count = (int) $countText;

            $results[$courseId] = $count;
        });

        return $results;
    }

    private function ensureUtf8(string $html): string
    {
        if (mb_detect_encoding($html, 'UTF-8', true) === 'UTF-8') {
            return $html;
        }

        return mb_convert_encoding($html, 'UTF-8');
    }

    private function normalizeText(string $text): string
    {
        return trim(preg_replace('/\s+/', ' ', $text) ?? '');
    }
}

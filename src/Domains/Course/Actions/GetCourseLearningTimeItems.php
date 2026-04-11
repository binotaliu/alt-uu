<?php

declare(strict_types=1);

namespace AltUU\Domains\Course\Actions;

use AltUU\Domains\Course\ViewModels\CourseLearningTimeItemViewModel;
use App\Services\UUCourseClient;
use Illuminate\Http\Request;
use Spatie\LaravelData\DataCollection;
use Symfony\Component\DomCrawler\Crawler;

final readonly class GetCourseLearningTimeItems
{
    public function __construct(
        private GetCoursePathInfo $getCoursePathInfo,
        private UUCourseClient $courseClient,
    ) {}

    /**
     * @return DataCollection<CourseLearningTimeItemViewModel>
     */
    public function __invoke(Request $request, string $cid): DataCollection
    {
        $pathData = ($this->getCoursePathInfo)($request, $cid);
        $learningTimePage = $this->courseClient->fetchLearningTimePage($cid);
        $status = (int) ($learningTimePage['status'] ?? 500);

        abort_if($status >= 400, 502, '讀取學習時數失敗。');

        $durationsByText = $this->parseDurationsByText((string) ($learningTimePage['body'] ?? ''));
        $items = [];

        foreach ($pathData['materialNodes']->items() as $node) {
            $normalizedText = $this->normalizeText($node->text);

            $items[] = new CourseLearningTimeItemViewModel(
                identifier: $node->identifier,
                href: $node->href,
                text: $node->text,
                level: $node->level,
                itemDisabled: $node->itemDisabled,
                duration: $normalizedText === '' ? null : ($durationsByText[$normalizedText] ?? null),
            );
        }

        return new DataCollection(CourseLearningTimeItemViewModel::class, $items);
    }

    /**
     * @return array<string, string>
     */
    private function parseDurationsByText(string $html): array
    {
        $html = $this->ensureUtf8($html);

        if ($html === '') {
            return [];
        }

        $crawler = new Crawler($html);
        $results = [];

        $crawler->filter('table.subject tr')->each(function (Crawler $row) use (&$results) {
            $columns = $row->filter('td');

            if ($columns->count() < 2) {
                return;
            }

            $title = $this->normalizeText((string) $columns->eq(0)->text());
            $duration = $this->normalizeDuration((string) $columns->eq(1)->text());

            if ($title === '' || $duration === '') {
                return;
            }

            $results[$title] = $duration;
        });

        return $results;
    }

    private function normalizeText(?string $value): string
    {
        $value = $this->ensureUtf8(trim((string) $value));
        $value = preg_replace('/[\s\x{00A0}\x{3000}]+/u', ' ', $value) ?? $value;

        return trim($value);
    }

    private function normalizeDuration(?string $value): string
    {
        $value = preg_replace('/\s+/', '', $this->ensureUtf8((string) $value)) ?? '';
        $value = preg_match('/^\d{2}:\d{2}:\d{2}$/', $value) === 1 ? $value : '';

        // strip leading zeros
        if (str_starts_with($value, '00:')) {
            $value = substr($value, 3);
        } elseif (str_starts_with($value, '0')) {
            $value = substr($value, 1);
        }

        return $value;
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

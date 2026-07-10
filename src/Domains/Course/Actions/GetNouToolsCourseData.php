<?php

declare(strict_types=1);

namespace AltUU\Domains\Course\Actions;

use AltUU\Domains\Course\ViewModels\CourseItemViewModel;
use App\Services\NouToolsClient;
use Normalizer;
use Spatie\LaravelData\DataCollection;

final readonly class GetNouToolsCourseData
{
    public const UNDIVIDED_CLASS_CODE = '不分班';

    public function __construct(private NouToolsClient $nouToolsClient) {}

    /**
     * @param  DataCollection<CourseItemViewModel>  $userCourses
     * @return array<int, array<string, mixed>>
     */
    public function __invoke(DataCollection $userCourses): array
    {
        $coursesByTerm = $this->groupCoursesByTerm($userCourses);
        $termMaps = [];

        foreach ($coursesByTerm as $term => $courses) {
            $summaries = $this->nouToolsClient->listCourses($term);
            $termMaps[$term] = $this->buildSummaryMap($summaries);
        }

        $results = [];

        foreach ($userCourses->items() as $course) {
            $termCode = $this->toNouToolsTermCode($course->semester);
            $normalizedName = $this->normalizeCourseName($course->name);

            if ($termCode === null || $normalizedName === '' || ! isset($termMaps[$termCode][$normalizedName])) {
                $results[] = [
                    'courseId' => $course->courseId,
                    'name' => $course->name,
                    'semester' => $course->semester,
                    'className' => $course->className,
                    'nouToolsCourseId' => null,
                    'detail' => null,
                    'matchedClass' => null,
                ];

                continue;
            }

            $summary = $termMaps[$termCode][$normalizedName];
            $nouToolsCourseId = (int) ($summary['id'] ?? 0);
            $detail = $nouToolsCourseId > 0
                ? $this->nouToolsClient->getCourseDetail($nouToolsCourseId)
                : null;

            $matchedClass = $this->resolveMatchedClass($detail, $course->className);

            $results[] = [
                'courseId' => $course->courseId,
                'name' => $course->name,
                'semester' => $course->semester,
                'className' => $course->className,
                'nouToolsCourseId' => $nouToolsCourseId > 0 ? $nouToolsCourseId : null,
                'detail' => $detail,
                'matchedClass' => $matchedClass,
            ];
        }

        return $results;
    }

    /**
     * @param  DataCollection<CourseItemViewModel>  $userCourses
     * @return array<string, array<int, CourseItemViewModel>>
     */
    private function groupCoursesByTerm(DataCollection $userCourses): array
    {
        $grouped = [];

        foreach ($userCourses->items() as $course) {
            $termCode = $this->toNouToolsTermCode($course->semester);

            if ($termCode === null) {
                continue;
            }

            if (! isset($grouped[$termCode])) {
                $grouped[$termCode] = [];
            }

            $grouped[$termCode][] = $course;
        }

        return $grouped;
    }

    /**
     * @param  array<int, array<string, mixed>>  $summaries
     * @return array<string, array{id: int, name: string, term: string}>
     */
    private function buildSummaryMap(array $summaries): array
    {
        $map = [];

        foreach ($summaries as $summary) {
            $id = (int) ($summary['id'] ?? 0);
            $name = isset($summary['name']) && is_string($summary['name']) ? trim($summary['name']) : '';
            $term = isset($summary['term']) && is_string($summary['term']) ? trim($summary['term']) : '';
            $normalizedName = $this->normalizeCourseName($name);

            if ($id <= 0 || $normalizedName === '') {
                continue;
            }

            $map[$normalizedName] = [
                'id' => $id,
                'name' => $name,
                'term' => $term,
            ];
        }

        return $map;
    }

    /**
     * @param  array<string, mixed>|null  $detail
     * @return array<string, mixed>|null
     */
    private function resolveMatchedClass(?array $detail, ?string $className): ?array
    {
        if ($detail === null || ! isset($detail['classes']) || ! is_array($detail['classes'])) {
            return null;
        }

        $expectedCode = $this->resolveClassCode($className);
        $undividedClass = null;

        foreach ($detail['classes'] as $classItem) {
            if (! is_array($classItem)) {
                continue;
            }

            $classCode = isset($classItem['code']) && is_string($classItem['code'])
                ? strtoupper(trim($classItem['code']))
                : '';

            if ($expectedCode !== null && $classCode === $expectedCode) {
                return $classItem;
            }

            if ($classCode === self::UNDIVIDED_CLASS_CODE) {
                $undividedClass = $classItem;
            }
        }

        return $undividedClass;
    }

    private function resolveClassCode(?string $className): ?string
    {
        if (! is_string($className)) {
            return null;
        }

        $trimmed = trim($className);

        if ($trimmed === '') {
            return null;
        }

        $trimmed = preg_replace('/班$/u', '', $trimmed) ?? $trimmed;
        $trimmed = trim($trimmed);

        if ($trimmed === '') {
            return null;
        }

        return strtoupper($trimmed);
    }

    private function toNouToolsTermCode(?string $semester): ?string
    {
        if (! is_string($semester)) {
            return null;
        }

        $normalized = preg_replace('/\s+/u', '', trim($semester)) ?? '';

        if ($normalized === '') {
            return null;
        }

        if (preg_match('/^(?<year>\d{2,3})(?<season>上|下|暑)$/u', $normalized, $matches) !== 1) {
            return null;
        }

        $rocYear = (int) ($matches['year'] ?? 0);
        $season = (string) ($matches['season'] ?? '');

        if ($rocYear <= 0) {
            return null;
        }

        $year = $rocYear + 1911;
        $seasonCode = match ($season) {
            '上' => 'A',
            '下' => 'B',
            '暑' => 'C',
            default => null,
        };

        if ($seasonCode === null) {
            return null;
        }

        return sprintf('%d%s', $year, $seasonCode);
    }

    private function normalizeCourseName(string $name): string
    {
        $value = trim($name);

        if ($value === '') {
            return '';
        }

        if (class_exists(Normalizer::class)) {
            $normalized = Normalizer::normalize($value, Normalizer::FORM_KC);
            if (is_string($normalized) && $normalized !== '') {
                $value = $normalized;
            }
        }

        $value = mb_strtolower($value, 'UTF-8');
        $value = preg_replace('/[\p{Z}\p{P}\p{S}]+/u', '', $value) ?? $value;

        return trim($value);
    }
}

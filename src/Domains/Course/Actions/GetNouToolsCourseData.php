<?php

declare(strict_types=1);

namespace AltUU\Domains\Course\Actions;

use AltUU\Domains\Course\Support\CourseNameMatcher;
use AltUU\Domains\Course\ViewModels\CourseItemViewModel;
use App\Services\NouToolsClient;
use Spatie\LaravelData\DataCollection;

final readonly class GetNouToolsCourseData
{
    public const UNDIVIDED_CLASS_CODE = '不分班';

    /**
     * Class code indicating 統一面授: when a course has only this one class,
     * every student uses it for video sessions regardless of their own class.
     */
    public const UNIFIED_IN_PERSON_CLASS_CODE = 'ZZZ000';

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
            $termCode = CourseNameMatcher::normalizeTermCode($course->semester);
            $normalizedName = CourseNameMatcher::normalizeName($course->name);

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
            $termCode = CourseNameMatcher::normalizeTermCode($course->semester);

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
            $normalizedName = CourseNameMatcher::normalizeName($name);

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

        if (count($detail['classes']) === 1) {
            $onlyClass = $detail['classes'][array_key_first($detail['classes'])];

            if (is_array($onlyClass)) {
                $onlyClassCode = isset($onlyClass['code']) && is_string($onlyClass['code'])
                    ? strtoupper(trim($onlyClass['code']))
                    : '';

                if ($onlyClassCode === self::UNIFIED_IN_PERSON_CLASS_CODE) {
                    return $onlyClass;
                }
            }
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
}

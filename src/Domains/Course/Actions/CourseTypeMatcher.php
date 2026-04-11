<?php

declare(strict_types=1);

namespace AltUU\Domains\Course\Actions;

final readonly class CourseTypeMatcher
{
    private const TITLE_PATTERN = '/^\((?<semester>[^)]+)\)(?<name>.+?)(?:-(?<className>.+))?$/u';

    /**
     * @param  array<string, mixed>  $course
     * @param  array<string, array{courseType: string, commonCourseId: string|null}>  $courseTypesByTitleKey
     * @return array{courseType: string|null, commonCourseId: string|null}
     */
    public function __invoke(array $course, array $courseTypesByTitleKey): array
    {
        $titleKey = $this->resolveTitleKey($course);

        if ($titleKey !== null && isset($courseTypesByTitleKey[$titleKey])) {
            return [
                'courseType' => $courseTypesByTitleKey[$titleKey]['courseType'],
                'commonCourseId' => $courseTypesByTitleKey[$titleKey]['commonCourseId'],
            ];
        }

        $courseType = null;
        $commonCourseId = null;

        if (is_scalar($course['course_type'] ?? null)) {
            $value = trim((string) $course['course_type']);
            if ($value !== '') {
                $courseType = $value;
            }
        }

        return [
            'courseType' => $courseType,
            'commonCourseId' => $commonCourseId,
        ];
    }

    /**
     * @param  array<string, mixed>  $course
     */
    private function resolveTitleKey(array $course): ?string
    {
        $title = $course['title'] ?? null;

        if (! is_string($title) || $title === '') {
            return null;
        }

        if (preg_match(self::TITLE_PATTERN, $title, $matches) !== 1) {
            return null;
        }

        $semester = trim((string) ($matches['semester'] ?? ''));
        $name = trim((string) ($matches['name'] ?? ''));

        if ($name === '') {
            return null;
        }

        return ($semester !== '' ? $semester : '').'|'.$name;
    }
}

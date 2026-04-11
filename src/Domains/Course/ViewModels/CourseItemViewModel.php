<?php

declare(strict_types=1);

namespace AltUU\Domains\Course\ViewModels;

use Spatie\LaravelData\Resource;
use Spatie\TypeScriptTransformer\Attributes\TypeScript;

#[TypeScript]
final class CourseItemViewModel extends Resource
{
    public function __construct(
        public string $courseId = '',
        public ?string $commonCourseId = null,
        public ?string $semester = null,
        public string $name = '',
        public ?string $className = null,
        public ?string $courseType = null,
    ) {}

    /**
     * @param  array<string, mixed>  $payload
     */
    public static function fromPayload(array $payload): ?self
    {
        $courseId = is_scalar($payload['course_id'] ?? null)
            ? (string) $payload['course_id']
            : '';

        $name = is_string($payload['name'] ?? null)
            ? trim($payload['name'])
            : '';

        if ($name === '') {
            $name = self::fallbackName($courseId);
        }

        return new self(
            courseId: $courseId,
            commonCourseId: is_scalar($payload['common_course_id'] ?? null)
                ? (string) $payload['common_course_id']
                : null,
            semester: is_string($payload['semester'] ?? null)
                ? trim((string) $payload['semester']) ?: null
                : null,
            name: $name,
            className: is_string($payload['class_name'] ?? null)
                ? trim((string) $payload['class_name']) ?: null
                : null,
            courseType: is_string($payload['course_type'] ?? null)
                ? trim((string) $payload['course_type']) ?: null
                : null,
        );
    }

    public static function fallback(string $courseId): self
    {
        return new self(
            courseId: $courseId,
            name: self::fallbackName($courseId),
        );
    }

    private static function fallbackName(string $courseId): string
    {
        return $courseId !== '' ? "課程 {$courseId}" : '未命名課程';
    }
}

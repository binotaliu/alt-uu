<?php

declare(strict_types=1);

namespace AltUU\Domains\Course\ViewModels;

use Illuminate\Support\Arr;
use Spatie\LaravelData\Resource;
use Spatie\TypeScriptTransformer\Attributes\TypeScript;

#[TypeScript]
final class CoursePathInfoViewModel extends Resource
{
    public function __construct(
        public int $code = 0,
        public string $message = '',
        public string $courseId = '',
        public ?string $baseUrl = null,
        public int $progress = 0,
        public string $pathText = '',
    ) {}

    /**
     * @param  array<string, mixed>  $payload
     */
    public static function fromPayload(array $payload): self
    {
        return new self(
            code: (int) ($payload['code'] ?? 0),
            message: is_string($payload['message'] ?? null) ? $payload['message'] : '',
            courseId: (string) Arr::get($payload, 'data.course_id', ''),
            baseUrl: is_string(Arr::get($payload, 'data.base_url')) ? Arr::get($payload, 'data.base_url') : null,
            progress: (int) Arr::get($payload, 'data.progress', 0),
            pathText: (string) Arr::get($payload, 'data.path.text', ''),
        );
    }
}

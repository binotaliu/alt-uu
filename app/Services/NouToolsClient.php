<?php

declare(strict_types=1);

namespace App\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

final class NouToolsClient
{
    private const CACHE_TTL_DAYS = 14;

    /**
     * @return array<int, array<string, mixed>>
     */
    public function listCourses(string $term): array
    {
        $cacheKey = sprintf('nou-tools:courses:%s', $term);

        /** @var array<int, array<string, mixed>> $result */
        $result = Cache::remember($cacheKey, now()->addDays(self::CACHE_TTL_DAYS), function () use ($term): array {
            $response = $this->http()
                ->get($this->buildUrl('/api/v1/courses'), [
                    'term' => $term,
                ]);

            if (! $response->successful()) {
                return [];
            }

            $payload = $response->json();

            return is_array($payload) ? array_values(array_filter($payload, 'is_array')) : [];
        });

        return $result;
    }

    /**
     * @return array<string, mixed>|null
     */
    public function getCourseDetail(int $courseId): ?array
    {
        $cacheKey = sprintf('nou-tools:course-detail:%d', $courseId);

        /** @var array<string, mixed>|null $result */
        $result = Cache::remember($cacheKey, now()->addDays(self::CACHE_TTL_DAYS), function () use ($courseId): ?array {
            $response = $this->http()->get($this->buildUrl('/api/v1/courses/'.$courseId));

            if (! $response->successful()) {
                return null;
            }

            $payload = $response->json();

            return is_array($payload) ? $payload : null;
        });

        return $result;
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function getSchoolCalendar(): array
    {
        $cacheKey = 'nou-tools:school-calendar:current';

        /** @var array<int, array<string, mixed>> $result */
        $result = Cache::remember($cacheKey, now()->addDays(self::CACHE_TTL_DAYS), function (): array {
            $response = $this->http()->get($this->buildUrl('/api/v1/school-calendar'));

            if (! $response->successful()) {
                return [];
            }

            $payload = $response->json();

            return is_array($payload) ? array_values(array_filter($payload, 'is_array')) : [];
        });

        return $result;
    }

    private function buildUrl(string $path): string
    {
        return rtrim((string) config('services.nou_tools.base_url', 'https://nou-tools.binota.org'), '/').'/'.ltrim($path, '/');
    }

    private function http()
    {
        return Http::acceptJson()
            ->timeout((int) config('services.nou_tools.timeout', 10))
            ->retry(2, 200, function ($exception): bool {
                return $exception instanceof \Throwable;
            })
            ->withHeaders([
                'User-Agent' => sprintf('%s/%s', Str::slug((string) config('app.name', 'alt-uu')), (string) app()->version()),
            ]);
    }
}

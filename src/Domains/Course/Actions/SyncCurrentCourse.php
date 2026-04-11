<?php

declare(strict_types=1);

namespace AltUU\Domains\Course\Actions;

use App\Services\UUCourseClient;
use Illuminate\Http\Request;

class SyncCurrentCourse
{
    private const CURRENT_COURSE_SESSION_KEY = 'hungu.current_course_id';

    public function __construct(private UUCourseClient $courseClient) {}

    public function __invoke(Request $request, string $cid, bool $force = false): void
    {
        $currentCourseId = (string) $request->session()->get(self::CURRENT_COURSE_SESSION_KEY, '');

        if ($currentCourseId === $cid && ! $force) {
            return;
        }

        $this->courseClient->goCourse($cid);

        $pathTreeResponse = $this->courseClient->fetchCoursePathTree();
        $browserTabIdx = $this->extractBrowserTabIdx((string) ($pathTreeResponse['body'] ?? ''));

        if ($browserTabIdx !== null) {
            $this->courseClient->setCookie('browserTabIdx', $browserTabIdx);
        }

        $request->session()->put(self::CURRENT_COURSE_SESSION_KEY, $cid);
    }

    private function extractBrowserTabIdx(string $body): ?string
    {
        if (preg_match('/var\s+browserTabIdx\s*=\s*["\']([^"\']+)["\']\s*;/i', $body, $matches)) {
            return $matches[1] ?? null;
        }

        return null;
    }
}

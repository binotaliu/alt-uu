<?php

declare(strict_types=1);

namespace AltUU\Domains\Course\Actions;

use App\Services\UUCourseClient;
use Illuminate\Contracts\Session\Session;

class SyncCurrentCourse
{
    private const CURRENT_COURSE_SESSION_KEY_PREFIX = 'hungu.current_course_id.';

    public function __construct(private UUCourseClient $courseClient, private Session $session) {}

    public function __invoke(string $cid, bool $force = false): void
    {
        $sessionKey = self::CURRENT_COURSE_SESSION_KEY_PREFIX.($this->courseClient->currentAccountId() ?? 0);
        $currentCourseId = (string) $this->session->get($sessionKey, '');

        if ($currentCourseId === $cid && ! $force) {
            return;
        }

        $this->courseClient->goCourse($cid);

        $pathTreeResponse = $this->courseClient->fetchCoursePathTree();
        $browserTabIdx = $this->extractBrowserTabIdx((string) ($pathTreeResponse['body'] ?? ''));

        if ($browserTabIdx !== null) {
            $this->courseClient->setCookie('browserTabIdx', $browserTabIdx);
        }

        $this->session->put($sessionKey, $cid);
    }

    private function extractBrowserTabIdx(string $body): ?string
    {
        if (preg_match('/var\s+browserTabIdx\s*=\s*["\']([^"\']+)["\']\s*;/i', $body, $matches)) {
            return $matches[1] ?? null;
        }

        return null;
    }
}

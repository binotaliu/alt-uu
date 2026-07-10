<?php

declare(strict_types=1);

namespace App\Services;

use Symfony\Component\HttpFoundation\StreamedResponse;

final class UUCourseClient
{
    public function __construct(private readonly UUProxyClient $proxyClient) {}

    /**
     * @return array{payload: array<string, mixed>}
     */
    public function fetchCourseList(): array
    {
        return $this->proxyClient->request('my-course-list', 'GET', [
            'offset' => 0,
            'pagesize' => 100,
        ]);
    }

    /**
     * @return array{payload: array<string, mixed>}
     */
    public function fetchCoursePathInfo(string $cid): array
    {
        return $this->proxyClient->request('my-course-path-info', 'GET', [
            'cid' => $cid,
        ]);
    }

    /**
     * @return array{payload: array<string, mixed>}
     */
    public function fetchCourseNodeResources(string $cid, string $scoid): array
    {
        return $this->proxyClient->request('course-node-resources', 'GET', [
            'cid' => $cid,
            'scoid' => $scoid,
        ]);
    }

    /**
     * @return array{status: int, body: string, headers: array<string, mixed>}
     */
    public function fetchHomeworkPage(): array
    {
        return $this->proxyClient->fetchCourseHomeworkPage();
    }

    /**
     * @return array{status: int, body: string, headers: array<string, mixed>}
     */
    public function fetchSelfExamPage(): array
    {
        return $this->proxyClient->fetchCourseSelfExamPage();
    }

    /**
     * @return array{status: int, body: string, headers: array<string, mixed>}
     */
    public function fetchLearningTimePage(string $cid): array
    {
        return $this->proxyClient->fetchCourseLearningTimePage($cid);
    }

    /**
     * @return array{status: int, body: string, headers: array<string, mixed>}
     */
    public function fetchMaterialContent(string $url): array
    {
        return $this->proxyClient->fetchMaterialContent($url);
    }

    public function streamMaterialContent(string $url): StreamedResponse
    {
        return $this->proxyClient->streamMaterialContent($url);
    }

    /**
     * @return array{status: int, contentType: string, contentLength: ?string}
     */
    public function probeContentType(string $url): array
    {
        return $this->proxyClient->probeContentType($url);
    }

    /**
     * @return array{status: int, body: string, headers: array<string, mixed>}
     */
    public function fetchPendingHomeworkPage(): array
    {
        return $this->proxyClient->fetchPendingHomeworkPage();
    }

    /**
     * @return array{status: int, body: string, headers: array<string, mixed>}
     */
    public function fetchUnreadArticlesPage(): array
    {
        return $this->proxyClient->fetchUnreadArticlesPage();
    }

    /**
     * @return array{payload: array<string, mixed>}
     */
    public function goCourse(string $cid): array
    {
        return $this->proxyClient->request('go-course', 'GET', [
            'cid' => $cid,
        ]);
    }

    /**
     * @return array{status: int, body: string, headers: array<string, mixed>}
     */
    public function fetchCoursePathTree(): array
    {
        return $this->proxyClient->fetchCoursePathTree();
    }

    public function setCookie(string $name, string $value): void
    {
        $this->proxyClient->setCookie($name, $value);
    }
}

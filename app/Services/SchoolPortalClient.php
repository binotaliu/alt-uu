<?php

declare(strict_types=1);

namespace App\Services;

final class SchoolPortalClient
{
    public function __construct(private readonly SchoolPortalProxyClient $proxyClient) {}

    /**
     * @return array{status: int, body: string}
     */
    public function fetchHomeworkNoticesPage(): array
    {
        return $this->proxyClient->fetchHtmlPage('/device/compliant/qryass/index');
    }

    /**
     * @return array{status: int, body: string}
     */
    public function fetchCurrentSemesterGradesPage(): array
    {
        return $this->proxyClient->fetchHtmlPage('/device/compliant/qryscore/index');
    }

    /**
     * @return array{status: int, body: string}
     */
    public function fetchHistoricalGradesPage(): array
    {
        return $this->proxyClient->fetchHtmlPage('/device/compliant/qryscore2/index');
    }

    /**
     * @return array{status: int, body: string}
     */
    public function fetchClassSessionInfoPage(): array
    {
        return $this->proxyClient->fetchHtmlPage('/device/compliant/qryper/index');
    }

    /**
     * @return array{status: int, body: string}
     */
    public function fetchExamInfoPage(): array
    {
        return $this->proxyClient->fetchHtmlPage('/device/compliant/qryexm/index');
    }
}

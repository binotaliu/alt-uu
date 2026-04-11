<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use AltUU\Domains\AppPreference\Actions\GetNouToolsIntegrationEnabled;
use App\Services\NouToolsClient;

final class NouToolsSchoolCalendarController
{
    /**
     * @return array<int, array<string, mixed>>
     */
    public function __invoke(
        GetNouToolsIntegrationEnabled $getEnabled,
        NouToolsClient $nouToolsClient,
    ): array {
        if (! $getEnabled()) {
            return [];
        }

        return $nouToolsClient->getSchoolCalendar();
    }
}

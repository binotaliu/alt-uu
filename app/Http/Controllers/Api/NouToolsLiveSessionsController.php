<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use AltUU\Domains\AppPreference\Actions\GetNouToolsIntegrationEnabled;
use AltUU\Domains\Course\Actions\GetNouToolsCourseData;
use AltUU\Domains\Course\Actions\ListCourses;
use Illuminate\Http\Request;

final class NouToolsLiveSessionsController
{
    /**
     * @return array<int, array<string, mixed>>
     */
    public function __invoke(
        Request $request,
        GetNouToolsIntegrationEnabled $getEnabled,
        ListCourses $listCourses,
        GetNouToolsCourseData $getNouToolsCourseData,
    ): array {
        if (! $getEnabled()) {
            return [];
        }

        $courseData = $getNouToolsCourseData($listCourses($request));
        $sessions = [];

        foreach ($courseData as $item) {
            $matchedClass = $item['matchedClass'] ?? null;

            if (! is_array($matchedClass)) {
                continue;
            }

            $rawSessions = $matchedClass['sessions'] ?? [];

            if (! is_array($rawSessions)) {
                continue;
            }

            $sessions[] = [
                'courseId' => $item['courseId'],
                'courseName' => $item['name'],
                'semester' => $item['semester'],
                'className' => $item['className'],
                'classCode' => $matchedClass['code'] ?? null,
                'type' => $matchedClass['type'] ?? null,
                'typeLabel' => $matchedClass['typeLabel'] ?? null,
                'teacherName' => $matchedClass['teacherName'] ?? null,
                'link' => $matchedClass['link'] ?? null,
                'startTime' => $matchedClass['startTime'] ?? null,
                'endTime' => $matchedClass['endTime'] ?? null,
                'sessions' => array_values(array_filter($rawSessions, 'is_array')),
            ];
        }

        return $sessions;
    }
}

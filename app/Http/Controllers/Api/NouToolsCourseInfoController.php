<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use AltUU\Domains\AppPreference\Actions\GetNouToolsIntegrationEnabled;
use AltUU\Domains\Course\Actions\GetNouToolsCourseData;
use AltUU\Domains\Course\Actions\ListCourses;
use Illuminate\Http\Request;

final class NouToolsCourseInfoController
{
    /**
     * @return array{course: array<string, mixed>|null}
     */
    public function __invoke(
        Request $request,
        string $cid,
        GetNouToolsIntegrationEnabled $getEnabled,
        ListCourses $listCourses,
        GetNouToolsCourseData $getNouToolsCourseData,
    ): array {
        if (! $getEnabled()) {
            return ['course' => null];
        }

        $courseData = $getNouToolsCourseData($listCourses($request));
        $current = collect($courseData)->first(static fn (array $item) => ($item['courseId'] ?? null) === $cid);

        if (! is_array($current) || ! isset($current['detail']) || ! is_array($current['detail'])) {
            return ['course' => null];
        }

        $detail = $current['detail'];

        return [
            'course' => [
                'courseId' => $current['courseId'],
                'courseName' => $current['name'],
                'className' => $current['className'],
                'nouToolsCourseId' => $current['nouToolsCourseId'],
                'descriptionUrl' => $detail['descriptionUrl'] ?? null,
                'creditType' => $detail['creditType'] ?? null,
                'credits' => $detail['credits'] ?? null,
                'department' => $detail['department'] ?? null,
                'nature' => $detail['nature'] ?? null,
                'midtermDate' => $detail['midtermDate'] ?? null,
                'finalDate' => $detail['finalDate'] ?? null,
                'examTimeStart' => $detail['examTimeStart'] ?? null,
                'examTimeEnd' => $detail['examTimeEnd'] ?? null,
                'textbook' => isset($detail['textbook']) && is_array($detail['textbook']) ? $detail['textbook'] : null,
                'previousExams' => isset($detail['previousExams']) && is_array($detail['previousExams'])
                    ? array_values(array_filter($detail['previousExams'], 'is_array'))
                    : [],
            ],
        ];
    }
}

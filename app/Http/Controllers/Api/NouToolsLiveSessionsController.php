<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use AltUU\Domains\AppPreference\Actions\GetNouToolsIntegrationEnabled;
use AltUU\Domains\Course\Actions\GetNouToolsCourseData;
use AltUU\Domains\Course\Actions\ListCourses;
use App\Models\Account;
use App\Services\AccountManager;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Throwable;

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
        AccountManager $accountManager,
    ): array {
        if (! $getEnabled()) {
            return [];
        }

        $accounts = $accountManager->all();
        $allAccounts = $request->boolean('allAccounts') && $accounts->count() > 1;

        if (! $allAccounts) {
            $accountId = $accountManager->activeId();
            $account = $accountId !== null ? $accounts->firstWhere('id', $accountId) : null;

            return $this->fetchSessionsForAccount($request, $listCourses, $getNouToolsCourseData, $account, $accountId);
        }

        $sessions = [];

        foreach ($accounts as $account) {
            if ($account->hungu_session === null) {
                continue;
            }

            try {
                $sessions = [
                    ...$sessions,
                    ...$this->fetchSessionsForAccount($request, $listCourses, $getNouToolsCourseData, $account, $account->id),
                ];
            } catch (Throwable $e) {
                report($e);
            }
        }

        return $sessions;
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function fetchSessionsForAccount(
        Request $request,
        ListCourses $listCourses,
        GetNouToolsCourseData $getNouToolsCourseData,
        ?Account $account,
        ?int $accountId,
    ): array {
        $courseData = $getNouToolsCourseData($listCourses($request, $accountId));
        $accountLabel = $this->resolveAccountLabel($account);
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

            $classCode = $matchedClass['code'] ?? null;
            $isUndivided = $classCode === GetNouToolsCourseData::UNDIVIDED_CLASS_CODE;

            $sessions[] = [
                'accountId' => $accountId,
                'accountLabel' => $accountLabel,
                'courseId' => $item['courseId'],
                'courseName' => $item['name'],
                'semester' => $item['semester'],
                'className' => $isUndivided ? GetNouToolsCourseData::UNDIVIDED_CLASS_CODE : $item['className'],
                'classCode' => $classCode,
                'type' => $matchedClass['type'] ?? null,
                'typeLabel' => $matchedClass['typeLabel'] ?? null,
                'teacherName' => $matchedClass['teacherName'] ?? null,
                'link' => $matchedClass['link'] ?? null,
                'backupClassroomUrl' => $matchedClass['backupClassroomUrl'] ?? null,
                'startTime' => $matchedClass['startTime'] ?? null,
                'endTime' => $matchedClass['endTime'] ?? null,
                'sessions' => array_values(array_filter($rawSessions, 'is_array')),
            ];
        }

        return $sessions;
    }

    private function resolveAccountLabel(?Account $account): string
    {
        if ($account === null) {
            return '';
        }

        if ($account->nickname !== null && $account->nickname !== '') {
            return $account->nickname;
        }

        $profile = Arr::get($account->hungu_session, 'profile', []);
        $displayName = (string) Arr::get($profile, 'display_name', '');

        return $displayName !== '' ? $displayName : $account->username;
    }
}

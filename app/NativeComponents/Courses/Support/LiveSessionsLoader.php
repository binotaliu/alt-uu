<?php

declare(strict_types=1);

namespace App\NativeComponents\Courses\Support;

use AltUU\Domains\AppPreference\Actions\GetNouToolsIntegrationEnabled;
use AltUU\Domains\Course\Actions\GetNouToolsCourseData;
use AltUU\Domains\Course\Actions\ListCourses;
use App\Models\Account;
use App\Services\AccountManager;
use Illuminate\Support\Arr;
use Throwable;

/**
 * Loads NOU Tools live sessions for one or all accounts. Mirrors
 * NouToolsLiveSessionsController, whose logic is inline in the controller
 * (no Action exists yet), without the HTTP hop.
 */
final class LiveSessionsLoader
{
    /**
     * @return array<int, array<string, mixed>>
     */
    public static function load(bool $allAccounts): array
    {
        if (! app(GetNouToolsIntegrationEnabled::class)()) {
            return [];
        }

        $manager = app(AccountManager::class);
        $accounts = $manager->all();

        if (! ($allAccounts && $accounts->count() > 1)) {
            $accountId = $manager->activeId();
            $account = $accountId !== null ? $accounts->firstWhere('id', $accountId) : null;

            return self::forAccount($account, $accountId);
        }

        $sessions = [];

        foreach ($accounts as $account) {
            if ($account->hungu_session === null) {
                continue;
            }

            try {
                $sessions = [...$sessions, ...self::forAccount($account, $account->id)];
            } catch (Throwable $e) {
                report($e);
            }
        }

        return $sessions;
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private static function forAccount(?Account $account, ?int $accountId): array
    {
        $courseData = app(GetNouToolsCourseData::class)(app(ListCourses::class)($accountId));
        $label = self::accountLabel($account);
        $sessions = [];

        foreach ($courseData as $item) {
            $matched = $item['matchedClass'] ?? null;

            if (! is_array($matched) || ! is_array($matched['sessions'] ?? [])) {
                continue;
            }

            $classCode = $matched['code'] ?? null;

            $sessions[] = [
                'accountId' => $accountId,
                'accountLabel' => $label,
                'courseId' => $item['courseId'],
                'courseName' => $item['name'],
                'semester' => $item['semester'],
                'className' => $classCode === GetNouToolsCourseData::UNDIVIDED_CLASS_CODE ? GetNouToolsCourseData::UNDIVIDED_CLASS_CODE : $item['className'],
                'classCode' => $classCode,
                'typeLabel' => $matched['typeLabel'] ?? null,
                'teacherName' => $matched['teacherName'] ?? null,
                'link' => $matched['link'] ?? null,
                'backupClassroomUrl' => $matched['backupClassroomUrl'] ?? null,
                'sessions' => array_values(array_filter($matched['sessions'] ?? [], is_array(...))),
            ];
        }

        return $sessions;
    }

    private static function accountLabel(?Account $account): string
    {
        if ($account === null) {
            return '';
        }

        if ($account->nickname !== null && $account->nickname !== '') {
            return $account->nickname;
        }

        $displayName = (string) Arr::get($account->hungu_session, 'profile.display_name', '');

        return $displayName !== '' ? $displayName : $account->username;
    }
}

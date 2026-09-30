<?php

declare(strict_types=1);

namespace Tests\Feature\Native\Main;

use AltUU\Domains\AppPreference\Actions\UpdateAppPreferences;
use AltUU\Domains\AppPreference\DataTransferObjects\UpdateAppPreferencesInputData;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Tests\Feature\Native\Fixtures\AccountSeeding;

/**
 * Shared upstream fakes for the main tab screen tests.
 */
final class MainFixtures
{
    public static function loggedIn(string $username = 's1234567'): void
    {
        Cache::flush();
        AccountSeeding::activate(AccountSeeding::seed($username));
    }

    /**
     * @param  array<string, mixed>  $preferences
     */
    public static function preferences(array $preferences): void
    {
        app(UpdateAppPreferences::class)(UpdateAppPreferencesInputData::from($preferences));
    }

    /**
     * Fakes the school platform (profile check + one course) and NOU Tools
     * (one class with the given sessions, plus a calendar).
     *
     * @param  list<array{date: string, startTime: string, endTime: string}>  $sessions
     * @param  list<array<string, mixed>>  $calendar
     * @param  array<string, mixed>  $classOverrides
     */
    public static function fakeUpstream(array $sessions = [], array $calendar = [], bool $nouToolsDown = false, array $classOverrides = []): void
    {
        $nouTools = static fn (mixed $response): mixed => $nouToolsDown
            ? fn () => throw new ConnectionException('offline')
            : $response;

        Http::fake([
            'https://uu.nou.edu.tw/xmlapi/index.php?action=my-profile*' => Http::response(['code' => 0, 'message' => 'success', 'data' => ['username' => 's1234567', 'realname' => '測試學生']]),
            'https://uu.nou.edu.tw/xmlapi/index.php?action=my-course-list*' => Http::response(['code' => 0, 'data' => ['list' => [['course_id' => '1001', 'title' => '(114上)管理學：導論-ZZZ001班']]]]),
            'https://nou-tools.binota.org/api/v1/courses/1234' => $nouTools(Http::response([
                'id' => 1234,
                'name' => '管理學導論',
                'term' => '2025A',
                'classes' => [[
                    'id' => 5566,
                    'code' => 'ZZZ001',
                    'type' => 'morning',
                    'typeLabel' => '上午班',
                    'startTime' => '09:00:00+08:00',
                    'endTime' => '10:50:00+08:00',
                    'teacherName' => '王小明老師',
                    'link' => 'https://meet.example.com/main',
                    'backupClassroomUrl' => 'https://meet.example.com/backup',
                    'sessions' => $sessions,
                    ...$classOverrides,
                ]],
            ])),
            'https://nou-tools.binota.org/api/v1/courses?term=2025A' => $nouTools(Http::response([['id' => 1234, 'name' => '管理學導論', 'term' => '2025A']])),
            'https://nou-tools.binota.org/api/v1/school-calendar' => $nouTools(Http::response($calendar)),
        ]);
    }
}

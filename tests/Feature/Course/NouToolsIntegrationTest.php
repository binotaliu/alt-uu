<?php

use App\Models\Account;
use App\Models\KeyValueStore;
use App\Services\AccountActiveProfile;
use App\Services\AccountCredentialsStore;
use App\Services\UUSessionStore;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Mockery as MockeryManager;

use function Pest\Laravel\assertDatabaseHas;
use function Pest\Laravel\getJson;
use function Pest\Laravel\patchJson;

beforeEach(function () {
    Cache::flush();

    KeyValueStore::query()
        ->where('key', 'preference:nou-tools-integration')
        ->delete();
});

it('stores nou tools integration preference', function () {
    getJson('/api/preferences')
        ->assertOk()
        ->assertJsonPath('nouToolsIntegrationEnabled', false);

    patchJson('/api/preferences', ['nouToolsIntegrationEnabled' => true])
        ->assertOk()
        ->assertJsonPath('nouToolsIntegrationEnabled', true);

    assertDatabaseHas('key_value_store', [
        'key' => 'preference:nou-tools-integration',
        'value' => json_encode(['enabled' => true]),
    ]);

    getJson('/api/preferences')
        ->assertOk()
        ->assertJsonPath('nouToolsIntegrationEnabled', true);
});

it('returns mapped nou tools live sessions, school calendar, and course info', function () {
    KeyValueStore::query()->updateOrCreate(
        ['key' => 'preference:nou-tools-integration'],
        ['value' => json_encode(['enabled' => true], JSON_THROW_ON_ERROR)],
    );

    Http::fake([
        'https://uu.nou.edu.tw/xmlapi/index.php?action=my-course-list*' => Http::response([
            'code' => 0,
            'message' => 'success',
            'data' => [
                'list' => [
                    [
                        'course_id' => '1001',
                        'title' => '(114上)管理學：導論-ZZZ001班',
                    ],
                ],
            ],
        ]),
        'https://nou-tools.binota.org/api/v1/courses/1234' => Http::response([
            'id' => 1234,
            'name' => '管理學導論',
            'term' => '2025A',
            'descriptionUrl' => 'https://example.com/course/1234',
            'creditType' => '必修',
            'credits' => 3,
            'department' => '假學系',
            'nature' => '專業科目',
            'midtermDate' => '2025-11-15',
            'finalDate' => '2026-01-10',
            'examTimeStart' => '09:00:00+08:00',
            'examTimeEnd' => '10:30:00+08:00',
            'textbook' => [
                'bookTitle' => '管理學概論',
                'edition' => '第三版',
                'priceInfo' => 'NT$450',
                'referenceUrl' => 'https://example.com/book/123',
            ],
            'previousExams' => [
                [
                    'term' => '2024B',
                    'midtermReferencePrimary' => 'https://example.com/exams/midterm-a.pdf',
                    'midtermReferenceSecondary' => null,
                    'finalReferencePrimary' => 'https://example.com/exams/final-a.pdf',
                    'finalReferenceSecondary' => null,
                ],
            ],
            'classes' => [
                [
                    'id' => 5566,
                    'code' => 'ZZZ001',
                    'type' => 'morning',
                    'typeLabel' => '上午班',
                    'startTime' => '09:00:00+08:00',
                    'endTime' => '10:50:00+08:00',
                    'teacherName' => '測試教師甲',
                    'link' => 'https://meet.example.com/abc-defg-hij',
                    'sessions' => [
                        [
                            'date' => '2025-10-12',
                            'startTime' => '09:00:00+08:00',
                            'endTime' => '10:50:00+08:00',
                        ],
                    ],
                ],
            ],
        ]),
        'https://nou-tools.binota.org/api/v1/courses?term=2025A' => Http::response([
            ['id' => 1234, 'name' => '管理學導論', 'term' => '2025A'],
        ]),
        'https://nou-tools.binota.org/api/v1/school-calendar' => Http::response([
            [
                'name' => '期中考',
                'startDate' => '2025-11-15',
                'endDate' => '2025-11-16',
                'isCountdown' => true,
            ],
        ]),
    ]);

    $sessionStore = MockeryManager::mock(UUSessionStore::class);
    $sessionStore->shouldReceive('get')->andReturn([
        'base_url' => 'https://uu.nou.edu.tw',
        'ua' => 'test-agent',
        'ticket' => 'ticket-1',
        'session_idx' => 'idx-1',
        'cookies' => ['WM' => 'cookie'],
        'profile' => ['display_name' => '測試', 'username' => 's123'],
    ]);
    $sessionStore->shouldReceive('put');
    app()->instance(UUSessionStore::class, $sessionStore);

    getJson('/api/nou-tools/live-sessions')
        ->assertOk()
        ->assertJsonCount(1)
        ->assertJsonPath('0.courseId', '1001')
        ->assertJsonPath('0.classCode', 'ZZZ001')
        ->assertJsonPath('0.sessions.0.date', '2025-10-12');

    getJson('/api/nou-tools/school-calendar')
        ->assertOk()
        ->assertJsonCount(1)
        ->assertJsonPath('0.name', '期中考');

    getJson('/api/courses/1001/nou-tools-info')
        ->assertOk()
        ->assertJsonPath('course.nouToolsCourseId', 1234)
        ->assertJsonPath('course.department', '假學系')
        ->assertJsonPath('course.previousExams.0.term', '2024B');

    Http::assertSent(fn ($request) => str_contains($request->url(), 'term=2025A'));
});

it('merges live sessions from every account when allAccounts is requested', function () {
    KeyValueStore::query()->updateOrCreate(
        ['key' => 'preference:nou-tools-integration'],
        ['value' => json_encode(['enabled' => true], JSON_THROW_ON_ERROR)],
    );

    app(AccountCredentialsStore::class)->put('s1111111', 'secret');
    $first = Account::query()->where('username', 's1111111')->firstOrFail();
    app(AccountCredentialsStore::class)->put('s2222222', 'secret');
    $second = Account::query()->where('username', 's2222222')->firstOrFail();
    $second->update(['nickname' => '副帳號']);

    app(UUSessionStore::class)->put([
        'base_url' => 'https://uu-a.nou.edu.tw',
        'ua' => 'test-agent',
        'ticket' => 'ticket-a',
        'cookies' => ['WM' => 'cookie-a'],
        'profile' => ['display_name' => '主帳號', 'username' => 's1111111'],
    ], $first->id);
    app(UUSessionStore::class)->put([
        'base_url' => 'https://uu-b.nou.edu.tw',
        'ua' => 'test-agent',
        'ticket' => 'ticket-b',
        'cookies' => ['WM' => 'cookie-b'],
        'profile' => ['display_name' => '測試', 'username' => 's2222222'],
    ], $second->id);

    app(AccountActiveProfile::class)->set($first->id);

    Http::fake([
        'https://uu-a.nou.edu.tw/xmlapi/index.php?action=my-course-list*' => Http::response([
            'code' => 0,
            'message' => 'success',
            'data' => ['list' => [['course_id' => '1001', 'title' => '(114上)管理學：導論-ZZZ001班']]],
        ]),
        'https://uu-b.nou.edu.tw/xmlapi/index.php?action=my-course-list*' => Http::response([
            'code' => 0,
            'message' => 'success',
            'data' => ['list' => [['course_id' => '2001', 'title' => '(114上)會計學：入門-YYY001班']]],
        ]),
        'https://nou-tools.binota.org/api/v1/courses/1234' => Http::response([
            'id' => 1234,
            'name' => '管理學導論',
            'term' => '2025A',
            'previousExams' => [],
            'classes' => [[
                'id' => 5566,
                'code' => 'ZZZ001',
                'type' => 'morning',
                'typeLabel' => '上午班',
                'startTime' => '09:00:00+08:00',
                'endTime' => '10:50:00+08:00',
                'teacherName' => '測試教師甲',
                'link' => 'https://meet.example.com/abc-defg-hij',
                'sessions' => [['date' => '2025-10-12', 'startTime' => '09:00:00+08:00', 'endTime' => '10:50:00+08:00']],
            ]],
        ]),
        'https://nou-tools.binota.org/api/v1/courses/4321' => Http::response([
            'id' => 4321,
            'name' => '會計學入門',
            'term' => '2025A',
            'previousExams' => [],
            'classes' => [[
                'id' => 6677,
                'code' => 'YYY001',
                'type' => 'evening',
                'typeLabel' => '晚間班',
                'startTime' => '19:00:00+08:00',
                'endTime' => '20:50:00+08:00',
                'teacherName' => '測試教師乙',
                'link' => 'https://meet.example.com/xyz-uvwt-rst',
                'sessions' => [['date' => '2025-10-13', 'startTime' => '19:00:00+08:00', 'endTime' => '20:50:00+08:00']],
            ]],
        ]),
        'https://nou-tools.binota.org/api/v1/courses?term=2025A' => Http::response([
            ['id' => 1234, 'name' => '管理學導論', 'term' => '2025A'],
            ['id' => 4321, 'name' => '會計學入門', 'term' => '2025A'],
        ]),
    ]);

    getJson('/api/nou-tools/live-sessions')
        ->assertOk()
        ->assertJsonCount(1)
        ->assertJsonPath('0.courseId', '1001')
        ->assertJsonPath('0.accountId', $first->id);

    getJson('/api/nou-tools/live-sessions?allAccounts=1')
        ->assertOk()
        ->assertJsonCount(2);

    $sessions = collect(getJson('/api/nou-tools/live-sessions?allAccounts=1')->json());

    expect($sessions->firstWhere('courseId', '1001'))
        ->toMatchArray(['accountId' => $first->id, 'accountLabel' => '主帳號']);
    expect($sessions->firstWhere('courseId', '2001'))
        ->toMatchArray(['accountId' => $second->id, 'accountLabel' => '副帳號']);
});

it('falls back to the undivided 不分班 class when no class code matches and the course title has no class suffix', function () {
    KeyValueStore::query()->updateOrCreate(
        ['key' => 'preference:nou-tools-integration'],
        ['value' => json_encode(['enabled' => true], JSON_THROW_ON_ERROR)],
    );

    Http::fake([
        'https://uu.nou.edu.tw/xmlapi/index.php?action=my-course-list*' => Http::response([
            'code' => 0,
            'message' => 'success',
            'data' => [
                'list' => [
                    [
                        'course_id' => '2002',
                        'title' => '(115暑)通識課程',
                    ],
                ],
            ],
        ]),
        'https://nou-tools.binota.org/api/v1/courses/5678' => Http::response([
            'id' => 5678,
            'name' => '通識課程',
            'term' => '2026C',
            'previousExams' => [],
            'classes' => [
                [
                    'id' => 9001,
                    'code' => '不分班',
                    'type' => 'full_remote',
                    'typeLabel' => '不分班',
                    'startTime' => '19:00:00+08:00',
                    'endTime' => '21:00:00+08:00',
                    'teacherName' => '測試教師丙',
                    'link' => 'https://meet.example.com/undivided-room',
                    'backupClassroomUrl' => 'https://meet.example.com/backup-room',
                    'sessions' => [
                        [
                            'date' => '2026-07-20',
                            'startTime' => '19:00:00+08:00',
                            'endTime' => '21:00:00+08:00',
                        ],
                    ],
                ],
            ],
        ]),
        'https://nou-tools.binota.org/api/v1/courses?term=2026C' => Http::response([
            ['id' => 5678, 'name' => '通識課程', 'term' => '2026C'],
        ]),
    ]);

    $sessionStore = MockeryManager::mock(UUSessionStore::class);
    $sessionStore->shouldReceive('get')->andReturn([
        'base_url' => 'https://uu.nou.edu.tw',
        'ua' => 'test-agent',
        'ticket' => 'ticket-1',
        'session_idx' => 'idx-1',
        'cookies' => ['WM' => 'cookie'],
        'profile' => ['display_name' => '測試', 'username' => 's123'],
    ]);
    $sessionStore->shouldReceive('put');
    app()->instance(UUSessionStore::class, $sessionStore);

    getJson('/api/nou-tools/live-sessions')
        ->assertOk()
        ->assertJsonCount(1)
        ->assertJsonPath('0.courseId', '2002')
        ->assertJsonPath('0.className', '不分班')
        ->assertJsonPath('0.classCode', '不分班')
        ->assertJsonPath('0.link', 'https://meet.example.com/undivided-room')
        ->assertJsonPath('0.backupClassroomUrl', 'https://meet.example.com/backup-room')
        ->assertJsonPath('0.sessions.0.date', '2026-07-20');
});

it('displays 不分班 instead of the UU-provided class name when the matched class is undivided', function () {
    KeyValueStore::query()->updateOrCreate(
        ['key' => 'preference:nou-tools-integration'],
        ['value' => json_encode(['enabled' => true], JSON_THROW_ON_ERROR)],
    );

    Http::fake([
        'https://uu.nou.edu.tw/xmlapi/index.php?action=my-course-list*' => Http::response([
            'code' => 0,
            'message' => 'success',
            'data' => [
                'list' => [
                    [
                        'course_id' => '2003',
                        'title' => '(115暑)通識課程-ZZZ999班',
                    ],
                ],
            ],
        ]),
        'https://nou-tools.binota.org/api/v1/courses/5679' => Http::response([
            'id' => 5679,
            'name' => '通識課程',
            'term' => '2026C',
            'previousExams' => [],
            'classes' => [
                [
                    'id' => 9002,
                    'code' => '不分班',
                    'type' => 'full_remote',
                    'typeLabel' => '全遠距',
                    'startTime' => '19:00:00+08:00',
                    'endTime' => '21:00:00+08:00',
                    'teacherName' => '測試教師丙',
                    'link' => 'https://meet.example.com/undivided-room',
                    'backupClassroomUrl' => null,
                    'sessions' => [
                        [
                            'date' => '2026-07-20',
                            'startTime' => '19:00:00+08:00',
                            'endTime' => '21:00:00+08:00',
                        ],
                    ],
                ],
            ],
        ]),
        'https://nou-tools.binota.org/api/v1/courses?term=2026C' => Http::response([
            ['id' => 5679, 'name' => '通識課程', 'term' => '2026C'],
        ]),
    ]);

    $sessionStore = MockeryManager::mock(UUSessionStore::class);
    $sessionStore->shouldReceive('get')->andReturn([
        'base_url' => 'https://uu.nou.edu.tw',
        'ua' => 'test-agent',
        'ticket' => 'ticket-1',
        'session_idx' => 'idx-1',
        'cookies' => ['WM' => 'cookie'],
        'profile' => ['display_name' => '測試', 'username' => 's123'],
    ]);
    $sessionStore->shouldReceive('put');
    app()->instance(UUSessionStore::class, $sessionStore);

    getJson('/api/nou-tools/live-sessions')
        ->assertOk()
        ->assertJsonCount(1)
        ->assertJsonPath('0.courseId', '2003')
        ->assertJsonPath('0.className', '不分班')
        ->assertJsonPath('0.classCode', '不分班');
});

it('uses the sole ZZZ000 class for 統一面授 courses regardless of the student\'s own class', function () {
    KeyValueStore::query()->updateOrCreate(
        ['key' => 'preference:nou-tools-integration'],
        ['value' => json_encode(['enabled' => true], JSON_THROW_ON_ERROR)],
    );

    Http::fake([
        'https://uu.nou.edu.tw/xmlapi/index.php?action=my-course-list*' => Http::response([
            'code' => 0,
            'message' => 'success',
            'data' => [
                'list' => [
                    [
                        'course_id' => '3001',
                        'title' => '(114上)教育心理學-ZZZ003班',
                    ],
                ],
            ],
        ]),
        'https://nou-tools.binota.org/api/v1/courses/6789' => Http::response([
            'id' => 6789,
            'name' => '教育心理學',
            'term' => '2025A',
            'previousExams' => [],
            'classes' => [
                [
                    'id' => 7001,
                    'code' => 'ZZZ000',
                    'type' => 'in_person',
                    'typeLabel' => '統一面授',
                    'startTime' => '19:00:00+08:00',
                    'endTime' => '21:00:00+08:00',
                    'teacherName' => '測試教師乙',
                    'link' => 'https://meet.example.com/unified-room',
                    'sessions' => [
                        [
                            'date' => '2025-10-05',
                            'startTime' => '19:00:00+08:00',
                            'endTime' => '21:00:00+08:00',
                        ],
                    ],
                ],
            ],
        ]),
        'https://nou-tools.binota.org/api/v1/courses?term=2025A' => Http::response([
            ['id' => 6789, 'name' => '教育心理學', 'term' => '2025A'],
        ]),
    ]);

    $sessionStore = MockeryManager::mock(UUSessionStore::class);
    $sessionStore->shouldReceive('get')->andReturn([
        'base_url' => 'https://uu.nou.edu.tw',
        'ua' => 'test-agent',
        'ticket' => 'ticket-1',
        'session_idx' => 'idx-1',
        'cookies' => ['WM' => 'cookie'],
        'profile' => ['display_name' => '測試', 'username' => 's123'],
    ]);
    $sessionStore->shouldReceive('put');
    app()->instance(UUSessionStore::class, $sessionStore);

    getJson('/api/nou-tools/live-sessions')
        ->assertOk()
        ->assertJsonCount(1)
        ->assertJsonPath('0.courseId', '3001')
        ->assertJsonPath('0.classCode', 'ZZZ000')
        ->assertJsonPath('0.link', 'https://meet.example.com/unified-room')
        ->assertJsonPath('0.sessions.0.date', '2025-10-05');
});

<?php

use App\Models\KeyValueStore;
use App\Services\UUSessionStore;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Mockery as MockeryManager;

use function Pest\Laravel\assertDatabaseHas;
use function Pest\Laravel\getJson;
use function Pest\Laravel\postJson;

beforeEach(function () {
    Cache::flush();

    KeyValueStore::query()
        ->where('key', 'preference:nou-tools-integration')
        ->delete();
});

it('stores nou tools integration preference', function () {
    getJson('/api/preferences/nou-tools')
        ->assertOk()
        ->assertExactJson(['enabled' => false]);

    postJson('/api/preferences/nou-tools', ['enabled' => true])
        ->assertCreated()
        ->assertExactJson(['enabled' => true]);

    assertDatabaseHas('key_value_store', [
        'key' => 'preference:nou-tools-integration',
        'value' => json_encode(['enabled' => true]),
    ]);

    getJson('/api/preferences/nou-tools')
        ->assertOk()
        ->assertExactJson(['enabled' => true]);
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
            'descriptionUrl' => 'https://nou.edu.tw/course/1234',
            'creditType' => '必修',
            'credits' => 3,
            'department' => '管理與資訊學系',
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
                    'teacherName' => '王小明',
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
        ->assertJsonPath('course.department', '管理與資訊學系')
        ->assertJsonPath('course.previousExams.0.term', '2024B');

    Http::assertSent(fn ($request) => str_contains($request->url(), 'term=2025A'));
});

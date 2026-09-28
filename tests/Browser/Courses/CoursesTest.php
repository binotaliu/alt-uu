<?php

use App\Models\KeyValueStore;
use Illuminate\Support\Facades\Http;

/**
 * @param  array<int, array<string, mixed>>  $courses
 * @param  array<string, mixed>  $extraFakes
 */
function fakeCoursesLogin(array $courses = [], array $extraFakes = []): void
{
    Http::fake($extraFakes + [
        'https://uu.nou.edu.tw/' => Http::response('<html/>', 200, [
            'Set-Cookie' => 'PHPSESSID=home; path=/',
        ]),
        'https://uu.nou.edu.tw/learn/index.php' => Http::response('<html/>', 200, [
            'Set-Cookie' => 'WMSESSID=learn; path=/',
        ]),
        'https://uu.nou.edu.tw/xmlapi/index.php?action=login*' => Http::response([
            'code' => 0,
            'message' => 'success',
            'data' => [
                'session_data' => ['ticket' => 'ticket-1'],
                'idx_data' => ['session_idx' => 'idx-1'],
                'login_data' => ['realname' => '測試學生'],
                'cookie_data' => ['WM' => 'cookie-from-payload'],
            ],
        ], 200, [
            'Set-Cookie' => 'APPCOOKIE=app; path=/',
        ]),
        'https://uu.nou.edu.tw/xmlapi/index.php?action=my-profile*' => Http::response([
            'code' => 0,
            'message' => 'success',
            'data' => [
                'username' => 's1234567',
                'realname' => '測試學生',
                'picture' => 'https://uu.nou.edu.tw/avatar.jpg',
            ],
        ]),
        'https://uu.nou.edu.tw/xmlapi/index.php?action=my-course-list*' => Http::response([
            'code' => 0,
            'message' => 'success',
            'data' => ['list' => $courses],
        ]),
        // Materials tab: course path info (empty tree keeps the directory in a valid empty state).
        'https://uu.nou.edu.tw/xmlapi/index.php?action=my-course-path-info*' => Http::response([
            'code' => 0,
            'message' => 'success',
            'data' => ['path' => ['item' => []]],
        ]),
        'https://uu.nou.edu.tw/learn/last10.php*' => Http::response('<html><body></body></html>'),
        // Tasks-count widget (index + show pages both fetch it).
        'https://uu.nou.edu.tw/learn/my_homework.php' => Http::response('<html><body></body></html>'),
        'https://uu.nou.edu.tw/learn/my_forum.php' => Http::response('<html><body></body></html>'),
        // Discuss boards fetched in the background as soon as a course is selected.
        'https://uu.nou.edu.tw/xmlapi/index.php?action=get-board-list*' => Http::response([
            'code' => 0,
            'message' => 'success',
            'data' => ['list' => []],
        ]),
        '*' => Http::response('<html><body></body></html>'),
    ]);
}

function loginToCourses(string $path = '/courses')
{
    $page = visit('/login')
        ->fill('input[autocomplete="username"]', 's1234567')
        ->fill('input[autocomplete="current-password"]', 'secret')
        ->click('登入')
        ->assertPathIs('/courses');

    return $path === '/courses' ? $page : $page->navigate($path);
}

it('lists courses returned by the API grouped by semester', function () {
    fakeCoursesLogin([
        ['course_id' => '9001', 'title' => '(114上)測試課程甲-甲班'],
        ['course_id' => '9002', 'title' => '(114上)測試課程乙-乙班'],
    ]);

    loginToCourses()
        ->assertSee('測試課程甲')
        ->assertSee('測試課程乙')
        ->assertSee('114上');
});

it('navigates from the course list to a course detail page', function () {
    fakeCoursesLogin([
        ['course_id' => '9001', 'title' => '(114上)測試課程甲-甲班'],
    ]);

    loginToCourses()
        ->assertSee('測試課程甲')
        ->click('測試課程甲')
        ->assertPathIs('/courses/9001')
        ->assertSee('測試課程甲');
});

it('offers the nou tools tabs from the course list when the integration is enabled', function () {
    KeyValueStore::query()->updateOrCreate(
        ['key' => 'preference:nou-tools-integration'],
        ['value' => json_encode(['enabled' => true], JSON_THROW_ON_ERROR)],
    );

    fakeCoursesLogin([
        ['course_id' => '9001', 'title' => '(114上)測試課程甲-甲班'],
    ]);

    loginToCourses()
        ->assertSee('測試課程甲')
        ->click('nav a:visible:has-text("視訊面授")')
        ->assertPathIs('/courses/live-sessions')
        ->assertDontSee('開啟 NOU 小幫手整合');
});

it('shows the materials tab by default and switches to the homework tab on click', function () {
    fakeCoursesLogin([
        ['course_id' => '9001', 'title' => '(114上)測試課程甲-甲班'],
    ], [
        'https://uu.nou.edu.tw/learn/homework/homework_list.php' => Http::response(<<<'HTML'
            <html>
                <script>
                    function view_homework(type, eid, obj) {
                        window.open('/learn/' + type + '/view_exemplar.php?' + eid + '+personal', 'result', 'width=980, height=480');
                    }
                </script>
                <body>
                    <div class="box2" data-type="homework">
                        <div class="title" style="width: 70%;">
                            <div class="icon-user-blue exam-type-tips" title="作業型態: 個人"></div>
                            <span class="sparkpie exam-percent-tips" title="100%">100,0</span>
                            &nbsp;
                            <span style="width: 230px;" title="第一次作業">第一次作業</span>
                        </div>
                        <div class="content">
                            <div class="data5 mooc-process">
                                <div class="process-btn pay active" onclick="togo('200001+1+tokenabc', false, this)">
                                    <div class="level1">
                                        <div class="main-text">進行作業</div>
                                        <div class="sub-text">從 2026-01-01 00:00 到 2026-01-31 23:59</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </body>
            </html>
            HTML),
    ]);

    loginToCourses('/courses/9001')
        ->assertSee('測試課程甲')
        ->click('button:visible:has-text("作業")')
        ->assertPathIs('/courses/9001')
        ->assertSee('第一次作業');
});

it('locks page scrolling only while the course list placeholder is showing', function () {
    fakeCoursesLogin([], [
        'https://uu.nou.edu.tw/xmlapi/index.php?action=my-course-list*' => function () {
            usleep(1_500_000);

            return Http::response([
                'code' => 0,
                'message' => 'success',
                'data' => ['list' => [
                    ['course_id' => '9001', 'title' => '(114上)測試課程甲-甲班'],
                ]],
            ]);
        },
    ]);

    $page = loginToCourses();

    expect($page->script('document.body.style.overflow'))->toBe('hidden');

    $page->assertSee('測試課程甲');

    expect($page->script('document.body.style.overflow'))->toBe('');
});

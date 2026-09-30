<?php

declare(strict_types=1);

use AltUU\Domains\SchoolPortal\ViewModels\SchoolPortalClassSessionInfoViewModel;
use AltUU\Domains\SchoolPortal\ViewModels\SchoolPortalExamInfoViewModel;
use AltUU\Domains\SchoolPortal\ViewModels\SchoolPortalExamScheduleViewModel;
use AltUU\Domains\SchoolPortal\ViewModels\SchoolPortalExamScopeViewModel;
use AltUU\Domains\SchoolPortal\ViewModels\SchoolPortalGradeViewModel;
use AltUU\Domains\SchoolPortal\ViewModels\SchoolPortalHomeworkNoticeViewModel;
use App\Models\Account;
use App\NativeComponents\Courses\CourseInfoTab;
use App\NativeComponents\Courses\CourseShow;
use App\Services\AccountActiveProfile;
use App\Services\UUSessionStore;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Native\Mobile\Testing\Native;
use Native\Mobile\Testing\TestableComponent;
use Tests\Feature\Native\Course\CourseUpstreamFake;
use Tests\Feature\Native\Fixtures\AccountSeeding;

beforeEach(function (): void {
    AccountSeeding::activate(AccountSeeding::seed('s1234567'));
    CourseUpstreamFake::install();
});

function showCourse(string $tab = 'materials'): TestableComponent
{
    return Native::test(CourseShow::class, params: ['cid' => '1001'], data: ['tab' => $tab]);
}

it('renders the course header, the tab strip and the badge counts', function (): void {
    showCourse()
        ->assertNavTitle('行動學習導論')
        ->assertSee('教材')
        ->assertSee('討論')
        ->assertSee('作業')
        ->assertSee('練習')
        ->assertSee('成績')
        ->assertSee('課程資訊')
        ->assertSee('3')
        ->assertSee('2');
});

it('shows the material tree with watch durations on the default tab', function (): void {
    showCourse()
        ->assertSee('教材目錄')
        ->assertSee('第一章')
        ->assertSee('影片一')
        ->assertSee('10:00');
});

it('treats unknown and legacy tab names as the materials tab', function (string $tab): void {
    showCourse($tab)->assertSet('activeTab', 'materials')->assertSee('教材目錄');
})->with(['study-time', 'nonsense', '']);

it('caps a badge at 99+', function (): void {
    CourseUpstreamFake::install(['/learn/my_forum.php' => Http::response(CourseUpstreamFake::taskTable('1001', 150, column: 2))]);

    expect(showCourse()->instance()->badgeFor('discuss'))->toBe('99+');
});

it('shows an inline retry card when the material tree fails and recovers on retry', function (): void {
    CourseUpstreamFake::install(['/learn/last10.php' => Http::response('', 500)]);

    $screen = showCourse()->assertSee('讀取學習時數失敗。')->assertSee('重試');

    CourseUpstreamFake::install();
    $screen->tap('retry')->assertSee('影片一')->assertDontSee('讀取學習時數失敗。');
});

it('says the school system is unreachable when offline', function (): void {
    CourseUpstreamFake::install(['/learn/last10.php' => new ConnectionException('offline')]);

    showCourse()->assertSee('外部服務暫時無法連線，請稍後再試。');
});

it('lists boards of the course and its shared course and opens a board', function (): void {
    $screen = showCourse('discuss')
        ->assertSee('甲班')
        ->assertSee('共用版')
        ->assertSee('課程討論')
        ->assertSee('新文章')
        ->assertSee('主題數：3');

    $screen->tap('board-1001-B-1')->assertNavigatedTo('/courses/1001/discuss/1001/B-1');
});

it('opens a shared course board with the shared course id', function (): void {
    showCourse('discuss')
        ->tap('board-9000-B-2')
        ->assertNavigatedTo('/courses/1001/discuss/9000/B-2');
});

it('switches tabs and loads homework on demand', function (): void {
    $screen = showCourse()->assertDontSee('作業 A');

    $screen->tap('tab-homework')
        ->assertSet('activeTab', 'homework')
        ->assertSee('作業 A')
        ->assertSee('作業 B')
        ->assertSee('100%')
        ->assertSee('從 2026-01-01 00:00 到 2026-01-31 23:59');
});

it('opens a homework page in the attachment browser with cookies and css, then refreshes on resume', function (): void {
    Native::fakeBridge()->respondTo('AttachmentBridge.OpenURL', ['status' => 'success', 'data' => ['opened' => true]]);
    $screen = showCourse('homework');

    $screen->tap('action-0')
        ->assertSet('refreshHomeworksOnReturn', true)
        ->assertNativeCalled('AttachmentBridge.OpenURL', function (array $params): bool {
            return str_contains($params['url'], '200001')
                && $params['cookies'][0]['name'] === 'WM'
                    && $params['cookies'][0]['domain'] === 'uu.nou.edu.tw'
                    && $params['method'] === 'GET'
                    && str_contains((string) $params['css'], '--hw-theme');
        });

    $before = collect(Http::recorded())->filter(fn (array $pair): bool => str_contains($pair[0]->url(), 'homework_list.php'))->count();

    $screen->call('onResume')->assertSet('refreshHomeworksOnReturn', false);

    $after = collect(Http::recorded())->filter(fn (array $pair): bool => str_contains($pair[0]->url(), 'homework_list.php'))->count();
    expect($after)->toBe($before + 1);
});

it('falls back to the in-app browser when the attachment bridge is unavailable', function (): void {
    Native::fakeBridge()->respondTo('AttachmentBridge.OpenURL', ['status' => 'error', 'message' => 'no bridge']);

    showCourse('homework')->tap('result-0')->assertNativeCalled('Browser.OpenInApp');
});

it('disables actions that have no url', function (): void {
    Native::fakeBridge();

    showCourse('homework')->tap('action-1')->assertNativeNotCalled('AttachmentBridge.OpenURL');
});

it('shows an empty state when there is no homework', function (): void {
    CourseUpstreamFake::install(['/learn/homework/homework_list.php' => Http::response('<html></html>')]);

    showCourse('homework')->assertSee('目前沒有可顯示的作業。');
});

it('shows the school portal attachments through the shared attachment row', function (): void {
    CourseUpstreamFake::install();
    $screen = showCourse('homework');
    $screen->set('schoolPortalNotices', [
        new SchoolPortalHomeworkNoticeViewModel(
            title: '期中作業',
            dueDate: '2026/11/01',
            submissionMethod: '線上繳交',
            downloadUrl: 'https://portal.nou.edu.tw/file?filename=hw1',
        ),
    ]);

    $screen->assertSee('教務系統作業附件')
        ->assertSee('期中作業')
        ->assertSee('繳交方式：線上繳交')
        ->assertSee('hw1.pdf')
        ->assertSee('數位學習平台作業');
});

it('loads self exams and shows the empty and error states', function (): void {
    showCourse('self-exam')->assertSee('示範自我測驗 A')->assertSee('進行練習')->assertSee('檢視結果');

    CourseUpstreamFake::install(['/learn/exam/co_self_exam_list.php' => Http::response('<html></html>')]);
    showCourse('self-exam')->assertSee('目前沒有可顯示的自我練習。');

    CourseUpstreamFake::install(['/learn/exam/co_self_exam_list.php' => Http::response('', 500)]);
    showCourse('self-exam')->assertSee('讀取自我練習列表失敗。');
});

it('refreshes self exams after returning from the browser', function (): void {
    Native::fakeBridge()->respondTo('AttachmentBridge.OpenURL', ['status' => 'success', 'data' => ['opened' => true]]);
    $screen = showCourse('self-exam')->tap('action-0')->assertSet('refreshSelfExamsOnReturn', true);

    CourseUpstreamFake::install(['/learn/exam/co_self_exam_list.php' => Http::response('<html></html>')]);
    $screen->call('onResume')->assertSee('目前沒有可顯示的自我練習。');
});

it('renders the grade breakdown and drops the midterm in the summer semester', function (): void {
    $grade = new SchoolPortalGradeViewModel(
        courseName: '行動學習導論',
        semesterLabel: '114下',
        credits: '3',
        firstRegularScore: '80',
        secondRegularScore: '90',
        participationScore: '100',
        regularAverage: '90',
        midtermScore: '70',
        finalScore: '85',
        semesterGrade: '84',
    );

    $screen = showCourse('grades')->set('grade', $grade);
    $screen->assertSee('3 學分')->assertSee('第一次平時')->assertSee('期中成績')->assertSee('84');

    $summer = showCourse('grades')->set('grade', new SchoolPortalGradeViewModel(courseName: 'x', semesterLabel: '114暑', semesterGrade: '77'));
    $summer->assertDontSee('期中成績')->assertSee('期末成績')->assertSee('無資料')->assertSee('77');
});

it('says there is no grade when the school portal has none', function (): void {
    showCourse('grades')->assertSee('本學期查無此課程的教務系統成績資料。');
});

it('renders NOU Tools and school portal course information', function (): void {
    $screen = showCourse('course-info')
        ->set('nouToolsEnabled', true)
        ->set('nouToolsCourse', [
            'creditType' => '必修',
            'credits' => '3',
            'department' => '資訊系',
            'nature' => null,
            'midtermDate' => '2026/11/01',
            'finalDate' => null,
            'examTimeStart' => '09:00',
            'examTimeEnd' => '10:00',
            'textbook' => ['bookTitle' => '行動學習', 'edition' => '二版', 'priceInfo' => 'NT$300', 'referenceUrl' => 'https://books.example/1'],
            'previousExams' => [['term' => '113上', 'midtermReferencePrimary' => 'a.pdf', 'finalReferenceSecondary' => 'b.pdf']],
        ])
        ->set('classSessionInfo', new SchoolPortalClassSessionInfoViewModel(
            courseName: 'x',
            semesterLabel: '114下',
            classDates: '第1次 2026/09/22 第2次 2026/10/20',
            teacher: '陳老師',
            classTime: '1500~1610第5節',
        ))
        ->set('examInfo', new SchoolPortalExamInfoViewModel(
            courseName: 'x',
            semesterLabel: '114下',
            schedules: [new SchoolPortalExamScheduleViewModel(category: '期中考', date: '2026/11/01', time: '0900~1000', room: 'A101')],
            scopes: [new SchoolPortalExamScopeViewModel(category: '期中考', scope: '第1至3章')],
        ));

    $screen->assertSee('基本資訊')
        ->assertSee('必修')
        ->assertSee('未提供')
        ->assertSee('09:00 - 10:00')
        ->assertSee('行動學習')
        ->assertSee('版本：二版')
        ->assertSee('考古題')
        ->assertSee('期中正參')
        ->assertSee('期末副參')
        ->assertSee('上課資訊')
        ->assertSee('陳老師')
        ->assertSee('第五節 – 15:00~16:10')
        ->assertSee('第1次 2026/09/22')
        ->assertSee('考試時間')
        ->assertSee('09:00~10:00')
        ->assertSee('教室代號：A101')
        ->assertSee('考試命題範圍')
        ->assertSee('第1至3章');

    $screen->tap('textbook-link')->assertNativeCalled('Browser.OpenInApp', fn (array $p): bool => $p['url'] === 'https://books.example/1');
    $screen->tap('exam-0-midterm-a')->assertNativeCalled('Browser.OpenInApp', fn (array $p): bool => $p['url'] === 'https://noustud.nou.edu.tw/shared_tmp/work/exa/refans/a.pdf');
});

it('hints at the NOU Tools setting when the integration is off', function (): void {
    showCourse('course-info')->assertSee('開啟「NOU 小幫手整合」')->assertSee('目前都沒有這門課的可用資訊');
});

it('formats school portal times and class dates like the Vue helpers', function (): void {
    expect(CourseInfoTab::formatTimeRange('1500~1610第5節'))->toBe('第五節 – 15:00~16:10')
        ->and(CourseInfoTab::formatTimeRange('1900~2050'))->toBe('19:00~20:50')
        ->and(CourseInfoTab::formatTimeRange('週三晚上'))->toBe('週三晚上')
        ->and(CourseInfoTab::formatTimeRange('0800~0900第12節'))->toBe('第十二節 – 08:00~09:00')
        ->and(CourseInfoTab::formatTimeRange('0800~0900第20節'))->toBe('第二十節 – 08:00~09:00')
        ->and(CourseInfoTab::formatTimeRange(null))->toBeNull()
        ->and(CourseInfoTab::formatClassDates('第1次 2026/09/22 第2次 2026/10/20'))->toBe(['第1次 2026/09/22', '第2次 2026/10/20'])
        ->and(CourseInfoTab::formatClassDates('隨堂'))->toBe(['隨堂'])
        ->and(CourseInfoTab::formatClassDates(null))->toBe([]);
});

it('reloads the current tab from the top bar action and pull to refresh', function (): void {
    $screen = showCourse();
    CourseUpstreamFake::install(['/learn/last10.php' => Http::response('<table class="subject"><tr><td>影片一</td><td>00:20:00</td></tr></table>')]);

    $screen->call('refresh')->assertSee('20:00');
});

it('replaces the screen with the login screen when there is no account', function (): void {
    app(AccountActiveProfile::class)->clear();
    Account::query()->delete();

    Native::test(CourseShow::class, params: ['cid' => '1001'])->assertReplacedWith('/login');
});

it('replaces the screen with the reauth screen when the session and remembered login are dead', function (): void {
    $account = Account::query()->firstOrFail();
    app(UUSessionStore::class)->forget($account->id);
    CourseUpstreamFake::install(['action=login' => Http::response(['code' => 403, 'message' => 'Auth fail', 'data' => []])]);

    Native::test(CourseShow::class, params: ['cid' => '1001'])->assertReplacedWith("/reauth/{$account->id}");
});

it('opens the session expired picker on resume when the session died and another account exists', function (): void {
    AccountSeeding::seed('s7654321');
    $failing = Account::query()->where('username', 's1234567')->firstOrFail();
    AccountSeeding::activate($failing);
    $screen = showCourse();

    app(UUSessionStore::class)->forget($failing->id);
    CourseUpstreamFake::install(['action=login' => Http::response(['code' => 403, 'message' => 'Auth fail', 'data' => []])]);

    $screen->call('onResume')->assertSet('sessionPickerVisible', true)->assertSet('sessionPickerFailedAccountId', $failing->id);
});

it('sends no request for tabs that were never opened', function (): void {
    showCourse();

    Http::assertNotSent(fn (Request $request): bool => str_contains($request->url(), 'homework_list.php'));
    Http::assertNotSent(fn (Request $request): bool => str_contains($request->url(), 'get-board-list'));
});

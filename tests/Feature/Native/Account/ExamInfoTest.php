<?php

declare(strict_types=1);

use AltUU\Domains\SchoolPortal\Actions\GetExamAgenda;
use AltUU\Domains\SchoolPortal\ViewModels\SchoolPortalExamAgendaItemViewModel;
use App\NativeComponents\Account\ExamInfo;
use App\Services\AccountCredentialsStore;
use App\Services\SchoolPortalSessionStore;
use App\Services\UUSessionStore;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;
use Native\Mobile\Testing\Native;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Tests\Feature\Native\Fixtures\AccountSeeding;

beforeEach(function (): void {
    $this->account = AccountSeeding::seed('u1001');
    AccountSeeding::activate($this->account);

    $portal = Mockery::mock(SchoolPortalSessionStore::class);
    $portal->shouldReceive('get')->andReturn([
        'base_url' => 'https://nouapp.nou.edu.tw',
        'ua' => 'test-agent',
        'cookies' => ['session' => 'abc'],
    ]);
    $portal->shouldReceive('put');
    app()->instance(SchoolPortalSessionStore::class, $portal);
});

function examInfoPortalPage(): array
{
    return [
        'https://nouapp.nou.edu.tw/device/compliant/qryexm/index' => Http::response(
            <<<'HTML'
            <?xml version="1.0" encoding="UTF-8"?><html xmlns="http://www.w3.org/1999/xhtml"><body><div id="container"><div class="year-box"><div class="year">115學年上學期</div></div><div class="accordion" id="accordion-courses-exmtime"><div class="accordion-item"><h2 class="accordion-header"><button class="accordion-button" type="button">考試時間</button></h2><div class="accordion-body p-0"><div class="accordion" id="accordion-courses"><div class="accordion-item"><h2 class="accordion-header"><button class="accordion-button" type="button">期中考(正考)</button></h2><div class="accordion-body p-0"><div class="title">◉ 假課程甲</div><div class="detail"><div>日期：2026年11月07日(星期六)</div></div><div class="detail"><div>時間：1500~1610第5節</div></div><div class="detail"><div>教室代號：41Z101</div></div><div class="title">◉ 假課程丙</div><div class="detail"><div>說明：統一命題非集中考試</div></div></div></div><div class="accordion-item"><h2 class="accordion-header"><button class="accordion-button" type="button">期末考(正考)</button></h2><div class="accordion-body p-0"><div class="title">◉ 假課程乙</div><div class="detail"><div>日期：2026年11月05日(星期三)</div></div><div class="detail"><div>時間：0900~1040第2節</div></div><div class="detail"><div>教室代號：41Z102</div></div></div></div><div class="accordion-item"><h2 class="accordion-header"><button class="accordion-button" type="button">期中考(補考)</button></h2><div class="accordion-body p-0"><div class="title">◉ 假課程甲</div><div class="detail"><div>日期：2026年12月01日(星期二)</div></div><div class="detail"><div>時間：1000~1140</div></div><div class="detail"><div>教室代號：41Z103</div></div></div></div></div></div></div></div></div></body></html>
            HTML,
        ),
    ];
}

function examInfoFailsWith(Throwable $exception): void
{
    app()->bind(GetExamAgenda::class, fn (): object => new class($exception)
    {
        public function __construct(private Throwable $exception) {}

        public function __invoke(): never
        {
            throw $this->exception;
        }
    });
}

it('lists regular exams grouped by kind and date with formatted times', function (): void {
    Http::fake(examInfoPortalPage());

    Native::test(ExamInfo::class)
        ->assertSee('期中考')
        ->assertDontSee('期中考(正考)')
        ->assertSee('期末考')
        ->assertSee('2026年11月07日(星期六)')
        ->assertSee('假課程甲')
        ->assertSee('第五節 – 15:00~16:10')
        ->assertSee('41Z101')
        ->assertSee('假課程乙')
        ->assertSee('第二節 – 09:00~10:40')
        ->assertDontSee('假課程丙')
        ->assertDontSee('查無考試資訊。');
});

it('shows the empty state when the portal has no exam info', function (): void {
    Http::fake(['https://nouapp.nou.edu.tw/*' => Http::response('', 500)]);

    Native::test(ExamInfo::class)->assertSee('查無考試資訊。');
});

it('shows a retry card on failure and reloads on retry', function (): void {
    examInfoFailsWith(new RuntimeException('parse blew up'));

    $screen = Native::test(ExamInfo::class)
        ->assertSet('error', '載入考試資訊失敗')
        ->assertSee('載入考試資訊失敗')
        ->assertDontSee('查無考試資訊。');

    app()->offsetUnset(GetExamAgenda::class);
    Http::fake(examInfoPortalPage());

    $screen->tap('retry')
        ->assertSet('error', '')
        ->assertSee('假課程乙');
});

it('shows the connectivity message when the device is offline', function (): void {
    examInfoFailsWith(new ConnectionException('offline'));

    Native::test(ExamInfo::class)
        ->assertSet('error', '外部服務暫時無法連線，請稍後再試。');
});

it('opens the session picker when the portal reports an expired session', function (): void {
    AccountSeeding::seed('u2002');
    AccountSeeding::activate($this->account);
    $accountId = $this->account->id;
    app()->bind(GetExamAgenda::class, fn (): object => new class($accountId)
    {
        public function __construct(private int $accountId) {}

        public function __invoke(): never
        {
            app(UUSessionStore::class)->forget($this->accountId);

            throw new HttpException(401);
        }
    });
    Http::fake([
        'https://uu.nou.edu.tw/xmlapi/index.php?action=login*' => Http::response(['code' => 403, 'message' => 'Auth fail', 'data' => []]),
    ]);

    Native::test(ExamInfo::class)
        ->assertSet('sessionPickerVisible', true)
        ->assertSet('sessionPickerFailedAccountId', $this->account->id)
        ->assertElement('bottom_sheet', fn (array $node): bool => ($node['props']['visible'] ?? null) === true);
});

it('shows the error card for a 401 while the session is still valid', function (): void {
    examInfoFailsWith(new HttpException(401));

    Native::test(ExamInfo::class)->assertSet('error', '載入考試資訊失敗');
});

it('sends a device with no usable session to login', function (): void {
    app(UUSessionStore::class)->forget($this->account->id);
    app(AccountCredentialsStore::class)->forget($this->account->id);

    Native::test(ExamInfo::class)->assertReplacedWith('/native/login');
});

it('orders unknown exam kinds after the midterm and final', function (): void {
    $items = [
        new SchoolPortalExamAgendaItemViewModel('丁', '專題考(正考)', '2026年12月01日(星期二)', '1900~2050'),
        new SchoolPortalExamAgendaItemViewModel('乙', '期末考(正考)', '2026年11月05日(星期三)', '0900~1040第2節'),
        new SchoolPortalExamAgendaItemViewModel('甲', '期中考(正考)', null, '1500~1610'),
    ];

    $groups = Native::test(ExamInfo::class)->set('items', $items)->instance()->examGroups();

    expect(array_column($groups, 'label'))->toBe(['期中考', '期末考', '專題考'])
        ->and($groups[0]['dateGroups'][0]['date'])->toBe('');
});

it('formats school portal time ranges', function (?string $raw, ?string $expected): void {
    expect(ExamInfo::formatTimeRange($raw))->toBe($expected);
})->with([
    'period and range' => ['1500~1610第5節', '第五節 – 15:00~16:10'],
    'tenth' => ['1500~1610第10節', '第十節 – 15:00~16:10'],
    'twelfth' => ['1500~1610第12節', '第十二節 – 15:00~16:10'],
    'range only' => ['1900~2050', '19:00~20:50'],
    'unparseable' => ['下午', '下午'],
    'missing' => [null, null],
]);

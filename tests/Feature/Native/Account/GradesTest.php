<?php

declare(strict_types=1);

use AltUU\Domains\SchoolPortal\Actions\GetAllCourseGrades;
use App\Models\Account;
use App\NativeComponents\Account\Grades;
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

function gradesPortalPages(): array
{
    return [
        'https://nouapp.nou.edu.tw/device/compliant/qryscore/index' => Http::response(
            <<<'HTML'
            <?xml version="1.0" encoding="UTF-8"?><html xmlns="http://www.w3.org/1999/xhtml"><body><div id="container"><div class="year-box"><div class="year">114學年下學期</div></div><div class="accordion"><div class="accordion-item"><h2 class="accordion-header"><button class="accordion-button" type="button">假課程甲</button></h2><div class="accordion-body p-0"><div class="detail">學分數：<span class="">3</span></div><div class="detail">期中成績：<span class="">70</span></div><div class="detail">學期成績：<span class="">無資料</span></div></div></div></div></div></body></html>
            HTML,
        ),
        'https://nouapp.nou.edu.tw/device/compliant/qryscore2/index' => Http::response(
            <<<'HTML'
            <?xml version="1.0" encoding="UTF-8"?><html xmlns="http://www.w3.org/1999/xhtml"><body><div id="container"><div class="accordion"><div class="accordion-item"><h2 class="accordion-header"><button class="accordion-button" type="button">115暑期：總計修讀 2 學分</button></h2><div class="accordion-body p-0"><div class="detail">假課程乙：<span class="">63</span> (2學分)</div><div class="detail">假課程丙：<span class="">45</span> (2學分)</div></div></div><div class="accordion-item"><h2 class="accordion-header"><button class="accordion-button" type="button">114下學期：總計修讀 3 學分</button></h2><div class="accordion-body p-0"><div class="detail">假課程甲：<span class="">無資料</span> (3學分)</div></div></div></div></div></body></html>
            HTML,
        ),
    ];
}

it('lists grades grouped by semester with pass and fail scores', function (): void {
    Http::fake(gradesPortalPages());

    Native::test(Grades::class)
        ->assertSee('115暑期')
        ->assertSee('假課程乙')
        ->assertSee('63')
        ->assertSee('假課程丙')
        ->assertSee('45')
        ->assertSee('114學年下學期')
        ->assertSee('假課程甲')
        ->assertSee('期中成績')
        ->assertSee('70')
        ->assertSee('學分數')
        ->assertSee('無資料')
        ->assertDontSee('查無成績資料。');
});

it('marks scores of 60 and above as passing', function (): void {
    expect(Grades::isScorePassing('60'))->toBeTrue()
        ->and(Grades::isScorePassing('59'))->toBeFalse()
        ->and(Grades::isScorePassing('無資料'))->toBeFalse()
        ->and(Grades::isScorePassing(null))->toBeFalse();
});

it('titles the screen for the layout nav bar', function (): void {
    Http::fake(gradesPortalPages());

    expect(Native::test(Grades::class)->instance()->navTitle())->toBe('我的成績');
});

it('shows the empty state when the portal has no grades', function (): void {
    Http::fake([
        'https://nouapp.nou.edu.tw/*' => Http::response('', 500),
    ]);

    Native::test(Grades::class)->assertSee('查無成績資料。');
});

it('shows a retry card on failure and reloads on retry', function (): void {
    app()->bind(GetAllCourseGrades::class, fn (): object => new class
    {
        public function __invoke(): never
        {
            throw new RuntimeException('parse blew up');
        }
    });

    $screen = Native::test(Grades::class)
        ->assertSet('error', '載入成績失敗')
        ->assertSee('載入成績失敗')
        ->assertDontSee('查無成績資料。');

    app()->forgetInstance(GetAllCourseGrades::class);
    app()->offsetUnset(GetAllCourseGrades::class);
    Http::fake(gradesPortalPages());

    $screen->tap('retry')
        ->assertSet('error', '')
        ->assertSee('假課程乙');
});

it('shows the connectivity message when the device is offline', function (): void {
    app()->bind(GetAllCourseGrades::class, fn (): object => new class
    {
        public function __invoke(): never
        {
            throw new ConnectionException('offline');
        }
    });

    Native::test(Grades::class)
        ->assertSet('error', '外部服務暫時無法連線，請稍後再試。')
        ->assertSee('重試');
});

it('opens the session picker when the school portal reports an expired session', function (): void {
    $other = AccountSeeding::seed('u2002');
    AccountSeeding::activate($this->account);

    $accountId = $this->account->id;
    app()->bind(GetAllCourseGrades::class, fn (): object => new class($accountId)
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

    Native::test(Grades::class)
        ->assertSet('sessionPickerVisible', true)
        ->assertSet('sessionPickerFailedAccountId', $this->account->id)
        ->assertSet('error', '')
        ->assertElement('bottom_sheet', fn (array $node): bool => ($node['props']['visible'] ?? null) === true);

    expect(Account::query()->whereKey($other->id)->exists())->toBeTrue();
});

it('sends a device with no usable session to login', function (): void {
    app(UUSessionStore::class)->forget($this->account->id);
    app(AccountCredentialsStore::class)->forget($this->account->id);

    Native::test(Grades::class)->assertReplacedWith('/native/login');
});

it('sends an expired account without alternatives to reauth', function (): void {
    app(UUSessionStore::class)->forget($this->account->id);
    Http::fake([
        'https://uu.nou.edu.tw/xmlapi/index.php?action=login*' => Http::response(['code' => 403, 'message' => 'Auth fail', 'data' => []]),
    ]);

    Native::test(Grades::class)->assertReplacedWith('/native/reauth/'.$this->account->id);
});

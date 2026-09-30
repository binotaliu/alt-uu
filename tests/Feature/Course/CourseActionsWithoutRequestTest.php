<?php

declare(strict_types=1);

use AltUU\Domains\AttachmentDownload\Actions\CleanupAttachmentDownloads;
use AltUU\Domains\AttachmentDownload\Actions\QueueAttachmentDownload;
use AltUU\Domains\AttachmentDownload\DataTransferObjects\QueueAttachmentDownloadInputData;
use AltUU\Domains\Auth\Actions\GetSessionProfile;
use AltUU\Domains\Course\Actions\GetCourseHomeworks;
use AltUU\Domains\Course\Actions\GetNodeResources;
use AltUU\Domains\Course\Actions\ListCourses;
use AltUU\Domains\Course\Actions\SyncCurrentCourse;
use App\Jobs\DownloadAttachmentJob;
use App\Models\Account;
use App\Services\AccountActiveProfile;
use App\Services\UUSessionStore;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Symfony\Component\HttpKernel\Exception\HttpException;

function seedCourseActionAccount(string $baseUrl = 'https://uu.nou.edu.tw', string $username = 's1234567'): Account
{
    $account = Account::factory()->create(['username' => $username]);
    app(AccountActiveProfile::class)->set($account->id);
    app(UUSessionStore::class)->put([
        'base_url' => $baseUrl,
        'ua' => 'test-agent',
        'ticket' => 'ticket-1',
        'session_idx' => 'idx-1',
        'cookies' => ['WM' => 'cookie'],
        'profile' => ['display_name' => '測試學生', 'username' => $username, 'picture' => '', 'realname' => '測試學生'],
    ], $account->id);

    return $account;
}

it('lists courses without a request, caching by the session profile username', function () {
    seedCourseActionAccount();
    session()->put('hungu.profile.username', 's1234567');
    Http::fake([
        'https://uu.nou.edu.tw/xmlapi/index.php?action=my-course-list*' => Http::response([
            'code' => 0,
            'data' => ['list' => [['course_id' => '1001', 'title' => '(114下)行動學習導論-ZZZ001班']]],
        ]),
    ]);

    $items = app(ListCourses::class)()->items();

    expect($items)->toHaveCount(1)
        ->and($items[0]->courseId)->toBe('1001')
        ->and(Cache::has('alt-uu:courses:list:s1234567'))->toBeTrue();
});

it('lists courses for an explicit account id, caching by account', function () {
    $account = seedCourseActionAccount();
    Http::fake([
        'https://uu.nou.edu.tw/xmlapi/index.php?action=my-course-list*' => Http::response([
            'code' => 0,
            'data' => ['list' => [['course_id' => '1001', 'title' => '(114下)行動學習導論-ZZZ001班']]],
        ]),
    ]);

    app(ListCourses::class)($account->id);

    expect(Cache::has("alt-uu:courses:list:account:{$account->id}"))->toBeTrue();
});

it('falls back to the anonymous cache key when no profile is primed', function () {
    seedCourseActionAccount();
    Http::fake([
        'https://uu.nou.edu.tw/xmlapi/index.php?action=my-course-list*' => Http::response([
            'code' => 0,
            'data' => ['list' => [['course_id' => '1001', 'title' => '(114下)行動學習導論-ZZZ001班']]],
        ]),
    ]);

    app(ListCourses::class)();

    expect(Cache::has('alt-uu:courses:list:anonymous'))->toBeTrue();
});

it('remembers loaded node resources in the session instead of refetching', function () {
    $account = seedCourseActionAccount();
    Http::fake([
        'https://uu.nou.edu.tw/xmlapi/index.php?action=course-node-resources*' => Http::response([
            'code' => 0,
            'data' => ['list' => [['title' => '講義', 'url' => 'https://uu.nou.edu.tw/a.pdf']]],
        ]),
    ]);

    $first = app(GetNodeResources::class)('1001', '2001')->items();
    $second = app(GetNodeResources::class)('1001', '2001')->items();

    expect($first)->toHaveCount(1)
        ->and($second)->toHaveCount(1)
        ->and(session("alt-uu:courses:node-resources:{$account->id}.1001.2001.loaded"))->toBeTrue();
    Http::assertSentCount(1);
});

it('syncs the current course once and remembers it per account in the session', function () {
    $account = seedCourseActionAccount();
    Http::fake([
        'https://uu.nou.edu.tw/xmlapi/index.php?action=go-course*' => Http::response(['code' => 0, 'data' => []]),
        'https://uu.nou.edu.tw/*' => Http::response('<script>var browserTabIdx = "tab-9";</script>'),
    ]);

    $sync = app(SyncCurrentCourse::class);
    $sync('1001');

    expect(session("hungu.current_course_id.{$account->id}"))->toBe('1001');
    $sent = count(Http::recorded());

    $sync('1001');
    expect(count(Http::recorded()))->toBe($sent);

    $sync('1001', force: true);
    expect(count(Http::recorded()))->toBeGreaterThan($sent);
});

it('resolves homework urls against the active account base url without a request', function () {
    seedCourseActionAccount('https://uu-b.nou.edu.tw');
    Http::fake([
        'https://uu-b.nou.edu.tw/learn/homework/homework_list.php' => Http::response(<<<'HTML'
            <html><body>
                <div class="box2" data-type="homework">
                    <div class="title"><span title="假課程-作業 A">假課程-作業 A</span></div>
                    <div class="content"><div class="data5 mooc-process">
                        <div class="process-btn pay active" onclick="togo('200001+1+tokenabc', false, this)">
                            <div class="level1"><div class="main-text">進行作業</div><div class="sub-text">從 2026-01-01 00:00 到 2026-01-31 23:59</div></div>
                        </div>
                    </div></div>
                </div>
            </body></html>
            HTML),
    ]);

    $items = app(GetCourseHomeworks::class)()->items();

    expect($items)->toHaveCount(1)
        ->and($items[0]->actionUrl)->toStartWith('https://uu-b.nou.edu.tw/learn/homework/');
});

it('queues an attachment download only for the active account host, without a request', function () {
    Queue::fake();
    seedCourseActionAccount();

    $task = app(QueueAttachmentDownload::class)(
        new QueueAttachmentDownloadInputData(
            cid: '1001',
            sourceUrl: 'https://uu.nou.edu.tw/learn/attachment/sample.pdf',
            filename: 'sample.pdf',
        ),
        app(CleanupAttachmentDownloads::class),
    );

    expect($task->fileName)->toBe('sample.pdf');
    Queue::assertPushed(DownloadAttachmentJob::class, 1);

    app(QueueAttachmentDownload::class)(
        new QueueAttachmentDownloadInputData(
            cid: '1001',
            sourceUrl: 'https://evil.example.com/sample.pdf',
            filename: 'sample.pdf',
        ),
        app(CleanupAttachmentDownloads::class),
    );
})->throws(HttpException::class, '不允許存取外部資源');

it('reads the session profile from the account when the laravel session is empty', function () {
    seedCourseActionAccount(username: 's7654321');

    $profile = app(GetSessionProfile::class)();

    expect($profile->username)->toBe('s7654321')
        ->and($profile->displayName)->toBe('測試學生');
});

it('prefers the primed laravel session profile', function () {
    seedCourseActionAccount(username: 's7654321');
    session()->put('hungu.profile', ['display_name' => 'Primed', 'username' => 'primed', 'picture' => '']);

    expect(app(GetSessionProfile::class)()->username)->toBe('primed');
});

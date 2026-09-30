<?php

declare(strict_types=1);

use AltUU\Domains\Discuss\ViewModels\NodeViewModel;
use App\Models\Account;
use App\Models\BlockedContent;
use App\NativeComponents\Courses\DiscussBoard;
use App\Services\AccountActiveProfile;
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

function openBoard(string $bid = 'B-1'): TestableComponent
{
    return Native::test(DiscussBoard::class, params: ['cid' => '1001', 'boardCid' => '1001', 'bid' => $bid]);
}

it('lists the posts with unread markers, poster, replies and likes', function (): void {
    openBoard()
        ->assertNavTitle('行動學習導論')
        ->assertSee('文章列表')
        ->assertSee('第一週問題')
        ->assertSee('未讀')
        ->assertSee('王小明 · 2 則回覆')
        ->assertSee('4')
        ->assertSee('期中考範圍');
});

it('opens the thread of a post', function (): void {
    openBoard()->tap('node-N-2')->assertNavigatedTo('/native/courses/1001/discuss/1001/B-1/N-2');
});

it('offers a compose action only on boards that allow posting', function (): void {
    $writable = openBoard()->tree();
    $bulletin = openBoard('B-2')->tree();

    expect(json_encode($writable))->toContain('compose')
        ->and(json_encode($bulletin))->not->toContain('"id":"compose"');
});

it('hides blocked posts until the user reveals them', function (): void {
    BlockedContent::query()->create([
        'board_hash' => hash('sha256', 'B-1'),
        'node_hash' => hash('sha256', 'N-1'),
        'reason' => 's',
        'blocked_at' => now(),
    ]);
    $board = openBoard();
    $board->assertSee('本內容經檢舉已在 Alt UU 中隱藏')->assertSee('垃圾訊息')->assertDontSee('第一週問題');

    $board->tap('reveal-N-1')->assertSee('第一週問題')->assertDontSee('本內容經檢舉已在 Alt UU 中隱藏');
});

it('falls back to 其他 for unknown block reasons', function (): void {
    expect(openBoard()->instance()->reasonLabel('zzz'))->toBe('其他')
        ->and(openBoard()->instance()->reasonLabel(null))->toBe('其他');
});

it('shows an empty state when the board has no posts', function (): void {
    CourseUpstreamFake::install(['action=get-board-node-list' => Http::response(['code' => 0, 'data' => ['list' => []]])]);

    openBoard()->assertSee('目前沒有可顯示的文章主題。');
});

it('shows an error card and recovers on retry', function (): void {
    CourseUpstreamFake::install(['action=get-board-node-list' => new ConnectionException('offline')]);
    $board = openBoard()->assertSee('重試');

    CourseUpstreamFake::install();
    $board->tap('retry')->assertSee('第一週問題');
});

it('reports the school system as unreachable when offline', function (): void {
    CourseUpstreamFake::install(['action=get-board-list' => new ConnectionException('offline')]);

    openBoard()->assertSee('外部服務暫時無法連線，請稍後再試。');
});

it('creates a post, closes the sheet and reloads the list', function (): void {
    $board = openBoard()->call('openCompose')->assertSet('composeVisible', true);
    $board->set('newSubject', '')->set('newContent', "第一行\n第二行");

    CourseUpstreamFake::install(['action=add-course-post' => Http::response(['code' => 0, 'data' => []])]);
    $board->tap('submit')->assertSet('composeVisible', false)->assertSet('newContent', '');

    Http::assertSent(function (Request $request): bool {
        $body = json_decode($request->body(), true);

        return str_contains($request->url(), 'action=add-course-post') && $body['subject'] === '新文章' && str_contains($body['content'], '第一行<br />');
    });
});

it('refuses an empty post without sending anything', function (): void {
    $board = openBoard()->call('openCompose')->set('newContent', '   ')->tap('submit')->assertSet('composeVisible', true)->assertSee('請輸入文章內容。');

    Http::assertNotSent(fn (Request $request): bool => str_contains($request->url(), 'add-course-post'));
    expect($board->get('submitting'))->toBeFalse();
});

it('keeps the sheet open and shows the failure when posting fails', function (): void {
    $board = openBoard()->call('openCompose')->set('newContent', '你好');
    CourseUpstreamFake::install(['action=add-course-post' => new ConnectionException('offline')]);

    $board->tap('submit')->assertSet('composeVisible', true)->assertSet('newContent', '你好')->assertSee('外部服務暫時無法連線，請稍後再試。');
});

it('refuses to compose on a bulletin board', function (): void {
    openBoard('B-2')->call('openCompose')->assertSet('composeVisible', false)->call('submitPost')->assertSee('本討論板禁止發文。');
});

it('cancels the compose sheet', function (): void {
    openBoard()->call('openCompose')->tap('cancel')->assertSet('composeVisible', false);
});

it('reloads the list on resume so read markers update', function (): void {
    $board = openBoard()->assertSee('未讀');
    CourseUpstreamFake::install(['action=get-board-node-list' => Http::response(['code' => 0, 'data' => ['list' => [
        ['node' => 'N-1', 'subject' => '第一週問題', 'read' => 1, 'realname' => '王小明', 'reply' => 2, 'push' => 4],
    ]]])]);

    $board->call('onResume')->assertDontSee('未讀')->assertDontSee('期中考範圍');
});

it('keeps the list when a silent reload fails', function (): void {
    $board = openBoard();
    CourseUpstreamFake::install(['action=get-board-node-list' => new ConnectionException('offline')]);

    $board->call('onResume')->assertSee('第一週問題')->assertSet('error', '');
});

it('replaces the screen with the login screen when signed out', function (): void {
    app(AccountActiveProfile::class)->clear();
    Account::query()->delete();

    openBoard()->assertReplacedWith('/native/login');
});

it('has a node view model default that stays unblocked', function (): void {
    expect((new NodeViewModel(node: 'x', subject: 's'))->isBlocked)->toBeFalse();
});

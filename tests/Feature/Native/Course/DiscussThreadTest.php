<?php

declare(strict_types=1);

use AltUU\Domains\AppPreference\AppPreferenceStore;
use AltUU\Domains\Discuss\Actions\ListPosts;
use App\Models\Account;
use App\Models\AttachmentDownload;
use App\Models\BlockedContent;
use App\Models\BlockedUser;
use App\NativeComponents\Courses\Discuss\PostText;
use App\NativeComponents\Courses\DiscussThread;
use App\Services\AccountActiveProfile;
use App\Services\UUSessionStore;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Native\Mobile\Testing\Native;
use Native\Mobile\Testing\TestableComponent;
use Tests\Feature\Native\Course\CourseUpstreamFake;
use Tests\Feature\Native\Fixtures\AccountSeeding;

beforeEach(function (): void {
    Queue::fake();
    AccountSeeding::activate(AccountSeeding::seed('s1234567'));
    installThreadUpstream();
});

/**
 * @param  array<string, mixed>  $overrides
 */
function installThreadUpstream(array $overrides = [], ?array $posts = null): void
{
    CourseUpstreamFake::install([
        'action=get-board-node-list' => Http::response(['code' => 0, 'data' => ['list' => [
            ['node' => 'N-1', 'subject' => '第一週問題', 'read' => 0, 'realname' => '王小明', 'reply' => 2, 'push' => 4],
        ]]]),
        'action=get-board-reply-list' => Http::response(['code' => 0, 'data' => ['list' => $posts ?? threadPosts()]]),
        'act=get' => Http::response(['code' => 0, 'data' => ['list' => [
            ['wid' => 'W-1', 'sid' => '9', 'creator' => 's1234567', 'realname' => '我', 'content' => '我的留言&lt;3<br />第二行', 'create_time' => '2026-03-02 10:00', 'can_delete' => true],
            ['wid' => 'W-2', 'sid' => '8', 'creator' => 's7', 'realname' => '別人', 'content' => '別人的留言', 'create_time' => '2026-03-02 11:00', 'can_delete' => false],
        ]]]),
        'action=set-forum-read' => Http::response(['code' => 0, 'data' => []]),
        ...$overrides,
    ]);
}

/**
 * @return array<int, array<string, mixed>>
 */
function threadPosts(): array
{
    return [
        [
            'floor' => 1, 'node' => 'P-1', 'subject' => '第一週問題', 'content' => '<p>第一則貼文</p><p>第二段</p>',
            'poster' => 's-wang', 'realname' => '王小明', 'post_date' => '2026-03-01 09:00', 'push' => 2, 'i_pushed' => false, 'whispercnt' => 2,
            'attachment' => [
                ['filename' => 'pic.png', 'href' => 'https://uu.nou.edu.tw/files/pic.png'],
                ['filename' => '講義.pdf', 'href' => 'https://uu.nou.edu.tw/files/handout.pdf'],
            ],
        ],
        [
            'floor' => 2, 'node' => 'P-2', 'subject' => '回覆', 'content' => '<p>看 <a href="https://example.com/x">這個連結</a></p>',
            'poster' => 's-li', 'realname' => '李老師', 'post_date' => '2026-03-01 10:00', 'push' => 0, 'i_pushed' => true, 'whispercnt' => 0,
        ],
    ];
}

function openThread(string $nid = 'N-1'): TestableComponent
{
    return Native::test(DiscussThread::class, params: ['cid' => '1001', 'boardCid' => '1001', 'bid' => 'B-1', 'nid' => $nid]);
}

/**
 * @return list<array<string, mixed>>
 */
function threadHtmlViews(TestableComponent $screen): array
{
    $found = [];
    $walk = function (array $node) use (&$walk, &$found): void {
        if (($node['type'] ?? null) === 'html_view') {
            $found[] = $node;
        }

        foreach ($node['children'] ?? [] as $child) {
            $walk($child);
        }
    };
    $walk($screen->tree());

    return $found;
}

function threadLinkTap(TestableComponent $screen, string $url): TestableComponent
{
    return $screen->fireEvent('onLinkTap', TestableComponent::EVENT_TEXT_CHANGE, [
        'text' => json_encode(['url' => $url, 'scheme' => (string) parse_url($url, PHP_URL_SCHEME), 'newWindow' => false], JSON_THROW_ON_ERROR),
    ]);
}

it('renders the thread with floors, authors, likes and whispers', function (): void {
    openThread()
        ->assertNavTitle('行動學習導論')
        ->assertSee('課程討論')
        ->assertSee('第一週問題')
        ->assertSee('樓層 1 · 王小明 · 2026-03-01 09:00')
        ->assertSee('第一則貼文')
        ->assertSee('第二段')
        ->assertSee('樓層 2 · 李老師 · 2026-03-01 10:00')
        ->assertSee('留言 (2)')
        ->assertSee('別人的留言')
        ->assertSee('附件 (2)')
        ->assertSee('講義.pdf');
});

it('renders plain posts as native text and rich posts through the html view', function (): void {
    $screen = openThread();
    $views = threadHtmlViews($screen);

    expect($views)->toHaveCount(1)
        ->and($views[0]['props']['html'])->toContain('這個連結')
        ->and($views[0]['props']['auto_height'])->toBeTrue();
});

it('passes the resolved appearance preference to the html view', function (): void {
    app(AppPreferenceStore::class)->setAppearance('dark');

    expect(openThread()->get('appearance'))->toBe('dark');
});

it('follows the device when the appearance preference is system', function (): void {
    expect(openThread()->get('appearance'))->toBe('auto');
});

it('marks the thread as read on the school side once', function (): void {
    openThread();

    Http::assertSent(fn (Request $request): bool => str_contains($request->url(), 'action=set-forum-read') && str_contains($request->url(), 'postid=N-1'));
});

it('does not fail the thread when marking it read fails', function (): void {
    installThreadUpstream(['action=set-forum-read' => new ConnectionException('offline')]);

    openThread()->assertSee('第一則貼文');
});

it('falls back to the first subject when the thread node is not listed', function (): void {
    installThreadUpstream(['action=get-board-node-list' => Http::response(['code' => 0, 'data' => ['list' => []]])]);

    expect(openThread('N-9')->instance()->threadTitle())->toBe('第一週問題');
});

it('shows the empty state for a thread without floors', function (): void {
    installThreadUpstream(posts: []);

    openThread()->assertSee('目前沒有可顯示的討論內容。');
});

it('shows an error card when offline and recovers on retry', function (): void {
    installThreadUpstream(['action=get-board-reply-list' => new ConnectionException('offline')]);
    $screen = openThread()->assertSee('外部服務暫時無法連線，請稍後再試。')->assertSee('重試');

    installThreadUpstream();
    $screen->tap('retry')->assertSee('第一則貼文');
});

it('only draws the first floors of a long thread and reveals more on demand', function (): void {
    $many = array_map(fn (int $i): array => [
        'floor' => $i, 'node' => "P-{$i}", 'content' => "<p>內容{$i}</p>", 'poster' => "s{$i}", 'realname' => "同學{$i}", 'post_date' => '2026-03-01',
    ], range(1, 20));
    installThreadUpstream(posts: $many);

    $screen = openThread()->assertSee('內容15')->assertDontSee('內容16')->assertSee('顯示更多樓層（還有 5 則）');
    $screen->tap('show-more')->assertSee('內容20')->assertDontSee('顯示更多樓層');
});

// ── replies ────────────────────────────────────────────────────────────────

it('posts a reply to the thread node and reloads', function (): void {
    $screen = openThread();
    expect(json_encode($screen->tree()))->toContain('"id":"reply"');
    $screen->call('openReply')->assertSet('replyVisible', true);
    $screen->set('replySubject', '')->set('replyContent', "我的回覆\n第二行");

    installThreadUpstream(['action=add-course-post' => Http::response(['code' => 0, 'data' => []])]);
    $screen->tap('reply-submit')->assertSet('replyVisible', false)->assertSet('replyContent', '');

    Http::assertSent(function (Request $request): bool {
        $body = json_decode($request->body(), true);

        return str_contains($request->url(), 'action=add-course-post')
            && $body['subject'] === '回覆'
            && $body['reply_post_id'] === 'B-1_N-1'
            && str_contains($body['content'], '我的回覆<br />');
    });
});

it('refuses an empty reply', function (): void {
    $screen = openThread()->call('openReply')->set('replyContent', '  ')->tap('reply-submit')->assertSee('請輸入回覆內容。')->assertSet('replyVisible', true);

    Http::assertNotSent(fn (Request $request): bool => str_contains($request->url(), 'add-course-post'));
    expect($screen->get('replySubmitting'))->toBeFalse();
});

it('keeps the reply sheet open when sending fails', function (): void {
    $screen = openThread()->call('openReply')->set('replyContent', '你好');
    installThreadUpstream(['action=add-course-post' => new ConnectionException('offline')]);

    $screen->tap('reply-submit')->assertSet('replyVisible', true)->assertSet('replyContent', '你好')->assertSee('外部服務暫時無法連線，請稍後再試。');
});

// ── likes ──────────────────────────────────────────────────────────────────

it('likes a post optimistically and calls the like endpoint', function (): void {
    $screen = openThread();
    installThreadUpstream(['forum_ajax.php' => Http::response(['code' => 0, 'data' => []])], threadPosts());

    $screen->tap('like-1');

    Http::assertSent(fn (Request $request): bool => str_contains($request->url(), 'forum_ajax.php') && str_contains($request->body(), 'firstPush=1'));
});

it('unlikes an already liked post', function (): void {
    $screen = openThread();
    installThreadUpstream(['forum_ajax.php' => Http::response(['code' => 0, 'data' => []])]);

    $screen->tap('like-2');

    Http::assertSent(fn (Request $request): bool => str_contains($request->url(), 'forum_ajax.php') && str_contains($request->body(), 'firstPush=0'));
});

it('reverts the optimistic like and toasts when the like fails', function (): void {
    $screen = openThread();
    installThreadUpstream(['forum_ajax.php' => new ConnectionException('offline'), 'action=get-board-reply-list' => new ConnectionException('offline')]);

    $screen->tap('like-1');

    expect($screen->instance()->posts[0]->push)->toBe(2)
        ->and($screen->instance()->posts[0]->liked)->toBeFalse();
});

// ── whispers ───────────────────────────────────────────────────────────────

it('adds a whisper and reloads', function (): void {
    $screen = openThread()->tap('whisper-add-1')->assertSet('whisperVisible', true)->assertSet('whisperNodeId', 'P-1')->assertSee('留言於：樓層 1');
    $screen->set('whisperContent', '謝謝分享');

    installThreadUpstream(['act=set' => Http::response(['code' => 0, 'data' => []])]);
    $screen->tap('whisper-submit')->assertSet('whisperVisible', false);

    Http::assertSent(fn (Request $request): bool => str_contains($request->url(), 'act=set') && json_decode($request->body(), true)['content'] === '謝謝分享');
});

it('refuses an empty whisper', function (): void {
    openThread()->tap('whisper-add-1')->tap('whisper-submit')->assertSee('請輸入留言內容。')->assertSet('whisperVisible', true);

    Http::assertNotSent(fn (Request $request): bool => str_contains($request->url(), 'act=set'));
});

it('only offers edit and delete on whispers the school allows to delete', function (): void {
    $tree = json_encode(openThread()->tree());

    expect(str_contains($tree, 'whisper-edit-W-1'))->toBeTrue()
        ->and(str_contains($tree, 'whisper-delete-W-1'))->toBeTrue()
        ->and(str_contains($tree, 'whisper-edit-W-2'))->toBeFalse()
        ->and(str_contains($tree, 'whisper-delete-W-2'))->toBeFalse();
});

it('edits a whisper with the decoded text prefilled', function (): void {
    $screen = openThread()->tap('whisper-edit-W-1')
        ->assertSet('whisperId', 'W-1')
        ->assertSet('whisperContent', "我的留言<3\n第二行");
    $screen->set('whisperContent', '改過的留言');

    installThreadUpstream(['act=mod' => Http::response(['code' => 0, 'data' => []])]);
    $screen->tap('whisper-submit')->assertSet('whisperVisible', false);

    Http::assertSent(function (Request $request): bool {
        $body = json_decode($request->body(), true);

        return str_contains($request->url(), 'act=mod') && $body['wid'] === 'W-1' && $body['content'] === '改過的留言';
    });
});

it('deletes a whisper only after confirming', function (): void {
    $screen = openThread()->tap('whisper-delete-W-1')->assertSet('deleteWhisperVisible', true);
    Http::assertNotSent(fn (Request $request): bool => str_contains($request->url(), 'act=del'));

    installThreadUpstream(['act=del' => Http::response(['code' => 0, 'data' => []])]);
    $screen->call('confirmDeleteWhisper')->assertSet('deleteWhisperVisible', false);

    Http::assertSent(fn (Request $request): bool => str_contains($request->url(), 'act=del') && json_decode($request->body(), true)['wid'] === 'W-1');
});

it('can cancel deleting a whisper', function (): void {
    openThread()->tap('whisper-delete-W-1')->call('cancelDeleteWhisper')->assertSet('deleteWhisperVisible', false);

    Http::assertNotSent(fn (Request $request): bool => str_contains($request->url(), 'act=del'));
});

it('keeps the whisper sheet open with the failure when saving fails', function (): void {
    $screen = openThread()->tap('whisper-add-1')->set('whisperContent', 'hi');
    installThreadUpstream(['act=set' => new ConnectionException('offline')]);

    $screen->tap('whisper-submit')->assertSet('whisperVisible', true)->assertSee('外部服務暫時無法連線，請稍後再試。');
});

// ── moderation ─────────────────────────────────────────────────────────────

it('hides reported posts until the user reveals them', function (): void {
    BlockedContent::query()->create(['board_hash' => hash('sha256', 'B-1'), 'node_hash' => hash('sha256', 'P-1'), 'reason' => 'l', 'blocked_at' => now()]);

    $screen = openThread()->assertSee('本內容經檢舉已在 Alt UU 中隱藏')->assertSee('違法內容')->assertDontSee('第一則貼文');
    $screen->tap('reveal-P-1')->assertSee('第一則貼文')->assertDontSee('本內容經檢舉已在 Alt UU 中隱藏');
});

it('hides posts of blocked users and lets the user unblock them', function (): void {
    BlockedUser::query()->create(['poster' => 's-wang', 'realname' => '王小明']);

    $screen = openThread()->assertSee('由於你封鎖了名稱為「王小明」、帳號為「s-wang」的使用者')->assertDontSee('第一則貼文');
    $screen->tap('unblock-1')->assertSee('第一則貼文');

    expect(BlockedUser::query()->count())->toBe(0);
});

it('blocks a user after confirming', function (): void {
    $screen = openThread()->tap('block-1')->assertSet('blockVisible', true)->assertSet('blockPoster', 's-wang');
    expect(BlockedUser::query()->count())->toBe(0);

    $screen->call('confirmBlock')->assertSet('blockVisible', false)->assertDontSee('第一則貼文');

    expect(BlockedUser::query()->where('poster', 's-wang')->where('realname', '王小明')->exists())->toBeTrue();
});

it('does not block when the confirmation is cancelled', function (): void {
    openThread()->tap('block-1')->call('cancelBlock')->assertSet('blockVisible', false)->assertSee('第一則貼文');

    expect(BlockedUser::query()->count())->toBe(0);
});

it('reports a post with the chosen reason', function (): void {
    $screen = openThread()->tap('report-2')->assertSet('reportVisible', true)->assertSet('reportNodeId', 'P-2');
    $screen->tap('report-submit');
    Http::assertNotSent(fn (Request $request): bool => str_contains($request->url(), 'moderation/reports'));

    installThreadUpstream(['moderation/reports' => Http::response([], 200)]);
    $screen->tap('report-reason-s')->assertSet('reportType', 's')->tap('report-submit')->assertSet('reportVisible', false);

    Http::assertSent(function (Request $request): bool {
        $body = json_decode($request->body(), true);

        return str_contains($request->url(), 'moderation/reports')
            && $body['type'] === 's'
            && $body['node_hash'] === hash('sha256', 'P-2')
            && $body['board_hash'] === hash('sha256', 'B-1');
    });
});

it('shows a failure and stays open when the report cannot be sent', function (): void {
    $screen = openThread()->tap('report-2')->tap('report-reason-o');
    installThreadUpstream(['moderation/reports' => new ConnectionException('offline')]);

    $screen->tap('report-submit')->assertSet('reportVisible', true)->assertSet('reportSuccess', false)->assertSee('檢舉送出失敗，請稍後再試。');
});

it('ignores unknown report reasons', function (): void {
    openThread()->tap('report-2')->call('selectReportReason', 'zzz')->assertSet('reportType', '');
});

// ── attachments and images ─────────────────────────────────────────────────

it('queues image attachments through the download pipeline and shows the thumbnail', function (): void {
    $screen = openThread();

    $task = AttachmentDownload::query()->where('file_name', 'pic.png')->firstOrFail();
    expect($task->source_url)->toBe('https://uu.nou.edu.tw/files/pic.png');

    $task->update(['status' => AttachmentDownload::STATUS_COMPLETED, 'relative_path' => 'attachments/pic.png', 'mime_type' => 'image/png']);
    $screen->firePolls();

    expect(json_encode($screen->tree()))->toContain('attachments\/pic.png');
});

it('opens a downloaded image in the fullscreen viewer and closes it', function (): void {
    $screen = openThread();
    AttachmentDownload::query()->where('file_name', 'pic.png')->firstOrFail()
        ->update(['status' => AttachmentDownload::STATUS_COMPLETED, 'relative_path' => 'attachments/pic.png']);
    $screen->firePolls()->tap('image');

    expect($screen->get('lightboxSrc'))->toEndWith('attachments/pic.png')->and($screen->get('lightboxAlt'))->toBe('pic.png');

    $screen->tap('close-image')->assertSet('lightboxSrc', '');
});

it('falls back to a download row when the image download fails', function (): void {
    $screen = openThread();
    AttachmentDownload::query()->where('file_name', 'pic.png')->firstOrFail()
        ->update(['status' => AttachmentDownload::STATUS_FAILED, 'error_message' => '檔案已過期']);

    $screen->firePolls()->assertSee('pic.png');
});

it('lists non-image attachments as download rows', function (): void {
    openThread()->assertSee('講義.pdf');
});

// ── links inside posts ─────────────────────────────────────────────────────

it('opens external links in the in-app browser', function (): void {
    $screen = openThread();
    threadLinkTap($screen, 'https://example.com/x');

    $screen->assertNativeCalled('Browser.OpenInApp', fn (array $params): bool => $params['url'] === 'https://example.com/x');
});

it('offers school files and material-proxy links as downloads instead of browsing', function (): void {
    $screen = openThread();
    $proxy = 'http://127.0.0.1/material-proxy/'.rtrim(strtr(base64_encode('https://uu.nou.edu.tw/files/a.pdf'), '+/', '-_'), '=').'?cid=1001';
    threadLinkTap($screen, $proxy);

    $screen->assertSee('a.pdf');
});

it('opens tronclass links through the attachment bridge', function (): void {
    $screen = openThread();
    threadLinkTap($screen, 'https://tronclass.nou.edu.tw/course/1');

    $screen->assertNativeCalled('AttachmentBridge.OpenTronclass');
});

// ── session ────────────────────────────────────────────────────────────────

it('replaces the screen with the login screen when there is no account', function (): void {
    app(AccountActiveProfile::class)->clear();
    Account::query()->delete();

    Native::test(DiscussThread::class, params: ['cid' => '1001', 'boardCid' => '1001', 'bid' => 'B-1', 'nid' => 'N-1'])->assertReplacedWith('/native/login');
});

it('replaces the screen with the reauth screen when the session and remembered login are dead', function (): void {
    $account = Account::query()->firstOrFail();
    app(UUSessionStore::class)->forget($account->id);
    CourseUpstreamFake::install(['action=login' => Http::response(['code' => 403, 'message' => 'Auth fail', 'data' => []])]);

    openThread()->assertReplacedWith("/native/reauth/{$account->id}");
});

it('opens the session expired picker when the session dies mid-use and another account exists', function (): void {
    AccountSeeding::seed('s7654321');
    $failing = Account::query()->where('username', 's1234567')->firstOrFail();
    AccountSeeding::activate($failing);
    $screen = openThread();

    app(UUSessionStore::class)->forget($failing->id);
    CourseUpstreamFake::install(['action=login' => Http::response(['code' => 403, 'message' => 'Auth fail', 'data' => []])]);

    $screen->call('onResume')->assertSet('sessionPickerVisible', true)->assertSet('sessionPickerFailedAccountId', $failing->id);
});

it('resolves through its route', function (): void {
    Native::visit('/native/courses/1001/discuss/1001/B-1/N-1')->assertScreen(DiscussThread::class)->assertSee('第一則貼文');
});

// ── helpers ────────────────────────────────────────────────────────────────

it('detects markup-free posts as plain text', function (): void {
    expect(PostText::plain('<p>甲&nbsp;乙</p><p>丙<br />丁</p>'))->toBe("甲 乙\n丙\n丁")
        ->and(PostText::plain(''))->toBe('')
        ->and(PostText::plain(null))->toBe('')
        ->and(PostText::plain('1 &lt; 2'))->toBe('1 < 2')
        ->and(PostText::plain('<p style="color:red">x</p>'))->toBeNull()
        ->and(PostText::plain('<p><strong>x</strong></p>'))->toBeNull()
        ->and(PostText::plain('<p><img src="a.png"></p>'))->toBeNull()
        ->and(PostText::plain('<ul><li>x</li></ul>'))->toBeNull();
});

it('recognises attachment links', function (): void {
    expect(PostText::downloadTarget('https://uu.nou.edu.tw/files/a.pdf', 'https://uu.nou.edu.tw'))->toBe(['href' => 'https://uu.nou.edu.tw/files/a.pdf', 'filename' => 'a.pdf'])
        ->and(PostText::downloadTarget('https://uu.nou.edu.tw/course/1', 'https://uu.nou.edu.tw'))->toBeNull()
        ->and(PostText::downloadTarget('https://other.test/a.pdf', 'https://uu.nou.edu.tw'))->toBeNull()
        ->and(PostText::downloadTarget('http://127.0.0.1/material-proxy/!!!', null))->toBeNull();
});

it('keeps the domain action contract used by the screen', function (): void {
    expect(app(ListPosts::class)('1001', 'B-1', 'N-1')->posts)->toHaveCount(2);
});

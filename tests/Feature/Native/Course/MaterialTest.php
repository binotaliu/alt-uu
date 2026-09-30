<?php

declare(strict_types=1);

use AltUU\Domains\AppPreference\AppPreferenceStore;
use AltUU\Domains\MaterialPreference\MaterialPreferenceStore;
use App\Models\Account;
use App\Models\AccountDailyActivity;
use App\Models\PlaybackProgress;
use App\NativeComponents\Courses\Material;
use App\NativeComponents\Courses\Material\ActiveMediaSession;
use App\NativeComponents\Courses\Material\MaterialUrls;
use App\Services\UUSessionStore;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Native\Mobile\Edge\TailwindParser;
use Native\Mobile\Testing\Native;
use Native\Mobile\Testing\TestableComponent;
use Tests\Feature\Native\Course\CourseUpstreamFake;
use Tests\Feature\Native\Fixtures\AccountSeeding;

beforeEach(function (): void {
    AccountSeeding::activate(AccountSeeding::seed('s1234567'));
    installMaterialUpstream();
});

/**
 * @param  array<string, mixed>  $overrides
 */
function installMaterialUpstream(array $overrides = []): void
{
    $video = '<html><body><div class="flowplayer"><video><source type="application/x-mpegurl" src="https://cdn.example.com/v1/playlist.m3u8"><track kind="subtitles" src="01.vtt"></video></div></body></html>';
    $article = '<html><body><h1>第一章</h1><p>本章介紹行動學習。</p><p><img src="/media/pic.png"></p>'
        .'<a href="https://uu.nou.edu.tw/media/h2.html">下一頁</a></body></html>';

    CourseUpstreamFake::install([
        'action=my-course-list' => Http::response(['code' => 0, 'data' => ['list' => [
            ['course_id' => '1001', 'title' => '(114下)行動學習導論-甲班'],
        ]]]),
        'action=my-course-path-info' => Http::response(['code' => 0, 'data' => ['path' => ['item' => [
            ['identifier' => 'D', 'href' => null, 'text' => '第一章', 'item' => [
                ['identifier' => 'V1', 'href' => 'https://uu.nou.edu.tw/media/v1.html', 'text' => '影片一', 'leaf' => true],
                ['identifier' => 'H1', 'href' => 'https://uu.nou.edu.tw/media/h1.html', 'text' => '文章一', 'leaf' => true],
                ['identifier' => 'Y1', 'href' => 'https://uu.nou.edu.tw/learn/path/youtubeEmbed.php?v=dQw4w9WgXcQ', 'text' => '線上影片', 'leaf' => true],
                ['identifier' => 'P1', 'href' => 'https://uu.nou.edu.tw/files/handout.pdf', 'text' => '講義', 'leaf' => true],
                ['identifier' => 'E1', 'href' => 'https://uu.nou.edu.tw/media/empty.html', 'text' => '空白頁', 'leaf' => true],
            ]],
        ]]]]),
        '/media/v1.html' => Http::response($video, 200, ['Content-Type' => 'text/html; charset=utf-8']),
        '/media/h1.html' => Http::response($article, 200, ['Content-Type' => 'text/html; charset=utf-8']),
        '/media/h2.html' => Http::response('<html><body><p>第二頁內容</p></body></html>', 200, ['Content-Type' => 'text/html; charset=utf-8']),
        '/media/empty.html' => Http::response('<html><body></body></html>', 200, ['Content-Type' => 'text/html; charset=utf-8']),
        'action=course-node-resources' => Http::response(['code' => 0, 'data' => ['list' => [
            ['filename' => '投影片.pdf', 'title' => '投影片', 'href' => 'https://uu.nou.edu.tw/r/1'],
            ['filename' => '練習.zip', 'title' => '練習', 'href' => 'https://uu.nou.edu.tw/r/2'],
        ]]]),
        'action=get-server-time' => Http::response(['code' => 0, 'data' => ['server_time' => '2026-03-01 10:00:00']]),
        'action=set-read-node-history' => Http::response(['code' => 0, 'message' => 'ok', 'data' => ['seconds' => 30]]),
        'action=my-profile' => Http::response(['code' => 0, 'message' => 'success', 'data' => ['username' => 's1234567', 'realname' => '測試學生']]),
        '/learn/last10.php' => Http::response('<table class="subject"><tr><td>影片一</td><td>00:10:00</td></tr></table>'),
        ...$overrides,
    ]);
}

function openMaterial(string $scoid = 'V1', string $cid = '1001'): TestableComponent
{
    return Native::test(Material::class, params: ['cid' => $cid, 'scoid' => $scoid]);
}

/**
 * @return list<array<string, mixed>>
 */
function materialNodes(TestableComponent $screen, string $type): array
{
    $found = [];
    $walk = function (array $node) use (&$walk, &$found, $type): void {
        if (($node['type'] ?? null) === $type) {
            $found[] = $node;
        }

        foreach ($node['children'] ?? [] as $child) {
            $walk($child);
        }
    };
    $walk($screen->tree());

    return $found;
}

function articleHtml(TestableComponent $screen): string
{
    return (string) (materialNodes($screen, 'html_view')[0]['props']['html'] ?? '');
}

function materialLinkTap(TestableComponent $screen, string $url): TestableComponent
{
    return $screen->fireEvent('onLinkTap', TestableComponent::EVENT_TEXT_CHANGE, [
        'text' => json_encode(['url' => $url, 'scheme' => (string) parse_url($url, PHP_URL_SCHEME), 'newWindow' => false], JSON_THROW_ON_ERROR),
    ]);
}

function studyTimeRequests(): array
{
    $bodies = [];

    Http::assertSent(function (Request $request) use (&$bodies): bool {
        if (str_contains($request->url(), 'action=set-read-node-history')) {
            parse_str($request->body(), $parsed);
            $bodies[] = $parsed;
        }

        return true;
    });

    return $bodies;
}

function studyTimeSent(): int
{
    return count(studyTimeRequests());
}

// ── rendering ───────────────────────────────────────────────────────────────

it('renders a video node with the native player, the header and prev/next buttons', function (): void {
    $screen = openMaterial('V1')
        ->assertNavTitle('行動學習導論')
        ->assertSee('影片一')
        ->assertSee('上一個教材')
        ->assertSee('下一個教材')
        ->assertSee('文章一')
        ->assertSee('使用內建瀏覽器開啟')
        ->assertSet('loading', false)
        ->assertSet('error', '');

    $player = materialNodes($screen, 'media_player');

    expect($player)->toHaveCount(1)
        ->and($player[0]['props']['src'])->toBe('https://cdn.example.com/v1/playlist.m3u8')
        ->and($player[0]['props']['title'])->toBe('影片一')
        ->and($player[0]['props']['course_name'])->toBe('行動學習導論')
        ->and($player[0]['props']['watermark'])->toBe('s1234567')
        ->and($player[0]['props'])->not->toHaveKey('start')
        ->and(json_decode($player[0]['props']['session_context'], true))->toMatchArray([
            'routePath' => '/native/courses/1001/V1',
            'cid' => '1001',
            'activityId' => 'V1',
            'href' => 'https://uu.nou.edu.tw/media/v1.html',
        ]);
});

it('shows the running study clock only for nodes with an address', function (): void {
    openMaterial('V1')->assertSee('00:00')->assertSet('timerClosed', false);
    openMaterial('D')->assertDontSee('00:00');
});

it('renders an article through the html view with the font scale and dark preference', function (): void {
    app(MaterialPreferenceStore::class)->setScale(1.3);
    app(AppPreferenceStore::class)->setAppearance('dark');

    $views = materialNodes(openMaterial('H1')->assertSee('130%')->assertSee('A+')->assertSee('A-'), 'html_view');

    expect($views)->toHaveCount(1)
        ->and($views[0]['props']['html'])->toContain('本章介紹行動學習')
        ->and($views[0]['props']['html'])->toContain('font-size')
        ->and($views[0]['props']['auto_height'])->toBeTrue()
        ->and($views[0]['props']['color_scheme'])->toBe('dark');
});

it('gives html-view and player upstream urls instead of proxy urls', function (): void {
    $proxied = route('material.content', ['encodedUrl' => 'aHR0cHM6Ly91dS5ub3UuZWR1LnR3L21lZGlhL3BpYy5wbmc']);

    expect(MaterialUrls::direct($proxied))->toBe('https://uu.nou.edu.tw/media/pic.png')
        ->and(MaterialUrls::direct('https://x.test/a.vtt'))->toBe('https://x.test/a.vtt')
        ->and(MaterialUrls::directHtml('<img src="'.$proxied.'">'))->toBe('<img src="https://uu.nou.edu.tw/media/pic.png">');

    $html = materialNodes(openMaterial('H1'), 'html_view')[0]['props']['html'];

    expect($html)->toContain('https://uu.nou.edu.tw/media/pic.png')->not->toContain('material-proxy');
});

it('renders a YouTube node through the embed mode', function (): void {
    $views = materialNodes(openMaterial('Y1'), 'html_view');

    expect($views)->toHaveCount(1)
        ->and($views[0]['props']['src'])->toContain('youtube-embed.html?v=dQw4w9WgXcQ')
        ->and($views[0]['props']['javascript'])->toBeTrue();
    expect(materialNodes(openMaterial('Y1'), 'media_player'))->toBe([]);
});

it('offers a pdf download through the attachment row', function (): void {
    $screen = openMaterial('P1')
        ->assertSee('本教材為 PDF 檔案')
        ->assertSee('handout.pdf');

    expect(materialNodes($screen, 'media_player'))->toBe([])
        ->and(materialNodes($screen, 'html_view'))->toBe([]);
});

it('says so when a node has nothing to show and lists extra resources', function (): void {
    openMaterial('E1')->assertSee('此節點沒有可顯示的教材內容。')->assertSee('附件資源')->assertSee('投影片.pdf')->assertSee('練習.zip');
});

it('passes the accessibility checks for icon-only controls', function (): void {
    openMaterial('V1')->assertAccessible();
    openMaterial('H1')->assertAccessible();
});

it('shows the empty message for a folder without an address', function (): void {
    openMaterial('D')->assertSee('此節點沒有可顯示的教材內容。');
});

it('draws the tablet sidebar with responsive classes only', function (): void {
    openMaterial('V1')->assertSee('教材目錄');

    foreach (['hidden', 'md:flex', 'w-80'] as $token) {
        expect(TailwindParser::parse($token))->not->toBe([], "{$token} is dropped");
    }
});

it('uses only TailwindParser-supported classes in the material views', function (): void {
    $files = [
        resource_path('views/native/courses/material.blade.php'),
        resource_path('views/native/courses/material-placeholder.blade.php'),
        ...glob(resource_path('views/native/courses/material/*.blade.php')) ?: [],
    ];

    $dropped = [];

    foreach ($files as $file) {
        $source = (string) file_get_contents($file);
        $candidates = [];

        preg_match_all('/\sclass="([^"]*)"/', $source, $attributes);

        foreach ($attributes[1] as $classAttribute) {
            $joined = preg_replace('/(?<=\S)\{\{.*?\}\}(?=\S)/s', '1', $classAttribute) ?? '';
            $candidates[] = preg_replace('/\{\{.*?\}\}/s', ' ', $joined) ?? '';
        }

        preg_match_all("/'([a-z0-9\/\[\]:. -]*-[a-z0-9\/\[\]:. -]*)'/", $source, $literals);
        array_push($candidates, ...$literals[1]);

        foreach ($candidates as $candidate) {
            foreach (preg_split('/\s+/', trim($candidate)) ?: [] as $token) {
                if ($token !== '' && TailwindParser::parse($token) === []) {
                    $dropped[basename($file)][] = $token;
                }
            }
        }
    }

    expect($dropped)->toBe([]);
});

// ── prompts ─────────────────────────────────────────────────────────────────

it('asks to resume when progress was saved and starts the player at that position', function (): void {
    PlaybackProgress::create([
        'account_id' => Account::query()->firstOrFail()->id,
        'cid' => '1001', 'activity_id' => 'V1', 'duration_seconds' => 60, 'position_seconds' => 3725.0,
    ]);

    $screen = openMaterial('V1')
        ->assertSet('mediaReady', false)
        ->assertSee('請先選擇是否接續播放');

    expect(materialNodes($screen, 'media_player'))->toBe([]);

    $sheet = collect(materialNodes($screen, 'bottom_sheet'))->firstWhere('props.visible', true);
    expect($sheet)->not->toBeNull();

    $screen->assertSee('上次播放到 1 時 02 分 05 秒');

    $screen->tap('resume-confirm')->assertSet('resumePrompt', null);
    $player = materialNodes($screen, 'media_player')[0]['props'];

    expect($player['start'])->toBe(3725.0)->and($player['autoplay'])->toBeTrue();
});

it('starts from the beginning when the resume prompt is declined', function (): void {
    PlaybackProgress::create([
        'account_id' => Account::query()->firstOrFail()->id,
        'cid' => '1001', 'activity_id' => 'V1', 'duration_seconds' => 60, 'position_seconds' => 90.0,
    ]);

    $screen = openMaterial('V1')->assertSee('上次播放到 1 分 30 秒')->tap('resume-decline');
    $player = materialNodes($screen, 'media_player')[0]['props'];

    expect($player)->not->toHaveKey('start')->and($player['autoplay'])->toBeTrue();
});

it('does not ask to resume when the saved position is below three seconds', function (): void {
    PlaybackProgress::create([
        'account_id' => Account::query()->firstOrFail()->id,
        'cid' => '1001', 'activity_id' => 'V1', 'duration_seconds' => 5, 'position_seconds' => 2.0,
    ]);

    openMaterial('V1')->assertSet('resumePrompt', null)->assertSet('mediaReady', true);
});

it('warns before playing media on a cellular connection and can remember the answer', function (): void {
    Native::fakeBridge()->withCellular();

    $screen = openMaterial('V1')->assertSet('cellularPromptVisible', true)->assertSet('segmentStartedAt', null);

    expect(materialNodes($screen, 'media_player'))->toBe([]);

    $screen->check('cellular-dont-ask')->tap('cellular-continue')
        ->assertSet('cellularPromptVisible', false)
        ->assertSet('mediaReady', true);

    expect(app(AppPreferenceStore::class)->getCellularPlaybackWarningEnabled())->toBeFalse();
    expect($screen->get('segmentStartedAt'))->not->toBeNull();
    expect(materialNodes($screen, 'media_player'))->toHaveCount(1);
});

it('goes back without starting the timer when the cellular warning is declined', function (): void {
    Native::fakeBridge()->withCellular();

    openMaterial('V1')->tap('cellular-decline')->assertWentBack();

    expect(studyTimeSent())->toBe(0);
    expect(app(AppPreferenceStore::class)->getCellularPlaybackWarningEnabled())->toBeTrue();
});

it('skips the cellular warning on wifi, offline and when disabled', function (): void {
    Native::fakeBridge()->withWifi();
    openMaterial('V1')->assertSet('cellularPromptVisible', false);

    Native::fakeBridge()->withOffline();
    openMaterial('V1')->assertSet('cellularPromptVisible', false);

    Native::fakeBridge()->withCellular();
    app(AppPreferenceStore::class)->setCellularPlaybackWarningEnabled(false);
    openMaterial('V1')->assertSet('cellularPromptVisible', false);
});

it('never warns for an article on cellular', function (): void {
    Native::fakeBridge()->withCellular();

    openMaterial('H1')->assertSet('cellularPromptVisible', false);
});

// ── study timer ─────────────────────────────────────────────────────────────

it('saves the study time with the media position when going back', function (): void {
    $bridge = Native::fakeBridge()->respondTo('MediaPlayer.GetCurrentTime', ['status' => 'success', 'data' => ['time' => 42.5, 'duration' => 300.0]]);

    $screen = openMaterial('V1');
    $this->travel(65)->seconds();
    $screen->pressBack()->assertWentBack();

    $sent = studyTimeRequests();
    expect($sent)->toHaveCount(1)
        ->and($sent[0])->toMatchArray(['cid' => '1001', 'activity_id' => 'V1', 'url' => 'https://uu.nou.edu.tw/media/v1.html']);

    $progress = PlaybackProgress::query()->where('activity_id', 'V1')->firstOrFail();
    expect($progress->position_seconds)->toBe(42.5)
        ->and($progress->media_duration_seconds)->toBe(300.0)
        ->and($progress->duration_seconds)->toBe(65);

    $screen->instance()->unmount();
    expect(studyTimeSent())->toBe(1);
    $bridge->assertCalled('MediaPlayer.GetCurrentTime');
});

it('does not save stretches shorter than three seconds', function (): void {
    $screen = openMaterial('V1');
    $this->travel(2)->seconds();
    $screen->pressBack()->assertWentBack();

    expect(studyTimeSent())->toBe(0);
});

it('does not track nodes without an address', function (): void {
    $screen = openMaterial('D');
    $this->travel(30)->seconds();
    $screen->pressBack();

    expect(studyTimeSent())->toBe(0);
});

it('saves as a safety net when the screen unmounts without a back press', function (): void {
    $screen = openMaterial('H1');
    $this->travel(20)->seconds();
    $screen->instance()->unmount();
    $screen->instance()->unmount();

    expect(studyTimeSent())->toBe(1);
});

it('saves the running node before switching and starts a new visit', function (): void {
    $screen = openMaterial('V1');
    $this->travel(30)->seconds();

    $screen->call('selectNode', 'H1')
        ->assertSet('saving', true)
        ->assertSet('activeNodeIdentifier', 'V1')
        ->assertSee('正在保存學習進度');

    expect(studyTimeSent())->toBe(0);

    $screen->firePoll('tick')
        ->assertSet('saving', false)
        ->assertSet('activeNodeIdentifier', 'H1')
        ->assertDontSee('正在保存學習進度');

    expect(articleHtml($screen))->toContain('本章介紹行動學習');

    $sent = studyTimeRequests();
    expect($sent)->toHaveCount(1)->and($sent[0]['activity_id'])->toBe('V1');
    expect(materialNodes($screen, 'media_player'))->toBe([]);

    $this->travel(15)->seconds();
    $screen->pressBack();
    expect(studyTimeRequests()[1]['activity_id'])->toBe('H1');
});

it('switches to the previous and next node from the buttons', function (): void {
    $screen = openMaterial('H1')->tap('previous-node')->firePoll('tick')->assertSet('activeNodeIdentifier', 'V1');

    $screen->tap('next-node')->firePoll('tick')->assertSet('activeNodeIdentifier', 'H1');
    $screen->tap('next-node')->firePoll('tick')->assertSet('activeNodeIdentifier', 'Y1');
});

it('ignores a switch to the node that is already open', function (): void {
    openMaterial('V1')->call('selectNode', 'V1')->assertSet('saving', false);
});

it('switches nodes when a directory row is picked in the sidebar', function (): void {
    openMaterial('V1')->call('selectNode', 'P1', 'https://uu.nou.edu.tw/files/handout.pdf')->firePoll('tick')
        ->assertSet('activeNodeIdentifier', 'P1')
        ->assertSee('本教材為 PDF 檔案');
});

it('keeps the segment start, sends the whole span and restarts the segment on a checkpoint', function (): void {
    $screen = openMaterial('V1');

    $this->travel(120)->seconds();
    $screen->firePoll('tick');
    expect(studyTimeSent())->toBe(0);

    $this->travel(200)->seconds();
    $screen->firePoll('tick');

    $sent = studyTimeRequests();
    expect($sent)->toHaveCount(1);

    $this->travel(310)->seconds();
    $screen->firePoll('tick');
    expect(studyTimeSent())->toBe(2);

    // Each save records only its own span: 320 s then 310 s of daily activity.
    expect((int) AccountDailyActivity::query()->sum('total_seconds'))->toBe(630);
});

/**
 * A `get-server-time` fake that counts its calls and fails while `$fails` is true.
 *
 * @return array{0: Closure, 1: object}
 */
function serverTimeFake(bool $fails): array
{
    $state = new stdClass;
    $state->calls = 0;
    $state->fails = $fails;

    $fake = function () use ($state) {
        $state->calls++;

        if ($state->fails) {
            throw new ConnectionException('offline');
        }

        return Http::response(['code' => 0, 'data' => ['server_time' => '2026-03-01 10:00:00']]);
    };

    return [$fake, $state];
}

it('keeps the segment and retries later when a checkpoint cannot reach the school', function (): void {
    [$fake, $state] = serverTimeFake(fails: true);
    installMaterialUpstream(['action=get-server-time' => $fake]);
    $screen = openMaterial('V1');

    $this->travel(320)->seconds();
    $screen->firePoll('tick');

    // one attempt plus one retry after the session re-validation
    expect($state->calls)->toBe(2)->and(AccountDailyActivity::query()->count())->toBe(0);
    expect($screen->get('segmentStartedAt'))->not->toBeNull();

    $this->travel(5)->seconds();
    $screen->firePoll('tick');
    expect($state->calls)->toBe(2);

    $state->fails = false;
    $this->travel(70)->seconds();
    $screen->firePoll('tick');

    expect((int) AccountDailyActivity::query()->sum('total_seconds'))->toBe(395);
});

it('revalidates the session and retries once when saving fails', function (): void {
    $calls = 0;
    installMaterialUpstream(['action=get-server-time' => function () use (&$calls) {
        $calls++;

        if ($calls === 1) {
            throw new ConnectionException('offline');
        }

        return Http::response(['code' => 0, 'data' => ['server_time' => '2026-03-01 10:00:00']]);
    }]);

    $screen = openMaterial('V1');
    $this->travel(40)->seconds();
    $screen->pressBack()->assertWentBack();

    expect($calls)->toBe(2)->and(PlaybackProgress::query()->where('activity_id', 'V1')->exists())->toBeTrue();
});

it('warns when the study time cannot be saved even after a retry and still leaves', function (): void {
    [$fake, $state] = serverTimeFake(fails: true);
    installMaterialUpstream(['action=get-server-time' => $fake]);

    $bridge = Native::fakeBridge();
    $screen = openMaterial('V1');
    $this->travel(40)->seconds();
    $screen->pressBack()->assertWentBack();

    $bridge->assertCalled('Dialog.Toast', fn (array $params): bool => $params['message'] === '學習進度儲存失敗');
    expect(PlaybackProgress::query()->count())->toBe(0);

    $screen->instance()->unmount();
    expect($state->calls)->toBe(2);
});

it('survives a fully offline save on back, checkpoint and unmount', function (): void {
    [$fake, $state] = serverTimeFake(fails: true);
    installMaterialUpstream([
        'action=get-server-time' => $fake,
        'action=my-profile' => new ConnectionException('offline'),
    ]);

    $screen = openMaterial('H1');

    $this->travel(320)->seconds();
    $screen->firePoll('tick')->assertSet('error', '')->assertSet('loading', false);
    expect($state->calls)->toBe(1);

    $this->travel(60)->seconds();
    $bridge = Native::fakeBridge();
    $screen->pressBack()->assertWentBack();
    $bridge->assertCalled('Dialog.Toast', fn (array $params): bool => $params['message'] === '學習進度儲存失敗');

    $screen->instance()->unmount();
    expect(PlaybackProgress::query()->count())->toBe(0);
});

it('does not send the same span twice when the school refuses it', function (): void {
    installMaterialUpstream(['action=set-read-node-history' => Http::response(['code' => 500, 'message' => 'no', 'data' => []])]);

    $screen = openMaterial('V1');
    $this->travel(40)->seconds();
    $screen->pressBack()->assertWentBack();

    // one attempt with `st`, one fallback with `et` inside the Action, but no screen retry
    expect(studyTimeSent())->toBe(2);
});

it('sends the YouTube position from progress messages', function (): void {
    $screen = openMaterial('Y1')->fireEvent('onMessage', TestableComponent::EVENT_TEXT_CHANGE, [
        'text' => json_encode(['source' => 'altuu-youtube-embed', 'currentTime' => 61.5, 'duration' => 600], JSON_THROW_ON_ERROR),
    ]);

    $this->travel(30)->seconds();
    $screen->pressBack();

    $progress = PlaybackProgress::query()->where('activity_id', 'Y1')->firstOrFail();
    expect($progress->position_seconds)->toBe(61.5)->and($progress->media_duration_seconds)->toBe(600.0);
});

it('feeds player progress events into the saved position', function (): void {
    $screen = openMaterial('V1')->fireEvent('onProgress', TestableComponent::EVENT_TEXT_CHANGE, [
        'text' => json_encode(['currentTime' => 12.5, 'duration' => 300, 'state' => 'playing'], JSON_THROW_ON_ERROR),
    ]);

    $screen->assertSet('lastPosition', 12.5)->assertSet('lastDuration', 300.0);

    $this->travel(30)->seconds();
    $screen->pressBack();

    expect(PlaybackProgress::query()->where('activity_id', 'V1')->firstOrFail()->position_seconds)->toBe(12.5);
});

it('sizes the player for audio courses', function (): void {
    installMaterialUpstream(['action=my-course-list' => CourseUpstreamFake::defaults()['action=my-course-list']]);

    $screen = openMaterial('V1');
    $props = materialNodes($screen, 'media_player')[0]['props'];

    expect($props['kind'])->toBe('audio');
    expect($screen->instance()->canCaptureFrame())->toBeFalse();
});

it('shows a player error inline', function (): void {
    openMaterial('V1')
        ->fireEvent('onError', TestableComponent::EVENT_TEXT_CHANGE, ['text' => json_encode(['message' => '無法播放此影片', 'code' => 3], JSON_THROW_ON_ERROR)])
        ->assertSee('無法播放此影片');
});

it('passes the player rate the user chose to the next player', function (): void {
    Native::fakeBridge()->respondTo('MediaPlayer.GetPlaybackRate', ['status' => 'success', 'data' => ['rate' => 1.5]]);

    expect(materialNodes(openMaterial('V1'), 'media_player')[0]['props']['rate'])->toBe(1.5);
});

// ── native restore ──────────────────────────────────────────────────────────

it('restores the running media session: keeps its start time and skips the prompt', function (): void {
    PlaybackProgress::create([
        'account_id' => Account::query()->firstOrFail()->id,
        'cid' => '1001', 'activity_id' => 'V1', 'duration_seconds' => 60, 'position_seconds' => 900.0,
    ]);

    $startedAt = now()->subMinutes(3)->toIso8601String();
    Native::fakeBridge()->respondTo('MediaPlayer.GetState', ['status' => 'success', 'data' => [
        'isActive' => true, 'currentTime' => 900, 'type' => 'video', 'url' => 'https://cdn.example.com/v1/playlist.m3u8',
        'sessionContext' => [
            'routePath' => '/native/courses/1001/V1', 'cid' => '1001', 'activityId' => 'V1',
            'href' => 'https://uu.nou.edu.tw/media/v1.html', 'startedAt' => $startedAt,
        ],
    ]]);

    $screen = openMaterial('V1')->assertSet('resumePrompt', null)->assertSet('mediaReady', true)->assertSee('03:00');

    expect($screen->get('segmentStartedAt'))->toBe($startedAt);
    expect(materialNodes($screen, 'media_player'))->toHaveCount(1);
});

it('ignores a running session that belongs to another node', function (): void {
    Native::fakeBridge()->respondTo('MediaPlayer.GetState', ['status' => 'success', 'data' => [
        'isActive' => true,
        'sessionContext' => ['routePath' => '/native/courses/1001/H1', 'cid' => '1001', 'activityId' => 'H1', 'href' => 'x', 'startedAt' => now()->subHour()->toIso8601String()],
    ]]);

    openMaterial('V1')->assertSee('00:00');
});

it('finds the active session for other screens', function (): void {
    expect(ActiveMediaSession::find())->toBeNull();

    Native::fakeBridge()->respondTo('MediaPlayer.GetState', ['status' => 'success', 'data' => ['isActive' => true, 'sessionContext' => [
        'routePath' => '/native/courses/1001/V1', 'cid' => '1001', 'activityId' => 'V1', 'startedAt' => '2026-03-01T10:00:00+08:00',
    ]]]);

    expect(ActiveMediaSession::find())->toBe([
        'cid' => '1001', 'activityId' => 'V1', 'routePath' => '/native/courses/1001/V1', 'startedAt' => '2026-03-01T10:00:00+08:00',
    ]);

    Native::fakeBridge()->respondTo('MediaPlayer.GetState', ['status' => 'success', 'data' => ['isActive' => false]]);
    expect(ActiveMediaSession::find())->toBeNull();
});

// ── links ───────────────────────────────────────────────────────────────────

it('routes article links by kind', function (): void {
    $bridge = Native::fakeBridge();
    $screen = openMaterial('H1');

    materialLinkTap($screen, 'https://uu.nou.edu.tw/media/v1.html')->firePoll('tick')->assertSet('activeNodeIdentifier', 'V1');
    $screen = openMaterial('H1');

    materialLinkTap($screen, 'https://example.com/page');
    $bridge->assertCalled('Browser.OpenInApp', fn (array $params): bool => $params['url'] === 'https://example.com/page');

    materialLinkTap($screen, 'mailto:teacher@example.com');
    $bridge->assertCalled('Browser.Open', fn (array $params): bool => $params['url'] === 'mailto:teacher@example.com');

    materialLinkTap($screen, 'tel:+886212345678');
    $bridge->assertCalled('Browser.Open', fn (array $params): bool => $params['url'] === 'tel:+886212345678');
});

it('opens tronclass links through the bridge with the app scheme, or the in-app browser without it', function (): void {
    $bridge = Native::fakeBridge()->respondTo('AttachmentBridge.OpenTronclass', ['status' => 'success', 'data' => ['opened' => true]]);

    materialLinkTap(openMaterial('H1'), 'https://tronclass.nou.edu.tw/course/1');

    $bridge->assertCalled('AttachmentBridge.OpenTronclass', fn (array $params): bool => $params['url'] === 'tronclass://navigate?url='.rawurlencode('https://tronclass.nou.edu.tw/course/1'));
    $bridge->assertNotCalled('Browser.OpenInApp');

    $failing = Native::fakeBridge()->respondTo('AttachmentBridge.OpenTronclass', '');
    materialLinkTap(openMaterial('H1'), 'https://nou.tronclass.com.tw/x');

    $failing->assertCalled('Browser.OpenInApp', fn (array $params): bool => $params['url'] === 'https://nou.tronclass.com.tw/x');
});

it('loads a sub-page of the same host without stopping the timer', function (): void {
    $screen = openMaterial('H1');
    $startedAt = $screen->get('segmentStartedAt');

    materialLinkTap($screen, 'https://uu.nou.edu.tw/media/h2.html')
        ->assertSet('activeNodeIdentifier', 'H1')
        ->assertSet('contentUrl', 'https://uu.nou.edu.tw/media/h2.html');

    expect(articleHtml($screen))->toContain('第二頁內容');
    expect($screen->get('segmentStartedAt'))->toBe($startedAt);
    expect(studyTimeSent())->toBe(0);
});

it('reloads the current node when a link points at it, keeping the timer', function (): void {
    $screen = openMaterial('H1');
    $startedAt = $screen->get('segmentStartedAt');

    $screen->call('loadSubpage', 'https://uu.nou.edu.tw/media/h2.html');
    expect(articleHtml($screen))->toContain('第二頁內容');

    $screen->call('openNodeLink', 'H1', 'https://uu.nou.edu.tw/media/h1.html');
    expect(articleHtml($screen))->toContain('本章介紹行動學習');

    expect($screen->get('segmentStartedAt'))->toBe($startedAt);
});

it('opens sub-pages on other hosts in the in-app browser instead of parsing them', function (): void {
    $bridge = Native::fakeBridge();

    openMaterial('H1')->call('loadSubpage', 'https://evil.example.com/a.html');

    $bridge->assertCalled('Browser.OpenInApp', fn (array $params): bool => $params['url'] === 'https://evil.example.com/a.html');
    Http::assertNotSent(fn (Request $request): bool => str_contains($request->url(), 'evil.example.com'));
});

it('opens the material in the in-app browser with the school cookies', function (): void {
    $bridge = Native::fakeBridge()->respondTo('AttachmentBridge.OpenURL', ['status' => 'success', 'data' => ['opened' => true]]);

    openMaterial('V1')->tap('open-in-app-browser');

    $bridge->assertCalled('AttachmentBridge.OpenURL', fn (array $params): bool => $params['url'] === 'https://uu.nou.edu.tw/media/v1.html'
        && $params['cookies'][0]['name'] === 'WM');
});

it('falls back to the plain in-app browser when the bridge cannot open the page', function (): void {
    $bridge = Native::fakeBridge()->respondTo('AttachmentBridge.OpenURL', '');

    openMaterial('V1')->tap('open-in-app-browser');

    $bridge->assertCalled('Browser.OpenInApp', fn (array $params): bool => $params['url'] === 'https://uu.nou.edu.tw/media/v1.html');
});

// ── font scale, reload, capture ─────────────────────────────────────────────

it('changes and persists the font scale within its limits', function (): void {
    $screen = openMaterial('H1')->tap('zoom-in')->assertSee('110%');

    expect(app(MaterialPreferenceStore::class)->getScale())->toBe(1.1);

    $screen->tap('zoom-in')->tap('zoom-in')->tap('zoom-in')->tap('zoom-in')->tap('zoom-in')->tap('zoom-in')->assertSee('160%');
    $screen->tap('zoom-in')->assertSee('160%');
    expect(app(MaterialPreferenceStore::class)->getScale())->toBe(1.6);

    $screen->tap('zoom-reset')->assertSee('100%');
});

it('reloads the content and restarts a changed player source at the current position', function (): void {
    Native::fakeBridge()->respondTo('MediaPlayer.GetCurrentTime', ['status' => 'success', 'data' => ['time' => 75.0, 'duration' => 300.0]]);

    $screen = openMaterial('V1');
    expect(materialNodes($screen, 'media_player')[0]['props']['src'])->toBe('https://cdn.example.com/v1/playlist.m3u8');

    installMaterialUpstream(['/media/v1.html' => Http::response(
        '<html><body><video><source type="application/x-mpegurl" src="https://cdn.example.com/v1/fresh.m3u8"></video></body></html>',
        200,
        ['Content-Type' => 'text/html; charset=utf-8'],
    )]);

    $props = materialNodes($screen->tap('reload')->assertSet('reloading', false), 'media_player')[0]['props'];

    expect($props['src'])->toBe('https://cdn.example.com/v1/fresh.m3u8')
        ->and($props['start'])->toBe(75.0)
        ->and($props['autoplay'])->toBeTrue();
});

it('reports a failed reload without losing the content', function (): void {
    $screen = openMaterial('H1');
    installMaterialUpstream(['/media/h1.html' => new ConnectionException('offline')]);

    $screen->tap('reload')->assertSee('重新載入失敗，請稍後再試。');

    expect(articleHtml($screen))->toContain('本章介紹行動學習');
});

it('captures a frame through the player bridge and reports failures', function (): void {
    $bridge = Native::fakeBridge()->respondTo('MediaPlayer.CaptureFrame', ['status' => 'success', 'data' => ['shared' => true]]);

    openMaterial('V1')->tap('capture')->assertSet('captureError', '');
    $bridge->assertCalled('MediaPlayer.CaptureFrame');

    Native::fakeBridge()->respondTo('MediaPlayer.CaptureFrame', '');
    openMaterial('V1')->tap('capture')->assertSee('截圖失敗，請稍後再試。');
});

it('offers no frame capture for articles', function (): void {
    openMaterial('H1')->assertMissingElement('pressable', fn (array $node): bool => ($node['props']['a11y_label'] ?? null) === '截取畫面');
});

// ── failures ────────────────────────────────────────────────────────────────

it('shows a retry card when the directory cannot be loaded and recovers', function (): void {
    installMaterialUpstream(['action=my-course-path-info' => new ConnectionException('offline')]);

    $screen = openMaterial('V1')->assertSee('重試');

    expect($screen->get('error'))->not->toBe('');
    expect(materialNodes($screen, 'media_player'))->toBe([]);

    installMaterialUpstream();
    Cache::flush();

    $screen->tap('retry')->assertSet('error', '')->assertSee('影片一');
});

it('shows a retry card when the content cannot be fetched', function (): void {
    installMaterialUpstream(['/media/h1.html' => new ConnectionException('offline')]);

    $screen = openMaterial('H1')->assertSet('loading', false);

    expect($screen->get('error'))->not->toBe('');
    $screen->assertSee('重試');

    installMaterialUpstream();
    $screen->tap('retry')->assertSet('error', '');

    expect(articleHtml($screen))->toContain('本章介紹行動學習');
});

it('replaces the screen with the reauth screen when the session and remembered login are dead', function (): void {
    $account = Account::query()->firstOrFail();
    app(UUSessionStore::class)->forget($account->id);
    CourseUpstreamFake::install(['action=login' => Http::response(['code' => 403, 'message' => 'Auth fail', 'data' => []])]);

    openMaterial('V1')->assertReplacedWith("/native/reauth/{$account->id}");
    expect(studyTimeSent())->toBe(0);
});

it('opens the session expired picker on resume without sending study time under another session', function (): void {
    AccountSeeding::seed('s7654321');
    $failing = Account::query()->where('username', 's1234567')->firstOrFail();
    AccountSeeding::activate($failing);
    $screen = openMaterial('V1');

    app(UUSessionStore::class)->forget($failing->id);
    CourseUpstreamFake::install(['action=login' => Http::response(['code' => 403, 'message' => 'Auth fail', 'data' => []])]);

    $screen->call('onResume')->assertSet('sessionPickerVisible', true)->assertSet('timerSuspended', true);

    $this->travel(60)->seconds();
    $screen->instance()->unmount();

    expect(studyTimeSent())->toBe(0);
});

it('continues the visit after the session is valid again and the screen is resumed', function (): void {
    AccountSeeding::seed('s7654321');
    $failing = Account::query()->where('username', 's1234567')->firstOrFail();
    AccountSeeding::activate($failing);
    $screen = openMaterial('V1');

    $session = app(UUSessionStore::class)->get($failing->id);
    app(UUSessionStore::class)->forget($failing->id);
    CourseUpstreamFake::install(['action=login' => Http::response(['code' => 403, 'message' => 'Auth fail', 'data' => []])]);
    $screen->call('onResume')->assertSet('timerSuspended', true);

    $this->travel(30)->seconds();
    installMaterialUpstream();
    Account::withTrashed()->whereKey($failing->id)->restore();
    app(UUSessionStore::class)->put($session, $failing->id);
    AccountSeeding::activate($failing);

    $screen->call('onResume')->assertSet('timerSuspended', false);

    $this->travel(30)->seconds();
    $screen->pressBack();

    expect(studyTimeSent())->toBe(1)->and((int) AccountDailyActivity::query()->sum('total_seconds'))->toBe(60);
});

it('drops the running visit when the account is switched from the picker', function (): void {
    $screen = openMaterial('V1');
    $this->travel(60)->seconds();

    $screen->call('onSessionPickerSwitched', 999)->assertReplacedWith('/native/courses');
    $screen->instance()->unmount();

    expect(studyTimeSent())->toBe(0);
});

it('resolves through its route', function (): void {
    Native::visit('/native/courses/1001/V1')->assertScreen(Material::class)->assertSee('影片一');
});

it('formats file names, durations and clocks', function (): void {
    expect(MaterialUrls::downloadFilename(null, null, true, '第 1/2 章: 講義'))->toBe('第 1_2 章_ 講義.pdf')
        ->and(MaterialUrls::downloadFilename('a.zip', 'zip', false, 'x'))->toBe('a.zip')
        ->and(MaterialUrls::downloadFilename(null, null, false, ''))->toBe('material.bin')
        ->and(MaterialUrls::secondsLabel(59))->toBe('59 秒')
        ->and(MaterialUrls::secondsLabel(605))->toBe('10 分 05 秒')
        ->and(MaterialUrls::clock(3599))->toBe('59:59');
});

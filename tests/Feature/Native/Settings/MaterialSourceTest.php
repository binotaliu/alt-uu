<?php

declare(strict_types=1);

use App\NativeComponents\Settings\MaterialSource;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Native\Mobile\Testing\Native;
use Tests\Feature\Native\Fixtures\AccountSeeding;

beforeEach(function (): void {
    Cache::flush();
    config()->set('app.material_source_viewer_enabled', true);
    AccountSeeding::activate(AccountSeeding::seed('s1234567'));
});

/**
 * @param  array<string, mixed>  $extra
 */
function fakeMaterialUpstream(array $extra = []): void
{
    Http::fake([
        'https://uu.nou.edu.tw/xmlapi/index.php?action=my-profile*' => Http::response(['code' => 0, 'message' => 'success', 'data' => ['username' => 's1234567']]),
        'https://uu.nou.edu.tw/xmlapi/index.php?action=my-course-list*' => Http::response(['code' => 0, 'data' => ['list' => [['course_id' => '9001', 'title' => '(114上)資料結構']]]]),
        'https://uu.nou.edu.tw/xmlapi/index.php?action=my-course-path-info*' => Http::response([
            'code' => 0,
            'message' => 'success',
            'data' => ['path' => ['item' => [
                ['identifier' => 'A2', 'text' => '1-1 課程簡介', 'href' => 'https://uu.nou.edu.tw/material/lesson-1.html?ticket=abc123', 'leaf' => true],
                ['identifier' => 'A3', 'text' => '外部連結', 'href' => 'https://example.com/x.html', 'leaf' => true],
            ]]],
        ]),
        'https://uu.nou.edu.tw/xmlapi/index.php?action=go-course*' => Http::response(['code' => 0]),
        'https://uu.nou.edu.tw/learn/path/pathtree.php' => Http::response('<html></html>'),
        ...$extra,
    ]);
}

it('leaves the screen when the dev flag is off', function (): void {
    config()->set('app.material_source_viewer_enabled', false);
    fakeMaterialUpstream();

    Native::test(MaterialSource::class)->assertWentBack();
});

it('lists courses and shows the directory the school sent, without credentials', function (): void {
    fakeMaterialUpstream();

    Native::test(MaterialSource::class)
        ->assertSee('資料結構')
        ->tap('course-9001')
        ->assertSee('教材目錄（2 個節點）')
        ->assertSee('1-1 課程簡介')
        ->assertDontSee('abc123')
        ->assertElement('button', fn ($el) => ($el['ref'] ?? null) === 'inspect-A2')
        ->tap('inspect-A3')
        ->assertSee('不允許存取外部資源');
});

it('shows the raw source and parse outcome for a node and goes back', function (): void {
    fakeMaterialUpstream([
        'https://uu.nou.edu.tw/material/lesson-1.html*' => Http::response(
            '<html><body><h2>第一章內容</h2></body></html>',
            200,
            ['Content-Type' => 'text/html; charset=utf-8'],
        ),
    ]);

    Native::test(MaterialSource::class)
        ->tap('course-9001')
        ->tap('inspect-A2')
        ->assertSee('解析出文字內容')
        ->assertSee('第一章內容')
        ->assertDontSee('abc123')
        ->tap('back-to-directory')
        ->assertSee('教材目錄（2 個節點）')
        ->assertSet('source', null);
});

it('explains an empty page with a verdict', function (): void {
    fakeMaterialUpstream([
        'https://uu.nou.edu.tw/material/lesson-1.html*' => Http::response('', 200, ['Content-Type' => 'text/html']),
    ]);

    Native::test(MaterialSource::class)
        ->tap('course-9001')
        ->tap('inspect-A2')
        ->assertSee('學校回傳了空白頁面，App 沒有東西可以顯示。');
});

it('shows a retryable error when the directory cannot be loaded', function (): void {
    fakeMaterialUpstream([
        'https://uu.nou.edu.tw/xmlapi/index.php?action=my-course-path-info*' => fn () => throw new ConnectionException('offline'),
    ]);

    Native::test(MaterialSource::class)
        ->tap('course-9001')
        ->assertSee('載入教材目錄失敗，請稍後再試。')
        ->assertElement('button', fn ($el) => ($el['ref'] ?? null) === 'retry');
});

it('shows a course list error when offline', function (): void {
    Http::fake(fn () => throw new ConnectionException('offline'));

    Native::test(MaterialSource::class)->assertSee('載入課程失敗，請稍後再試。');
});

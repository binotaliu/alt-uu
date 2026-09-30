<?php

use App\Services\AccountCredentialsStore;
use App\Services\UUSessionStore;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

use function Pest\Laravel\postJson;
use function Pest\Laravel\withSession;

it('returns error json on invalid login', function () {
    Http::fake([
        'https://uu.nou.edu.tw/xmlapi/index.php?action=login*' => Http::response([
            'code' => 503,
            'message' => 'Auth fail',
            'data' => [],
        ]),
    ]);

    $response = postJson('/login', [
        'username' => 's1234567',
        'password' => 'wrong-password',
    ]);

    $response->assertUnprocessable();
    $response->assertJson([
        'ok' => false,
        'message' => '登入失敗，請確認帳號密碼。',
        'raw' => [
            'code' => 503,
            'message' => 'Auth fail',
            'data' => [],
        ],
    ]);
});

it('stores proxy session and remembered credentials after successful login', function () {
    Http::fake([
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
    ]);

    $response = postJson('/login', [
        'username' => 's1234567',
        'password' => 'secret',
    ]);

    $response->assertSuccessful();
    $response->assertJson(['ok' => true]);
    $response->assertSessionHas('hungu.profile.username', 's1234567');
    $response->assertSessionHas('hungu.profile.display_name', '測試學生');
    $response->assertSessionHas('hungu.profile.picture', 'https://uu.nou.edu.tw/avatar.jpg');

    expect(app(UUSessionStore::class)->has())->toBeTrue();
    expect(app(AccountCredentialsStore::class)->has())->toBeTrue();
});

it('always remembers credentials after successful login', function () {
    app(AccountCredentialsStore::class)->put('s1234567', 'old-password');

    Http::fake([
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
        ]),
        'https://uu.nou.edu.tw/xmlapi/index.php?action=my-profile*' => Http::response([
            'code' => 0,
            'message' => 'success',
            'data' => [
                'username' => 's1234567',
                'realname' => '測試學生',
                'picture' => '',
            ],
        ]),
    ]);

    $response = postJson('/login', [
        'username' => 's1234567',
        'password' => 'secret',
    ]);

    $response->assertSuccessful();
    $response->assertJson(['ok' => true]);
    expect(app(AccountCredentialsStore::class)->has())->toBeTrue();
});

it('uses session ticket when fetching profile after login', function () {
    config()->set('hungu.reviewer_base_url', 'https://uu.nou.edu.tw/xmlapi/index.php');

    Http::fake([
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
                'session_data' => ['ticket' => 'ticket-from-session-data'],
                'idx_data' => ['session_idx' => 'idx-should-not-be-used'],
                'login_data' => ['realname' => '測試學生'],
                'cookie_data' => ['WM' => 'cookie-from-payload'],
            ],
        ]),
        'https://uu.nou.edu.tw/xmlapi/index.php?action=my-profile*' => Http::response([
            'code' => 0,
            'message' => 'success',
            'data' => [
                'username' => 'reviewer',
                'realname' => '測試學生',
                'picture' => '',
            ],
        ]),
    ]);

    $response = postJson('/login', [
        'username' => 'reviewer',
        'password' => 'secret',
    ]);

    $response->assertSuccessful();
    $response->assertJson(['ok' => true]);

    Http::assertSent(function (Request $request): bool {
        if (! str_contains($request->url(), 'action=my-profile')) {
            return true;
        }

        return str_contains($request->url(), 'ticket=ticket-from-session-data')
            && ! str_contains($request->url(), 'ticket=idx-should-not-be-used');
    });
});

it('clears cached course list and remembered credentials on logout', function () {
    app(AccountCredentialsStore::class)->put('s1234567', 'remembered-secret');
    app(UUSessionStore::class)->put([
        'base_url' => 'https://uu.nou.edu.tw',
        'ua' => (string) config('hungu.user_agent'),
        'ticket' => 'ticket-logout',
        'session_idx' => 'idx-logout',
        'cookies' => ['WMSESSID' => 'cookie-logout'],
        'profile' => [
            'display_name' => '測試學生',
            'username' => 's1234567',
            'picture' => '',
            'realname' => '測試學生',
        ],
    ]);

    Cache::store('database')->put('alt-uu:courses:list:s1234567', [
        ['course_id' => '1001', 'title' => '(114下)行動學習導論-ZZZ001班'],
    ]);
    Cache::store('database')->put('alt-uu:courses:list:s7654321', [
        ['course_id' => '2001', 'title' => '(114下)跨帳號測試課程-ZZZ002班'],
    ]);

    $response = withSession([
        'hungu.profile' => [
            'display_name' => '測試學生',
            'username' => 's1234567',
            'picture' => '',
            'realname' => '測試學生',
        ],
        'hungu.current_course_id' => '1001',
        'alt-uu:courses:node-resources:1001.2001' => [
            'loaded' => true,
            'items' => [['title' => 'cached resource']],
        ],
    ])
        ->postJson('/logout');

    $response->assertSuccessful();
    $response->assertJson(['ok' => true]);
    $response->assertSessionMissing('hungu.profile');
    $response->assertSessionMissing('hungu.current_course_id');
    $response->assertSessionMissing('alt-uu:courses:node-resources:1001.2001');
    expect(Cache::store('database')->has('alt-uu:courses:list:s1234567'))->toBeFalse();
    expect(Cache::store('database')->has('alt-uu:courses:list:s7654321'))->toBeFalse();
    expect(app(AccountCredentialsStore::class)->has())->toBeFalse();
});
